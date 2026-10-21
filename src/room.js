import Peer from 'peerjs';
import { createGame, addPlayer, act, viewFor } from './game.js';
import { botAction } from './bot.js';
import { RECIPES } from './recipes.js';
import { createRoomTransport } from './room-transport.js';
import { saveSession, clearSession, TOKEN_KEY, ROOM_PATTERN } from './session.js';

export function commandIsCurrent(g, message) {
  if (message.revision === g.revision) return true;
  if (message.action?.type === 'pass') return g.phase === 'reaction' && message.reactionId === g.frames.at(-1)?.id;
  if (message.action?.type === 'answer' && g.prompt?.type === 'garbage') return message.promptId === g.prompt.id;
  return false;
}
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode = () => [...crypto.getRandomValues(new Uint8Array(8))].map(n => alphabet[n % alphabet.length]).join('');
function options() {
  const url = import.meta.env?.VITE_TURN_URL;
  return url ? { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: url,
    username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }] } } : {};
}
export class Room {
  constructor({ role, name, code = '', saved, onChange, onNotice }) {
    this.role = saved?.role || role; this.room = saved?.room || (role === 'host' ? roomCode() : code.toUpperCase());
    this.name = name; this.onChange = onChange; this.onNotice = onNotice;
    this.me = saved?.me || crypto.randomUUID(); this.identities = saved?.identities || {};
    this.game = saved?.game || (this.role !== 'guest' ? createGame(this.me, name) : null);
    this.view = saved?.view || (this.game ? viewFor(this.game, this.me) : null);
    this.status = this.role === 'practice' ? 'connected' : 'connecting';
    this.connections = new Map(); this.transport = null; this.stopped = false; this.pending = false;
    try {
      this.token = sessionStorage.getItem(TOKEN_KEY) || crypto.randomUUID(); sessionStorage.setItem(TOKEN_KEY, this.token);
    } catch { this.token = crypto.randomUUID(); }
    if (this.game) for (const p of this.game.players) p.online = p.bot || p.id === this.me;
  }
  start() {
    if (this.role === 'practice') { this.publish(); return; }
    if (!ROOM_PATTERN.test(this.room)) throw new Error('房间码需要 8 位字母或数字。');
    this.transport = createRoomTransport({ Peer, host: this.role === 'host', room: this.room, options: options(),
      onStatus: status => this.networkStatus(status),
      onOpen: () => { this.transport.send({ type: 'join', token: this.token, name: this.name, version: 1 }); },
      onData: message => this.receive(message),
      onConnection: (conn, current) => this.accept(conn, current),
    });
    this.changed();
  }
  networkStatus(status) {
    if (this.stopped) return;
    this.status = status; this.pending = false;
    if (this.role === 'host') {
      if (status === 'retrying') {
        this.connections.clear();
        for (const p of this.game.players) if (!p.bot && p.id !== this.me) p.online = false;
        this.game.revision++;
      }
      this.publish();
    } else this.changed();
  }
  changed() { if (!this.stopped) this.onChange(this); }
  persist() {
    if (!saveSession(sessionStorage, this) && !this.warnedStorage) {
      this.warnedStorage = true; this.onNotice('浏览器未能保存牌局，刷新后可能无法恢复。');
    }
  }
  paused() { return this.status !== 'connected' || this.game?.players.some(p => p.alive && !p.online); }
  publish() {
    if (this.stopped || !this.game) return;
    this.view = viewFor(this.game, this.me); this.persist(); this.changed();
    for (const [id, conn] of this.connections) {
      if (!conn.open || !this.game.players.some(p => p.id === id)) continue;
      try { conn.send({ type: 'state', me: id, view: viewFor(this.game, id) }); } catch { conn.close(); }
    }
    this.scheduleBot();
  }
  receive(message) {
    if (this.stopped || !message || typeof message !== 'object') return;
    if (message.type === 'state' && message.view?.version === 1 && message.view.me === message.me) {
      this.me = message.me; this.view = message.view; this.pending = false;
      this.transport.ready(); this.persist(); this.changed();
    } else if (message.type === 'error') {
      this.pending = false;
      if (message.rejected) { this.stop(); this.onChange(null); } else this.changed();
      this.onNotice(String(message.message || '操作失败。'));
    }
    else if (message.type === 'closed' || message.type === 'removed') {
      this.stop(); this.onNotice(message.type === 'closed' ? '房主关闭了厨房。' : '你已离开这个房间。'); this.onChange(null);
    }
  }
  accept(conn, current) {
    if (this.connections.size >= 8) { conn.close(); return; }
    let id = null;
    const valid = () => current() && !this.stopped;
    const timeout = setTimeout(() => { if (!id) conn.close(); }, 12000);
    conn.on('data', message => {
      if (!valid()) return;
      try {
        if (!message || typeof message !== 'object' || JSON.stringify(message).length > 12000) throw new Error('消息格式无效。');
        if (message.type === 'join' && !id) {
          if (message.version !== 1 || typeof message.token !== 'string' || !/^[a-f0-9-]{36}$/.test(message.token)) throw new Error('客户端身份或版本不正确。');
          if (Object.hasOwn(this.identities, message.token)) id = this.identities[message.token];
          else {
            const assigned = crypto.randomUUID(); addPlayer(this.game, assigned, message.name);
            this.identities[message.token] = assigned; id = assigned;
          }
          const p = this.game.players.find(p => p.id === id);
          if (!p || p.bot || id === this.me) throw new Error('这个座位不能重连。');
          clearTimeout(timeout);
          const old = this.connections.get(id); this.connections.set(id, conn);
          if (old && old !== conn) old.close();
          p.online = true; this.game.revision++; this.publish();
        } else if (message.type === 'action' && id && this.connections.get(id) === conn) {
          if (this.paused()) throw new Error('正在等离线朋友回来。');
          if (!commandIsCurrent(this.game, message)) throw new Error('牌桌刚刚有变化，请重新选择。');
          this.game = act(this.game, id, message.action); this.publish();
        } else throw new Error('请先加入房间。');
      } catch (error) {
        try { conn.send({ type: 'error', message: error.message, rejected: !id });
          if (id) conn.send({ type: 'state', me: id, view: viewFor(this.game, id) }); } catch {}
      }
    });
    conn.on('close', () => {
      clearTimeout(timeout);
      if (!valid() || !id || this.connections.get(id) !== conn) return;
      this.connections.delete(id);
      const p = this.game.players.find(p => p.id === id);
      if (p) { p.online = false; this.game.revision++; this.publish(); }
    });
    conn.on('error', () => conn.close());
  }
  send(action) {
    if (this.pending || this.stopped || !this.view) return false;
    try {
      if (this.status !== 'connected' || this.view.players.some(p => p.alive && !p.online)) throw new Error('等连接恢复后继续。');
      if (this.role !== 'guest') { this.game = act(this.game, this.me, action); this.publish(); }
      else {
        const sent = this.transport.send({ type: 'action', revision: this.view.revision,
          reactionId: this.view.reaction?.id, promptId: this.view.prompt?.id, action });
        if (!sent) throw new Error('暂时没有连接上房主。');
        this.pending = true; this.changed();
      }
      return true;
    } catch (error) { this.onNotice(error.message); return false; }
  }
  addBot() {
    if (!this.game || this.game.phase !== 'lobby') return;
    try {
      const names = ['奶油团子', '芝麻糊糊', '桃桃布丁', '抹茶卷卷', '豆沙包包'];
      addPlayer(this.game, crypto.randomUUID(), names.find(n => !this.game.players.some(p => p.name === n)), true); this.publish();
    } catch (error) { this.onNotice(error.message); }
  }
  removePlayer(id) {
    if (!this.game || this.game.phase !== 'lobby' || id === this.me) return;
    const conn = this.connections.get(id);
    if (conn) { conn.send({ type: 'removed' }); this.connections.delete(id); setTimeout(() => conn.close(), 200); }
    this.game.players = this.game.players.filter(p => p.id !== id);
    for (const token of Object.keys(this.identities)) if (this.identities[token] === id) delete this.identities[token];
    this.game.revision++; this.publish();
  }
  recipe(id) {
    if (this.game?.phase === 'lobby' && RECIPES.some(r => r.id === id)) { this.game.recipeId = id; this.game.revision++; this.publish(); }
  }
  scheduleBot() {
    clearTimeout(this.botTimer);
    if (this.paused() || !this.game || ['lobby', 'finished'].includes(this.game.phase)) return;
    for (const p of this.game.players.filter(p => p.bot && p.alive)) {
      const action = botAction(viewFor(this.game, p.id));
      if (!action) continue;
      this.botTimer = setTimeout(() => {
        if (this.stopped || this.paused()) return;
        try { this.game = act(this.game, p.id, action); this.publish(); }
        catch (error) { this.onNotice(`陪练遇到问题：${error.message}`); }
      }, 420);
      return;
    }
  }
  stop(preserve = false) {
    if (this.stopped) return;
    if (preserve) this.persist();
    if (!preserve && this.role === 'host') for (const conn of this.connections.values()) try { conn.send({ type: 'closed' }); } catch {}
    this.stopped = true; clearTimeout(this.botTimer);
    this.transport?.stop(); this.connections.clear();
    if (!preserve) clearSession(sessionStorage);
  }
}
