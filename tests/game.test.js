import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addPlayer, act, startGame, viewFor, validCombo } from '../src/game.js';
import { botAction } from '../src/bot.js';
import { CARDS, TOTAL_CARDS } from '../src/cards.js';
import { RECIPES, getRecipe } from '../src/recipes.js';

function rng(seed = 42) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
let serial = 0;
const c = (type, extra = {}) => ({ id: `test-${++serial}`, type, ...extra });
function game(n = 3) {
  const g = createGame('a', '小桃');
  for (let i = 1; i < n; i++) addPlayer(g, String.fromCharCode(97 + i), `朋友${i}`, true);
  g.phase = 'play'; g.deck = [c('skip'), c('exploding'), c('imploding', { faceUp: false }), c('defuse')];
  return g;
}
function settle(g) {
  for (let i = 0; i < 40 && g.phase === 'reaction'; i++) {
    const v = viewFor(g, g.turn);
    const p = g.players.find(p => p.alive && !v.reaction.passed.includes(p.id));
    assert.ok(p); g = act(g, p.id, { type: 'pass' });
  }
  return g;
}
function play(g, actor, type, target) { const card = g.players.find(p => p.id === actor).hand.find(c => c.type === type); return settle(act(g, actor, { type: 'play', cardId: card.id, target })); }
const allCards = g => [...g.deck, ...g.discard, ...g.retired, ...g.players.flatMap(p => [...p.hand, ...(p.bark ? [p.bark] : []), ...(p.trap ? [p.trap.card] : [])]), ...(g.prompt?.type === 'insert' ? [g.prompt.card] : [])];

test('121 cards; every supported recipe can deal without exceeding the physical pool', () => {
  assert.equal(TOTAL_CARDS, 121);
  for (const r of RECIPES) for (let n = r.min; n <= r.max; n++) {
    const g = game(n); const spec = getRecipe(r.id, n); startGame(g, r.id, rng(n));
    assert.equal(allCards(g).length, Object.values(spec.counts).reduce((a, b) => a + b, 0));
    assert.ok(g.players.every(p => p.hand.length === spec.start + spec.defuses));
    assert.ok(g.players.every(p => p.hand.every(c => !['exploding', 'imploding'].includes(c.type))));
    assert.ok(g.deck.length > 0);
  }
});
test('invalid actions are atomic; passive cards and out-of-turn draws rejected', () => {
  const g = game(); g.players[0].hand = [c('defuse'), c('targeted')]; const before = structuredClone(g);
  assert.throws(() => act(g, 'b', { type: 'draw' }));
  assert.throws(() => act(g, 'a', { type: 'play', cardId: g.players[0].hand[0].id }));
  assert.throws(() => act(g, 'a', { type: 'play', cardId: g.players[0].hand[1].id, target: 'a' }));
  assert.deepEqual(g, before);
});
test('attack stacks remaining turns, skip removes one, super skip removes all', () => {
  let g = game(); g.players[0].hand = [c('attack')]; g.players[1].hand = [c('skip'), c('attack')]; g.players[2].hand = [c('superSkip')];
  g = play(g, 'a', 'attack'); assert.equal(g.turn, 'b'); assert.equal(g.remaining, 2);
  g = play(g, 'b', 'skip'); assert.equal(g.turn, 'b'); assert.equal(g.remaining, 1);
  g = play(g, 'b', 'attack'); assert.equal(g.turn, 'c'); assert.equal(g.remaining, 3);
  g = play(g, 'c', 'superSkip'); assert.equal(g.turn, 'a'); assert.equal(g.remaining, 1);
});
test('Nope can be Noped; no draw cancellation; cancellation does not return cards', () => {
  let g = game(); g.players[0].hand = [c('attack'), c('nope')]; g.players[1].hand = [c('nope')];
  g = act(g, 'a', { type: 'play', cardId: g.players[0].hand[0].id });
  g = act(g, 'b', { type: 'play', cardId: g.players[1].hand[0].id });
  assert.equal(viewFor(g, 'a').reaction.cancelled, true);
  g = act(g, 'a', { type: 'play', cardId: g.players[0].hand[0].id });
  g = settle(g); assert.equal(g.turn, 'b'); assert.equal(g.remaining, 2); assert.equal(g.discard.length, 3);
  g.players[1].hand.push(c('nope')); g = act(g, 'b', { type: 'draw' });
  assert.throws(() => act(g, 'b', { type: 'play', cardId: g.players[1].hand[0].id }));
});
test('defuse inserts privately without shuffling and consumes just the current attacked turn', () => {
  let g = game(); g.deck = [c('exploding'), c('skip'), c('reverse')]; g.players[0].hand = [c('defuse')]; g.remaining = 2; g.attacked = true;
  g = settle(act(g, 'a', { type: 'draw' })); assert.equal(g.prompt.type, 'insert');
  assert.equal(viewFor(g, 'b').prompt.type, 'waiting'); assert.equal(viewFor(g, 'b').prompt.card, undefined);
  g = act(g, 'a', { type: 'answer', position: 1 });
  assert.deepEqual(g.deck.map(c => c.type), ['skip', 'exploding', 'reverse']); assert.equal(g.turn, 'a'); assert.equal(g.remaining, 1);
});
test('face-down imploding flips on draw; face-up kills despite Defuse; Bury preserves orientation', () => {
  let g = game(); g.deck = [c('imploding', { faceUp: false }), c('skip')]; g.players[0].hand = [c('defuse')];
  g = settle(act(g, 'a', { type: 'draw' })); assert.equal(g.prompt.card.faceUp, true);
  g = act(g, 'a', { type: 'answer', position: 0 }); assert.ok(viewFor(g, 'b').deckTop.faceUp);
  g.players[1].hand = [c('defuse')]; g = settle(act(g, 'b', { type: 'draw' })); assert.equal(g.players[1].alive, false);
  g = game(); g.deck = [c('imploding', { faceUp: true }), c('skip')]; g.players[0].hand = [c('bury')];
  g = play(g, 'a', 'bury'); assert.equal(g.prompt.card.faceUp, true); assert.equal(g.players[0].alive, true);
  g = act(g, 'a', { type: 'answer', position: 1 }); assert.equal(g.deck[1].faceUp, true);
});
test('stealing Streaking Kitten triggers its former owner immediately', () => {
  let g = game(); g.players[0].hand = [c('taco'), c('feral')]; g.players[1].hand = [c('streaking'), c('exploding'), c('defuse')];
  g = settle(act(g, 'a', { type: 'combo', ids: g.players[0].hand.map(c => c.id), target: 'b' }));
  g = act(g, 'a', { type: 'answer', index: 0 });
  assert.equal(g.prompt.owner, 'b'); assert.equal(g.prompt.type, 'insert'); assert.equal(g.players[1].hand.length, 0);
  g = act(g, 'b', { type: 'answer', position: 0 }); assert.equal(g.turn, 'a');
});
test('future stays private; NOW interrupts draw and returns to a fresh response window', () => {
  let g = game(); g.players[1].hand = [c('alterNow')];
  g = act(g, 'a', { type: 'draw' }); g = act(g, 'b', { type: 'play', cardId: g.players[1].hand[0].id });
  g = settle(g); assert.equal(g.prompt.owner, 'b'); assert.equal(g.prompt.type, 'future');
  assert.equal(viewFor(g, 'a').prompt.cards, undefined);
  const order = [...g.prompt.cards].reverse().map(c => c.id);
  g = act(g, 'b', { type: 'answer', order }); assert.equal(g.phase, 'reaction'); assert.equal(g.frames.length, 1);
  g = settle(g); assert.equal(g.prompt.type, 'insert'); assert.equal(g.prompt.owner, 'a');
});
test('garbage choices stay private and are moved together; no chosen ids leak', () => {
  let g = game(); g.players[0].hand = [c('garbage'), c('skip')]; g.players[1].hand = [c('reverse')]; g.players[2].hand = [];
  g = play(g, 'a', 'garbage'); const selected = g.players[0].hand[0].id;
  g = act(g, 'a', { type: 'answer', cardId: selected });
  assert.equal(g.players[0].hand.length, 1); assert.equal(JSON.stringify(viewFor(g, 'b')).includes(selected), false);
  g = act(g, 'b', { type: 'answer', cardId: g.players[1].hand[0].id });
  assert.equal(g.players[0].hand.length, 0); assert.equal(g.players[1].hand.length, 0); assert.equal(g.phase, 'play');
});
test('Barking kittens damage the other holder; both held may target any opponent', () => {
  let g = game(); g.players[0].hand = [c('barking')]; g.players[1].hand = [c('barking'), c('defuse')];
  g = play(g, 'a', 'barking'); assert.equal(g.players[1].hand.length, 0); assert.equal(g.turn, 'a'); assert.equal(g.prompt, null);
  assert.equal(g.discard.filter(c => c.type === 'barking').length, 2);
  g = game(); g.players[0].hand = [c('barking'), c('barking')];
  assert.throws(() => play(g, 'a', 'barking'));
  g = play(g, 'a', 'barking', 'c'); assert.equal(g.players[2].alive, false); assert.equal(g.turn, 'a');
});
test('marked cards are the only other hand cards revealed; no deck, tasks or retired hands in view', () => {
  const g = game(); g.players[1].hand = [c('defuse'), c('streaking')]; g.players[1].marked = [g.players[1].hand[0].id];
  const v = viewFor(g, 'a');
  assert.equal(v.players[1].hand, undefined); assert.equal(v.players[1].marked[0].card.type, 'defuse');
  assert.equal(JSON.stringify(v).includes(g.players[1].hand[1].id), false);
  for (const key of ['deck', 'tasks', 'frames', 'retired']) assert.equal(v[key], undefined);
});
test('matching titles and feral cats; no wild attacks', () => {
  assert.ok(validCombo([c('skip'), c('skip')])); assert.ok(validCombo([c('taco'), c('feral'), c('feral')]));
  assert.ok(!validCombo([c('attack'), c('feral')])); assert.ok(!validCombo([c('taco'), c('rainbow')]));
});
for (const r of RECIPES) test(`complete simulated games preserve card conservation: ${r.id}`, () => {
  for (const n of new Set([r.min, r.max])) {
    const random = rng(n * 77 + r.id.length), initial = game(n); startGame(initial, r.id, random);
    let g = initial, total = allCards(g).length;
    for (let i = 0; i < 3000 && g.phase !== 'finished'; i++) {
      let moved = false;
      for (const p of g.players.filter(p => p.alive)) {
        const action = botAction(viewFor(g, p.id), random);
        if (action) { g = act(g, p.id, action, random); moved = true; break; }
      }
      assert.ok(moved, `stuck: ${g.phase} ${JSON.stringify(g.prompt)}`);
      const cards = allCards(g);
      assert.equal(cards.length, total); assert.equal(new Set(cards.map(c => c.id)).size, total);
    }
    assert.equal(g.phase, 'finished', `${r.id} ${n} did not finish`);
    assert.equal(g.players.filter(p => p.alive).length, 1);
  }
});
