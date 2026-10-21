import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRoomTransport } from '../src/room-transport.js';

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  class Peer extends EventEmitter {
    static instances = [];
    constructor() { super(); Peer.instances.push(this); }
    connect() { this.connection = new EventEmitter(); this.connection.open = false; return this.connection; }
    reconnect() { this.reconnects = (this.reconnects || 0) + 1; }
    destroy() { this.destroyed = true; this.emit('close'); }
  }
  const issues = [], statuses = [];
  const transport = createRoomTransport({ Peer, host: false, room: 'TEST2345',
    onIssue: issue => issues.push(issue), onStatus: status => statuses.push(status) });
  t.after(() => transport.stop());
  return { Peer, issues, statuses, transport };
}

test('missing room reports a reason; manual retry can recover and clear it', t => {
  const { Peer, issues, statuses, transport } = setup(t);
  const oldPeer = Peer.instances[0]; oldPeer.emit('open');
  oldPeer.emit('error', { type: 'peer-unavailable' });
  assert.equal(issues.at(-1), 'peer-unavailable');
  assert.equal(statuses.at(-1), 'retrying');
  transport.wake(); t.mock.timers.tick(0);
  const peer = Peer.instances.at(-1); peer.emit('open');
  peer.connection.open = true; peer.connection.emit('open'); transport.ready();
  assert.equal(issues.at(-1), null); assert.equal(statuses.at(-1), 'connected');
  oldPeer.emit('error', { type: 'network' }); t.mock.timers.tick(60000);
  assert.equal(Peer.instances.length, 2); assert.equal(issues.at(-1), null);
});

test('slow peer negotiation gets 45 seconds and reports a network timeout', t => {
  const { Peer, issues } = setup(t);
  const peer = Peer.instances[0]; peer.emit('open');
  t.mock.timers.tick(44000);
  assert.equal(peer.destroyed, undefined); assert.deepEqual(issues, []);
  t.mock.timers.tick(1000);
  assert.equal(peer.destroyed, true); assert.equal(issues.at(-1), 'connection-timeout');
});

test('signaling timeout is distinguished from peer negotiation failure', t => {
  const { issues } = setup(t);
  t.mock.timers.tick(45000);
  assert.equal(issues.at(-1), 'signaling');
});

test('signaling recovery clears the hint without destroying an established data channel', t => {
  const { Peer, issues, transport } = setup(t);
  const peer = Peer.instances[0]; peer.emit('open');
  peer.connection.open = true; peer.connection.emit('open'); transport.ready();
  peer.emit('disconnected');
  assert.equal(issues.at(-1), 'signaling'); assert.equal(peer.connection.open, true);
  transport.wake(); assert.equal(peer.reconnects, 2);
  peer.emit('open'); t.mock.timers.tick(60000);
  assert.equal(issues.at(-1), null); assert.equal(Peer.instances.length, 1);
});
