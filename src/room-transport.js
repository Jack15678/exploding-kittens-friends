import { connectRelay, relayURL } from './relay-socket.js';

// The host still owns admission and private views. IDs identify relay-assigned
// sockets, never client-chosen routing targets.
export function createRoomTransport({ host, room, token, onStatus = () => {},
  onData = () => {}, onOpen = () => {}, onConnection = () => {}, onFatal = () => {}, onIssue = () => {},
  url = relayURL(`/api/rooms/${room}/ws`), ...socketOptions }) {
  const guests = new Map();
  let stopped = false, status;
  function report(next) {
    if (!stopped && status !== next) { status = next; onStatus(next); }
  }
  function remove(id) {
    const conn = guests.get(id);
    if (!conn) return;
    conn.open = false; conn.emit('close'); guests.delete(id);
  }
  function add(id) {
    if (guests.has(id)) return;
    const listeners = new Map();
    const conn = {
      open: true,
      on(event, fn) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(fn); },
      emit(event, data) { for (const fn of listeners.get(event) || []) fn(data); },
      send(data) {
        if (!conn.open || !relay.send({ type: 'send', id, data })) throw new Error('连接已中断');
      },
      close() { if (conn.open) { relay.send({ type: 'disconnect', id }); remove(id); } },
    };
    guests.set(id, conn);
    onConnection(conn, () => !stopped && guests.get(id) === conn);
  }
  report('connecting');
  const relay = connectRelay({ ...socketOptions, url, hello: { type: 'hello', host, token },
    onDisconnect() {
      for (const id of [...guests.keys()]) remove(id);
      report('retrying'); onIssue('connection-lost');
    },
    onFatal,
    onMessage(message) {
      if (message.type === 'ready') {
        if (host) { onIssue(null); report('connected'); }
        else onOpen();
      } else if (host && message.type === 'joined') add(message.id);
      else if (host && message.type === 'left') remove(message.id);
      else if (message.type === 'data') {
        if (host) guests.get(message.id)?.emit('data', message.data);
        else onData(message.data);
      }
    },
  });
  return {
    send(data) { return !host && relay.send({ type: 'send', data }); },
    ready() { if (!host && !stopped) { onIssue(null); report('connected'); } },
    closeRoom() { if (host) relay.send({ type: 'close-room' }); },
    stop() { stopped = true; relay.stop(); for (const id of [...guests.keys()]) remove(id); },
    wake() { relay.wake(); },
  };
}
