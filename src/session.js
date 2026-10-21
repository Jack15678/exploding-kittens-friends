import { viewFor } from './game.js';
export const SESSION_KEY = 'kitten-kitchen-session-v1';
export const TOKEN_KEY = 'kitten-kitchen-identity-v1';
export const ROOM_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
export function saveSession(storage, session) {
  try {
    const record = { version: 1, role: session.role, room: session.room, me: session.me };
    record.chat = session.chat || [];
    if (session.role === 'guest') {
      record.view = session.game ? viewFor(session.game, session.me) : session.view;
      if (record.view) {
        // Drop any accidentally supplied hidden fields, even for already-filtered snapshots.
        const { deck, tasks, frames, retired, ...v } = record.view;
        record.view = { ...v, players: v.players.map(p => { const { hand, ...rest } = p; return p.id === session.me ? { ...rest, hand } : rest; }) };
      }
    } else { record.game = session.game; record.identities = session.identities; }
    storage.setItem(SESSION_KEY, JSON.stringify(record)); return true;
  } catch { return false; }
}
export function readSession(storage, invitation = '') {
  try {
    const s = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
    if (!s || s.version !== 1 || !['host', 'guest', 'practice'].includes(s.role)) return null;
    if (s.role !== 'practice' && !ROOM_PATTERN.test(s.room)) return null;
    if (invitation && invitation !== s.room) return null;
    const state = s.role === 'guest' ? s.view : s.game;
    if (state && (!Array.isArray(state.players) || !state.players.some(p => p.id === s.me) || state.version !== 1)) return null;
    if (s.role !== 'guest' && (!state || state.host !== s.me || !s.identities)) return null;
    return s;
  } catch { return null; }
}
export function clearSession(storage) { try { storage.removeItem(SESSION_KEY); } catch {} }
