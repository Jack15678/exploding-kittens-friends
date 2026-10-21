import { CARDS, cardName } from './cards.js';
import { getRecipe } from './recipes.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const player = (g, id) => g.players.find(p => p.id === id);
const alive = g => g.players.filter(p => p.alive);
const topFrame = g => g.frames.at(-1);
export function shuffled(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createGame(id, name) {
  return { version: 1, revision: 0, host: id, phase: 'lobby', recipeId: 'exploding-kittens-classic-mode',
    players: [{ id, name: cleanName(name), bot: false, online: true, alive: true, hand: [], marked: [], trap: null, bark: null }],
    deck: [], discard: [], retired: [], log: [], turn: id, direction: 1, remaining: 1, attacked: false,
    frames: [], tasks: [], prompt: null, intel: {}, winner: null, actionCount: 0, turnSerial: 0 };
}
export function cleanName(name) {
  assert(typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 16, '昵称请用 1–16 个字。');
  return name.trim();
}
export function addPlayer(g, id, name, bot = false) {
  assert(g.phase === 'lobby' && g.players.length < 5, '牌局已开始或房间已满。');
  assert(!player(g, id), '这个座位已经存在。');
  const n = cleanName(name);
  assert(!g.players.some(p => p.name === n), '这个昵称已经被占用了。');
  g.players.push({ id, name: n, bot, online: true, alive: true, hand: [], marked: [], trap: null, bark: null });
  g.revision++;
}
function log(g, text) { g.log.push({ id: `${g.revision}-${g.log.length}-${g.actionCount}`, text }); g.log = g.log.slice(-70); }
export function nextAlive(g, id = g.turn) {
  let index = g.players.findIndex(p => p.id === id);
  for (let n = 0; n < g.players.length; n++) {
    index = (index + g.direction + g.players.length) % g.players.length;
    if (g.players[index].alive) return g.players[index].id;
  }
  return null;
}
function endTurn(g, id) {
  if (g.phase === 'finished' || id !== g.turn) return;
  g.remaining--;
  if (g.remaining <= 0 || !player(g, id).alive) {
    g.turn = nextAlive(g, id); g.remaining = 1; g.attacked = false;
  }
  g.actionCount = 0; g.turnSerial++;
}
function remove(g, p, id) {
  const index = p.hand.findIndex(c => c.id === id);
  assert(index >= 0, '这张牌已经不在你的手中。');
  p.marked = p.marked.filter(x => x !== id);
  return p.hand.splice(index, 1)[0];
}
function eliminate(g, id, killer = null) {
  const p = player(g, id);
  p.alive = false;
  // Current official guide keeps eliminated hands private and outside the discard pile.
  g.retired.push(...p.hand, ...(p.bark ? [p.bark] : []), ...(p.trap ? [p.trap.card] : []), ...(killer ? [killer] : []));
  p.hand = []; p.bark = null; p.trap = null; p.marked = [];
  log(g, `${p.name} 炸毛出局了。`);
  const living = alive(g);
  if (living.length === 1) {
    g.winner = living[0].id; g.phase = 'finished'; g.frames = []; g.prompt = null; g.tasks = [];
    log(g, `${living[0].name} 是最后一只幸存的猫！`);
  } else if (g.turn === id) endTurn(g, id);
}
function danger(g, owner, card, bark = false) {
  const p = player(g, owner);
  if (!p?.alive) return;
  const defuse = p.hand.find(c => c.type === 'defuse');
  if (!defuse) { eliminate(g, owner, bark ? null : card); return; }
  // A player must defuse when able; the interactive choice is where to insert the kitten.
  g.discard.push(remove(g, p, defuse.id));
  log(g, `${p.name} 用掉了一张拆弹。`);
  if (!bark) g.prompt = { type: 'insert', owner, card, label: '拆弹成功，把爆炸猫藏回去', max: g.deck.length };
}
function checkHand(g, owner) {
  const p = player(g, owner);
  if (!p?.alive) return;
  const bombs = p.hand.filter(c => c.type === 'exploding');
  const protectedCount = p.hand.some(c => c.type === 'streaking') ? 1 : 0;
  if (bombs.length > protectedCount) {
    const bomb = remove(g, p, bombs.at(-1).id);
    g.tasks.unshift({ type: 'checkHand', owner });
    danger(g, owner, bomb);
  }
}
function transfer(g, from, to, cardId) {
  const a = player(g, from), b = player(g, to);
  const card = remove(g, a, cardId);
  b.hand.push(card);
  g.tasks.unshift({ type: 'checkHand', owner: from }, { type: 'checkHand', owner: to });
}
function draw(g, owner, bottom = false, bury = false) {
  assert(g.deck.length > 0, '牌堆已空，食谱状态异常。');
  const p = player(g, owner);
  const c = bottom ? g.deck.pop() : g.deck.shift();
  if (bury) {
    g.prompt = { type: 'insert', owner, card: c, label: '把这张牌埋回牌堆', max: g.deck.length };
    log(g, `${p.name} 把抽到的牌埋了起来。`);
    return;
  }
  let receiver = owner;
  if (p.trap) {
    const other = player(g, p.trap.owner);
    if (other?.alive) {
      receiver = other.id;
      g.intel[owner] = { label: '你刚刚转交的牌', cards: [c], at: g.turnSerial };
    }
    g.discard.push(p.trap.card); p.trap = null;
  }
  log(g, receiver === owner ? `${p.name} 抽了一张牌。` : `${p.name} 抽到的牌被 ${player(g, receiver).name} 拿走了。`);
  if (c.type === 'imploding') {
    if (c.faceUp) eliminate(g, receiver, c);
    else {
      c.faceUp = true;
      g.prompt = { type: 'insert', owner: receiver, card: c, label: '内爆猫醒了！正面朝上插回', max: g.deck.length };
    }
  } else {
    player(g, receiver).hand.push(c); checkHand(g, receiver);
  }
}
function validTarget(g, actor, target, needsCards = false) {
  const p = player(g, target);
  assert(p && p.alive && p.id !== actor, '请选择另一位存活玩家。');
  assert(!needsCards || p.hand.length > 0, '这位玩家没有手牌。');
  return p;
}
export function validCombo(cards) {
  if (![2, 3].includes(cards.length)) return false;
  if (cards.every(c => c.type === cards[0].type)) return true;
  const regular = cards.filter(c => c.type !== 'feral');
  return cards.every(c => CARDS[c.type]?.cat) && regular.every(c => c.type === regular[0]?.type);
}
function frame(g, actor, command) {
  g.frames.push({ id: `${g.revision}:frame:${g.frames.length}`, actor, command, cancelled: false, passed: [actor], canNope: command.type !== 'draw',
    title: command.type === 'draw' ? '抽一张牌' : command.type === 'combo' ? `${command.size} 张组合` : cardName(command.card) });
  g.phase = 'reaction';
}
function resolveEffect(g, actor, command, random) {
  const p = player(g, actor);
  if (!p?.alive) return;
  if (command.type === 'draw') {
    g.tasks.unshift({ type: 'draw', owner: actor }, { type: 'endTurn', owner: actor });
    return;
  }
  if (command.type === 'combo') {
    const target = player(g, command.target);
    if (!target?.alive || !target.hand.length) return;
    g.prompt = { type: command.size === 2 ? 'steal' : 'name', owner: actor, target: target.id };
    return;
  }
  const type = command.card.type;
  const target = player(g, command.target);
  switch (type) {
    case 'attack': case 'targeted': {
      const next = type === 'attack' ? nextAlive(g, actor) : target?.id;
      if (!player(g, next)?.alive) break;
      g.remaining = (g.attacked ? g.remaining : 0) + 2;
      g.attacked = true; g.turn = next; g.actionCount = 0; g.turnSerial++;
      log(g, `${player(g, next).name} 要连续行动 ${g.remaining} 回合。`); break;
    }
    case 'personal': g.remaining = g.attacked ? g.remaining + 3 : 3; g.attacked = true; break;
    case 'skip': endTurn(g, actor); break;
    case 'superSkip': g.remaining = 1; endTurn(g, actor); break;
    case 'reverse': if (alive(g).length > 2) g.direction *= -1; endTurn(g, actor); break;
    case 'shuffle': g.deck = shuffled(g.deck, random); break;
    case 'swap': if (g.deck.length > 1) [g.deck[0], g.deck[g.deck.length - 1]] = [g.deck.at(-1), g.deck[0]]; break;
    case 'bottom': case 'bury':
      g.tasks.unshift({ type: 'draw', owner: actor, bottom: type === 'bottom', bury: type === 'bury' }, { type: 'endTurn', owner: actor }); break;
    case 'catomic': {
      const bombs = g.deck.filter(c => c.type === 'exploding');
      g.deck = [...bombs, ...shuffled(g.deck.filter(c => c.type !== 'exploding'), random)];
      log(g, `${bombs.length} 只爆炸猫被放在了牌堆最上面。`); endTurn(g, actor); break;
    }
    case 'see3': case 'see5': case 'alter': case 'alterNow': case 'share':
      g.prompt = { type: 'future', owner: actor, cards: g.deck.slice(0, type === 'see5' ? 5 : 3),
        reorder: !['see3', 'see5'].includes(type), share: type === 'share' ? nextAlive(g, actor) : null };
      break;
    case 'take':
      if (target?.alive && !target.trap) { target.trap = { owner: actor, card: command.card }; g.discard = g.discard.filter(c => c.id !== command.card.id); }
      break;
    case 'mark':
      if (target?.alive && target.hand.length) {
        const c = target.hand[Math.floor(random() * target.hand.length)];
        if (!target.marked.includes(c.id)) target.marked.push(c.id);
        log(g, `${target.name} 的一张 ${cardName(c)} 被标记了。`);
      } break;
    case 'garbage': {
      const owners = alive(g).filter(x => x.hand.length).map(x => x.id);
      if (owners.length) g.prompt = { id: `${g.revision}:garbage`, type: 'garbage', owners, choices: {} }; break;
    }
    case 'barking': {
      const otherInHand = alive(g).find(x => x.hand.some(c => c.type === 'barking'));
      const otherOnTable = alive(g).find(x => x.bark);
      let victim = null, otherCard = null;
      if (otherInHand?.id === actor) { victim = target; otherCard = remove(g, p, p.hand.find(c => c.type === 'barking').id); }
      else if (otherInHand) { victim = otherInHand; otherCard = remove(g, victim, victim.hand.find(c => c.type === 'barking').id); }
      else if (otherOnTable?.id === actor) { victim = target; otherCard = p.bark; p.bark = null; }
      else if (otherOnTable) { victim = otherOnTable; otherCard = victim.bark; victim.bark = null; }
      if (victim) { g.discard.push(otherCard); danger(g, victim.id, null, true); }
      else { p.bark = command.card; g.discard = g.discard.filter(c => c.id !== command.card.id); }
      break;
    }
  }
}
function advance(g, random) {
  while (!g.prompt && g.phase !== 'finished') {
    if (g.tasks.length) {
      const task = g.tasks.shift();
      if (task.type === 'endTurn') endTurn(g, task.owner);
      else if (task.type === 'draw' && player(g, task.owner)?.alive) draw(g, task.owner, task.bottom, task.bury);
      else if (task.type === 'checkHand') checkHand(g, task.owner);
      continue;
    }
    const f = topFrame(g);
    if (f) {
      g.phase = 'reaction';
      if (!alive(g).every(p => f.passed.includes(p.id))) break;
      g.frames.pop();
      if (!f.cancelled) resolveEffect(g, f.actor, f.command, random);
      if (g.frames.length) { topFrame(g).passed = []; topFrame(g).id = `${g.revision}:resume`; }
    } else { g.phase = 'play'; break; }
  }
  if (g.prompt && g.phase !== 'finished') g.phase = 'prompt';
}
function answer(g, actor, action, random) {
  const q = g.prompt;
  assert(q && (q.owner === actor || q.owners?.includes(actor)), '还没轮到你处理这一步。');
  if (q.type === 'garbage') {
    assert(!q.choices[actor], '你已经选好了。');
    assert(player(g, actor).hand.some(c => c.id === action.cardId), '请选择自己的手牌。');
    q.choices[actor] = action.cardId;
    if (!q.owners.every(id => q.choices[id])) return;
    for (const id of q.owners) g.deck.push(remove(g, player(g, id), q.choices[id]));
    g.deck = shuffled(g.deck, random);
    g.tasks.unshift(...q.owners.map(owner => ({ type: 'checkHand', owner })));
    log(g, '大家的牌已经一起洗回牌堆。');
  } else if (q.type === 'insert') {
    assert(Number.isInteger(action.position) && action.position >= 0 && action.position <= g.deck.length, '插入位置无效。');
    g.deck.splice(action.position, 0, q.card);
    log(g, `${player(g, actor).name} 秘密放回了一张牌。`);
  } else if (q.type === 'future') {
    const ids = q.cards.map(c => c.id);
    const order = q.reorder ? action.order : ids;
    assert(Array.isArray(order) && order.length === ids.length && new Set(order).size === ids.length && order.every(id => ids.includes(id)), '请保留全部牌，每张只出现一次。');
    const ordered = order.map(id => q.cards.find(c => c.id === id));
    g.deck.splice(0, ids.length, ...ordered);
    g.intel[actor] = { label: '刚刚看过的牌（之后可能改变）', cards: ordered, at: g.turnSerial };
    if (q.share) g.intel[q.share] = { label: `${player(g, actor).name} 分享的未来（之后可能改变）`, cards: ordered, at: g.turnSerial };
  } else if (q.type === 'steal') {
    const target = player(g, q.target);
    assert(Number.isInteger(action.index) && action.index >= 0 && action.index < target.hand.length, '请选择一张背面牌或标记牌。');
    transfer(g, q.target, actor, target.hand[action.index].id);
    log(g, `${player(g, actor).name} 从 ${target.name} 手里拿走了一张牌。`);
  } else if (q.type === 'name') {
    assert(Object.hasOwn(CARDS, action.cardType), '请选择一种卡牌。');
    const target = player(g, q.target), c = target.hand.find(c => c.type === action.cardType);
    if (c) transfer(g, q.target, actor, c.id);
    log(g, c ? `${player(g, actor).name} 要到了一张 ${cardName(action.cardType)}。` : `${target.name} 没有 ${cardName(action.cardType)}。`);
  }
  g.prompt = null;
}
export function startGame(g, recipeId, random = Math.random) {
  const r = getRecipe(recipeId, g.players.length);
  const fresh = createGame(g.host, player(g, g.host).name);
  Object.assign(g, { ...fresh, revision: g.revision, players: g.players.map(p => ({ ...p, alive: true, hand: [], marked: [], bark: null, trap: null })), recipeId });
  let serial = 0;
  const cards = Object.entries(r.counts).flatMap(([type, n]) => Array.from({ length: n }, () => ({ id: `${++serial}-${type}`, type, ...(type === 'imploding' ? { faceUp: false } : {}) })));
  const dangers = cards.filter(c => ['exploding', 'imploding'].includes(c.type));
  let safe = cards.filter(c => !['exploding', 'imploding'].includes(c.type));
  for (const p of g.players) for (let i = 0; i < r.defuses; i++) {
    const index = safe.findIndex(c => c.type === 'defuse');
    assert(index >= 0, '食谱中拆弹数量不足。'); p.hand.push(...safe.splice(index, 1));
  }
  safe = shuffled(safe, random);
  assert(safe.length >= r.start * g.players.length, '食谱不足以发起手牌。');
  for (const p of g.players) p.hand.push(...safe.splice(0, r.start));
  g.deck = shuffled([...safe, ...dangers], random);
  g.phase = 'play'; g.turn = g.players[0].id;
  log(g, `${r.name} 开锅啦！每人 ${r.start} 张起手牌${r.defuses ? '，另加一张拆弹' : '，没有拆弹'}。`);
}
// A failed command never mutates the authoritative game, including the discard pile.
export function act(state, actor, action, random = Math.random) {
  assert(action && typeof action === 'object' && typeof action.type === 'string', '操作格式不正确。');
  const g = structuredClone(state), p = player(g, actor);
  assert(p, '没有找到你的座位。');
  if (action.type === 'start') {
    assert(actor === g.host && ['lobby', 'finished'].includes(g.phase), '只有房主可以开局。');
    assert(g.players.every(x => x.online), '等离线朋友回来，再一起开局。');
    startGame(g, action.recipeId || g.recipeId, random);
  } else if (action.type === 'lobby') {
    assert(actor === g.host && g.phase === 'finished', '本局还没结束。');
    g.phase = 'lobby'; g.winner = null;
  } else {
    assert(!['lobby', 'finished'].includes(g.phase) && p.alive, '现在不能进行这个操作。');
    if (action.type === 'answer') answer(g, actor, action, random);
    else if (action.type === 'pass') {
      const f = topFrame(g);
      assert(g.phase === 'reaction' && f, '当前没有等待响应的行动。');
      assert(!f.passed.includes(actor), '你已经放行了。'); f.passed.push(actor);
    } else if (action.type === 'draw') {
      assert(g.phase === 'play' && g.turn === actor, '请等待你的回合。');
      frame(g, actor, { type: 'draw' });
    } else if (action.type === 'play') {
      const c = p.hand.find(c => c.id === action.cardId);
      assert(c, '这张牌已经不在手中了。');
      const def = CARDS[c.type];
      assert(g.phase !== 'prompt', '请先完成正在处理的牌。');
      assert(!def.passive && !def.cat, '这张牌不能单独主动打出。');
      if (c.type === 'nope') {
        const f = topFrame(g);
        assert(g.phase === 'reaction' && f?.canNope, '不能否决抽牌或已经开始的效果。');
        g.discard.push(remove(g, p, c.id)); f.cancelled = !f.cancelled; f.passed = [actor]; f.id = `${g.revision}:nope`;
        log(g, `${p.name} 打出才不要！${f.cancelled ? '取消' : '恢复'}了 ${f.title}。`);
      } else {
        assert((g.phase === 'play' && g.turn === actor) || (c.type === 'alterNow' && ['play', 'reaction'].includes(g.phase)), '这张牌要在自己的回合打出。');
        if (def.target) validTarget(g, actor, action.target, c.type === 'mark');
        if (c.type === 'take') assert(!player(g, action.target).trap, '这位玩家面前已经有截牌了。');
        if (c.type === 'bury') assert(!p.trap, '面前有「这张归我」时不能埋牌。');
        if (c.type === 'barking' && (p.bark || p.hand.filter(x => x.type === 'barking').length === 2)) validTarget(g, actor, action.target);
        g.discard.push(remove(g, p, c.id)); g.actionCount++;
        log(g, `${p.name} 打出 ${cardName(c)}${action.target ? ` → ${player(g, action.target).name}` : ''}。`);
        const command = { type: 'card', card: c, target: action.target };
        if (c.type === 'barking') resolveEffect(g, actor, command, random);
        else frame(g, actor, command);
      }
    } else if (action.type === 'combo') {
      assert(g.phase === 'play' && g.turn === actor, '组合牌只能在自己的回合使用。');
      assert(Array.isArray(action.ids) && new Set(action.ids).size === action.ids.length, '请选择不同的手牌。');
      const cards = action.ids.map(id => p.hand.find(c => c.id === id));
      assert(cards.every(Boolean) && validCombo(cards), '需要两张或三张同名牌，万用猫只能代替普通猫。');
      assert(!cards.some(c => ['exploding', 'imploding'].includes(c.type)), '危险猫不能当作普通组合弃掉。');
      validTarget(g, actor, action.target, true);
      g.discard.push(...cards.map(c => remove(g, p, c.id))); g.actionCount++;
      log(g, `${p.name} 使用了 ${cards.length} 张组合 → ${player(g, action.target).name}。`);
      frame(g, actor, { type: 'combo', target: action.target, size: cards.length });
    } else throw new Error('不支持这个操作。');
    advance(g, random);
  }
  g.revision++;
  return g;
}
export function viewFor(g, me) {
  const self = player(g, me);
  assert(self, '未知玩家。');
  const f = topFrame(g), q = g.prompt;
  let prompt = null;
  if (q) {
    if (q.type === 'garbage') prompt = { id: q.id, type: q.type, owners: [...q.owners], submitted: Object.keys(q.choices), choice: q.choices[me] || null };
    else if (q.owner === me) prompt = structuredClone(q);
    else prompt = { type: 'waiting', owner: q.owner };
  }
  return { version: g.version, revision: g.revision, me, host: g.host, phase: g.phase, recipeId: g.recipeId,
    players: g.players.map(p => ({ id: p.id, name: p.name, bot: p.bot, online: p.online, alive: p.alive,
      count: p.hand.length, ...(p.id === me ? { hand: structuredClone(p.hand) } : {}),
      marked: p.hand.flatMap((c, index) => p.marked.includes(c.id) ? [{ index, card: structuredClone(c) }] : []),
      bark: !!p.bark, trap: p.trap ? { owner: p.trap.owner } : null })),
    deckCount: g.deck.length, deckTop: g.deck[0]?.faceUp ? structuredClone(g.deck[0]) : null,
    discardTop: g.discard.length ? structuredClone(g.discard.at(-1)) : null, discardCount: g.discard.length,
    turn: g.turn, remaining: g.remaining, attacked: g.attacked, direction: g.direction, winner: g.winner,
    reaction: f ? { id: f.id, actor: f.actor, title: f.title, cancelled: f.cancelled, passed: [...f.passed], canNope: f.canNope, depth: g.frames.length } : null,
    prompt, intel: structuredClone(g.intel[me] || null), log: structuredClone(g.log), actionCount: g.actionCount, turnSerial: g.turnSerial };
}
