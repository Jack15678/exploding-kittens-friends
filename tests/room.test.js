import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Room, commandIsCurrent } from '../src/room.js';
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
  room.networkIssue('connection-timeout'); assert.match(room.connectionIssue, /两端网络/);
  room.networkIssue(null); assert.equal(room.connectionIssue, '');
  t.mock.timers.tick(60000); assert.equal(conn.open, true);
});
