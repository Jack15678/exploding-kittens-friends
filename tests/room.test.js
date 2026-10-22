import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Room, commandIsCurrent, CHAT_HISTORY_LIMIT, CHAT_MAX_LENGTH } from '../src/room.js';
import { addPlayer, act, viewFor } from '../src/game.js';
import { readSession, saveSession, SESSION_KEY, TOKEN_KEY } from '../src/session.js';

const storage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; };
globalThis.sessionStorage = storage();
function host() {
  const room = new Room({ role: 'host', name: '主厨', onChange() {}, onNotice() {} });
  room.status = 'connected'; return room;
}
class Connection extends EventEmitter {
  open = true; messages = [];
  send(message) { this.messages.push(structuredClone(message)); }
  close() { this.open = false; this.emit('close'); }
}
function join(room, name, token = crypto.randomUUID()) {
  const conn = new Connection(); room.accept(conn, () => true);
  conn.emit('data', { type: 'join', token, name, version: 1 });
  return { conn, token, id: room.identities[token] };
}
function timedRoom(t) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
  const room = host(), a = join(room, '桃桃'), b = join(room, '布丁');
  t.after(() => room.stop());
  room.send({ type: 'start' });
  room.game.deck = [{ id: 'safe-top', type: 'skip' }, { id: 'safe-next', type: 'reverse' }];
  const send = (guest, action) => guest.conn.emit('data', { type: 'action', revision: room.game.revision, reactionId: room.view.reaction?.id, action });
  return { room, a, b, send };
}

test('host auto-passes at 10 seconds; partial passes, chat and republishing do not extend the deadline', t => {
  const { room, a, send } = timedRoom(t);
  room.send({ type: 'draw' });
  assert.equal(room.view.reaction.remainingMs, 10000);
  assert.equal(a.conn.messages.at(-1).view.reaction.remainingMs, 10000);
  t.mock.timers.tick(3000);
  send(a, { type: 'pass' }); room.sendChat('还有七秒'); room.publish();
  assert.equal(room.view.reaction.remainingMs, 7000);
  t.mock.timers.tick(6999); assert.equal(room.game.phase, 'reaction');
  t.mock.timers.tick(1);
  assert.equal(room.game.phase, 'play'); assert.equal(room.game.turn, a.id);
  assert.equal(room.game.deck.length, 1);
  const revision = room.game.revision;
  t.mock.timers.tick(10000); assert.equal(room.game.revision, revision);
});

test('manual unanimous passes finish early and an old timer cannot settle the next action', t => {
  const { room, a, b, send } = timedRoom(t);
  room.send({ type: 'draw' }); t.mock.timers.tick(3000);
  send(a, { type: 'pass' }); send(b, { type: 'pass' });
  assert.equal(room.game.phase, 'play');
  send(a, { type: 'draw' });
  t.mock.timers.tick(7000); assert.equal(room.game.phase, 'reaction');
  t.mock.timers.tick(3000); assert.equal(room.game.deck.length, 0);
  assert.equal(room.game.turn, b.id);
});

test('Nope restarts the response window and keeps the original public card available', t => {
  const { room, a, send } = timedRoom(t);
  room.game.players[0].hand = [{ id: 'attack', type: 'attack' }];
  room.game.players[1].hand = [{ id: 'nope', type: 'nope' }];
  room.send({ type: 'play', cardId: 'attack' });
  const firstId = room.view.reaction.id;
  t.mock.timers.tick(9000); send(a, { type: 'play', cardId: 'nope' });
  assert.notEqual(room.view.reaction.id, firstId);
  assert.equal(room.view.reaction.remainingMs, 10000);
  assert.equal(room.view.reaction.card.type, 'attack');
  assert.equal(room.view.discardTop.type, 'nope');
  t.mock.timers.tick(1000); assert.equal(room.game.phase, 'reaction');
  t.mock.timers.tick(9000);
  assert.equal(room.game.phase, 'play'); assert.equal(room.game.turn, room.me);
  assert.equal(room.game.remaining, 1);
});

test('NOW pauses the interrupted timer during private choices and resumes with a fresh window', t => {
  const { room, a, b, send } = timedRoom(t);
  room.game.players[1].hand = [{ id: 'now', type: 'alterNow' }];
  room.send({ type: 'draw' }); t.mock.timers.tick(9000);
  send(a, { type: 'play', cardId: 'now' });
  assert.equal(room.view.reaction.remainingMs, 10000);
  room.send({ type: 'pass' }); send(b, { type: 'pass' });
  assert.equal(room.game.phase, 'prompt'); assert.equal(room.view.reaction.remainingMs, null);
  const revision = room.game.revision;
  t.mock.timers.tick(20000); assert.equal(room.game.revision, revision);
  send(a, { type: 'answer', order: room.game.prompt.cards.map(c => c.id) });
  assert.equal(room.game.phase, 'reaction'); assert.equal(room.view.reaction.remainingMs, 10000);
  t.mock.timers.tick(9999); assert.equal(room.game.deck.length, 2);
  t.mock.timers.tick(1); assert.equal(room.game.deck.length, 1);
});

test('disconnects pause automatic passes; reconnect and host restore grant a new window; stop clears it', t => {
  const { room, a } = timedRoom(t);
  room.send({ type: 'draw' }); t.mock.timers.tick(9000);
  a.conn.close(); assert.equal(room.view.reaction.remainingMs, null);
  const revision = room.game.revision;
  t.mock.timers.tick(20000); assert.equal(room.game.revision, revision);
  join(room, '忽略昵称', a.token); assert.equal(room.view.reaction.remainingMs, 10000);
  t.mock.timers.tick(9999); assert.equal(room.game.phase, 'reaction');
  const local = storage(); saveSession(local, room);
  const restored = new Room({ saved: readSession(local), name: '主厨', onChange() {}, onNotice() {} });
  restored.status = 'connected'; restored.publish();
  assert.equal(restored.view.reaction.remainingMs, null);
  for (const p of restored.game.players) p.online = true;
  restored.publish(); assert.equal(restored.view.reaction.remainingMs, 10000);
  restored.stop(); const restoredRevision = restored.game.revision;
  t.mock.timers.tick(10000); assert.equal(restored.game.revision, restoredRevision);
  assert.equal(room.game.phase, 'play');
});
test('room binds actions to connections, filters snapshots and restores the same seat', () => {
  const room = host(); const a = join(room, '桃桃'), b = join(room, '布丁');
  assert.equal(room.game.players.length, 3);
  room.send({ type: 'start' });
  const view = a.conn.messages.at(-1).view;
  assert.equal(view.players.find(p => p.id === a.id).hand.length, 8);
  assert.ok(view.players.filter(p => p.id !== a.id).every(p => !('hand' in p)));
  assert.ok(!('deck' in view) && !('frames' in view));
  const before = structuredClone(room.game);
  a.conn.emit('data', { type: 'action', actor: room.me, revision: room.game.revision, action: { type: 'draw', actor: room.me } });
  assert.deepEqual(room.game, before, 'guest cannot impersonate host');
  a.conn.close(); assert.equal(room.paused(), true);
  const restored = join(room, '忽略的新昵称', a.token);
  assert.equal(restored.id, a.id); assert.equal(room.game.players.length, 3);
  assert.equal(room.game.players.find(p => p.id === a.id).name, '桃桃');
  assert.equal(room.paused(), false);
  restored.conn.close(); b.conn.close(); room.stop();
});
test('simultaneous passes share a reaction id but old reactions and repeated actions cannot replay', () => {
  const room = host(); addPlayer(room.game, 'a', '桃桃'); addPlayer(room.game, 'b', '布丁');
  room.game = act(room.game, room.me, { type: 'start' });
  room.game = act(room.game, room.me, { type: 'draw' });
  const v = viewFor(room.game, 'a');
  const packet = { revision: v.revision, reactionId: v.reaction.id, action: { type: 'pass' } };
  room.game = act(room.game, 'a', packet.action);
  assert.equal(commandIsCurrent(room.game, packet), true);
  room.game = act(room.game, 'b', packet.action);
  assert.equal(commandIsCurrent(room.game, packet), false);
  assert.equal(commandIsCurrent(room.game, { ...packet, action: { type: 'draw' } }), false);
  room.stop();
});
test('permanent join rejection is reported; a fatal host reconnect pauses all remote seats', () => {
  const room = host(); const a = join(room, '桃桃'); const bad = join(room, '桃桃');
  assert.equal(bad.conn.messages.at(-1).rejected, true); bad.conn.close();
  room.networkStatus('retrying'); room.networkStatus('connected');
  assert.equal(room.game.players.find(p => p.id === a.id).online, false);
  assert.equal(room.connections.size, 0); assert.equal(room.paused(), true);
  a.conn.close(); room.stop();
});
test('guest session holds only its view; host identity and invitation mismatch are checked', () => {
  const room = host(); const a = join(room, '桃桃'); room.send({ type: 'start' });
  const local = storage();
  assert.equal(saveSession(local, { role: 'guest', room: room.room, me: a.id, game: room.game }), true);
  const guest = readSession(local);
  assert.ok(!('game' in guest)); assert.ok(!('deck' in guest.view));
  assert.equal(guest.view.players.filter(p => 'hand' in p).length, 1);
  assert.equal(readSession(local, 'AAAAAAAA'), null);
  assert.equal(saveSession(local, room), true);
  assert.equal(readSession(local).game.host, room.me);
  const tampered = JSON.parse(local.getItem(SESSION_KEY)); tampered.me = a.id;
  local.setItem(SESSION_KEY, JSON.stringify(tampered)); assert.equal(readSession(local), null);
  local.setItem(SESSION_KEY, '{broken'); assert.equal(readSession(local), null);
  assert.ok(sessionStorage.getItem(TOKEN_KEY));
  a.conn.close(); room.stop();
});

test('host allows a slow incoming handshake and clears a recovered connection hint', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const room = host(), conn = new Connection();
  t.after(() => { conn.close(); room.stop(); });
  room.accept(conn, () => true);
  t.mock.timers.tick(20000);
  assert.equal(conn.open, true);
  conn.emit('data', { type: 'join', token: crypto.randomUUID(), name: '慢一点的小猫', version: 1 });
  assert.equal(room.game.players.length, 2);
  room.networkIssue('connection-lost'); assert.match(room.connectionIssue, /房主保持网页打开/);
  room.networkIssue(null); assert.equal(room.connectionIssue, '');
  t.mock.timers.tick(60000); assert.equal(conn.open, true);
});

test('chat binds authors to admitted connections and does not change the game revision', () => {
  const room = host(), a = join(room, '桃桃'), b = join(room, '布丁');
  const before = structuredClone(room.game);
  a.conn.emit('data', { type: 'chat', text: '  等我一下 🐱  ', from: room.me, name: '伪造房主' });
  assert.deepEqual(room.game, before);
  assert.equal(room.chat[0].from, a.id); assert.equal(room.chat[0].name, '桃桃');
  assert.equal(room.chat[0].text, '等我一下 🐱');
  assert.deepEqual(b.conn.messages.at(-1), { type: 'chat', messages: room.chat });
  assert.ok(!('game' in b.conn.messages.at(-1)) && !('view' in b.conn.messages.at(-1)));
  for (const text of ['', '   ', '猫'.repeat(CHAT_MAX_LENGTH + 1), { text: '坏消息' }]) {
    a.conn.emit('data', { type: 'chat', text }); assert.equal(room.chat.length, 1);
  }
  const stranger = new Connection(); room.accept(stranger, () => true);
  stranger.emit('data', { type: 'chat', text: '还没入房' });
  assert.equal(room.chat.length, 1); assert.equal(stranger.messages.at(-1).rejected, true);
  stranger.close(); a.conn.close(); b.conn.close(); room.stop();
});

test('chat remains usable during a paused game and restores a bounded history', () => {
  const room = host(), a = join(room, '桃桃'), b = join(room, '布丁');
  b.conn.close(); assert.equal(room.paused(), true);
  for (let i = 0; i < CHAT_HISTORY_LIMIT + 3; i++) assert.equal(room.sendChat(`第 ${i} 条`), true);
  assert.equal(room.chat.length, CHAT_HISTORY_LIMIT); assert.equal(room.chat[0].text, '第 3 条');
  const local = storage(); saveSession(local, room);
  const restored = new Room({ saved: readSession(local), name: '主厨', onChange() {}, onNotice() {} });
  assert.deepEqual(restored.chat, room.chat);
  const rejoined = join(room, '忽略的新昵称', a.token);
  const state = rejoined.conn.messages.at(-1);
  assert.deepEqual(state.chat, room.chat);
  const guest = new Room({ role: 'guest', name: '桃桃', code: room.room, onChange() {}, onNotice() {} });
  guest.transport = { ready() {}, stop() {} }; guest.receive(state);
  assert.deepEqual(guest.chat, room.chat);
  saveSession(local, guest); assert.deepEqual(readSession(local).chat, room.chat);
  assert.ok(!('game' in readSession(local)) && !('deck' in readSession(local).view));
  room.networkStatus('retrying'); assert.equal(room.sendChat('离线消息'), false);
  rejoined.conn.close(); guest.stop(); restored.stop(); room.stop();
});
