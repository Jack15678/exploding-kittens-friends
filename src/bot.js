import { CARDS } from './cards.js';
import { validCombo } from './game.js';
// Only a player's filtered view is accepted: bots cannot inspect opponents or the deck.
export function botAction(v, random = Math.random) {
  const me = v.players.find(p => p.id === v.me);
  if (!me?.alive) return null;
  const hand = me.hand || [];
  const pick = list => list[Math.floor(random() * list.length)];
  const others = v.players.filter(p => p.alive && p.id !== me.id);
  const q = v.prompt;
  if (q?.type === 'garbage' && q.owners.includes(me.id) && !q.submitted.includes(me.id)) {
    const safe = hand.filter(c => !['defuse', 'streaking'].includes(c.type));
    return { type: 'answer', cardId: pick(safe.length ? safe : hand).id };
  }
  if (q?.owner === me.id && q.type !== 'waiting') {
    if (q.type === 'insert') return { type: 'answer', position: Math.floor(random() * (q.max + 1)) };
    if (q.type === 'future') {
      const cards = q.reorder ? [...q.cards].sort((a, b) => risk(a) - risk(b)) : q.cards;
      return { type: 'answer', order: cards.map(c => c.id) };
    }
    if (q.type === 'steal') {
      const target = v.players.find(p => p.id === q.target);
      return { type: 'answer', index: Math.floor(random() * target.count) };
    }
    if (q.type === 'name') return { type: 'answer', cardType: 'defuse' };
  }
  if (v.phase === 'reaction' && !v.reaction.passed.includes(me.id)) {
    const nope = hand.find(c => c.type === 'nope');
    if (nope && v.reaction.canNope && random() < 0.18) return { type: 'play', cardId: nope.id };
    return { type: 'pass' };
  }
  if (v.phase !== 'play' || v.turn !== me.id) return null;
  if (v.actionCount < 3) {
    const playable = hand.filter(c => !CARDS[c.type].passive && !CARDS[c.type].cat && c.type !== 'nope' &&
      !(c.type === 'bury' && me.trap) && !(c.type === 'mark' && !others.some(p => p.count)) &&
      !(c.type === 'take' && !others.some(p => !p.trap)));
    if (playable.length && (random() < 0.72 || v.deckTop)) {
      const c = pick(playable);
      const targets = others.filter(p => c.type === 'mark' ? p.count > 0 : c.type === 'take' ? !p.trap : true);
      return { type: 'play', cardId: c.id, ...(targets.length ? { target: pick(targets).id } : {}) };
    }
    if (others.some(p => p.count)) for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
      if (validCombo([hand[i], hand[j]]) && ![hand[i], hand[j]].some(c => ['defuse', 'exploding', 'imploding'].includes(c.type))) {
        return { type: 'combo', ids: [hand[i].id, hand[j].id], target: pick(others.filter(p => p.count)).id };
      }
    }
  }
  return { type: 'draw' };
}
function risk(c) { return c.type === 'exploding' || (c.type === 'imploding' && c.faceUp) ? 2 : c.type === 'imploding' ? 1 : 0; }
