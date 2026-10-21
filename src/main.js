import './style.css';
import { CARDS, cardName, SOURCE_RULES } from './cards.js';
import { RECIPES, getRecipe } from './recipes.js';
import { cleanName, validCombo } from './game.js';
import { Room } from './room.js';
import { readSession } from './session.js';
import { catArt, cardBack, AVATAR_COLORS } from './art.js';

const $ = s => document.querySelector(s);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const button = (text, action, cls = '', disabled = false, extra = '') => `<button type="button" class="${cls}" data-act="${action}" ${disabled ? 'disabled' : ''} ${extra}>${text}</button>`;
const storageGet = key => { try { return sessionStorage.getItem(key); } catch { return null; } };
const invitedRoom = new URL(location.href).searchParams.get('room')?.toUpperCase() || '';
let nickname = storageGet('kitten-name') || ['桃桃', '团子', '布丁', '奶盖'][Math.floor(Math.random() * 4)] + Math.floor(Math.random() * 900 + 100);
let room = null, selected = [], modal = null, joinOpen = !!invitedRoom, homeRecipe = 'exploding-kittens-classic-mode';
let targetAction = null, futureKey = '', futureOrder = [], insertKey = '', insertPosition = 0;
let recipeFilter = '全部', toastTimer;
const compactHand = matchMedia('(max-width: 700px)');
const colors = p => AVATAR_COLORS[Math.max(0, room?.view?.players.findIndex(x => x.id === p.id) || 0) % AVATAR_COLORS.length];
const playerName = id => room?.view?.players.find(p => p.id === id)?.name || '朋友';
const me = () => room?.view?.players.find(p => p.id === room.me);
const blocked = () => room?.pending || room?.status !== 'connected' || room?.view?.players.some(p => p.alive && !p.online);
function notice(text) {
  $('#toast').textContent = text; $('#toast').classList.toggle('visible', !!text);
  clearTimeout(toastTimer); if (text) toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5500);
}
function changed(next) {
  room = next;
  if (!next) { selected = []; modal = null; history.replaceState({}, '', location.pathname); }
  render();
}
function startRoom(role) {
  try {
    nickname = cleanName($('#nickname')?.value || nickname);
    try { sessionStorage.setItem('kitten-name', nickname); } catch {}
    const code = $('#room-input')?.value.trim().toUpperCase() || invitedRoom;
    room = new Room({ role, name: nickname, code, onChange: changed, onNotice: notice });
    room.start();
    if (role === 'practice') { room.addBot(); room.addBot(); room.recipe(homeRecipe); }
  } catch (e) { room?.stop(); room = null; notice(e.message); render(); }
}
function cardMarkup(c, { selectable = false, small = false, hidden = false, index = null } = {}) {
  if (hidden) return `<div class="playing-card card-back ${small ? 'small' : ''}">${cardBack()}</div>`;
  const def = CARDS[c.type];
  const inner = `<span class="card-title">${escape(def.name)}</span><span class="card-picture">${catArt(def.color, def.symbol, Object.keys(CARDS).indexOf(c.type))}</span><span class="card-caption">${escape(def.text)}</span>`;
  if (selectable) return `<button id="hand-card-${escape(c.id)}" class="playing-card ${def.color} ${selected.includes(c.id) ? 'selected' : ''}" data-card="${escape(c.id)}" aria-pressed="${selected.includes(c.id)}" aria-label="${escape(def.name)}：${escape(def.text)}">${inner}</button>`;
  return `<div class="playing-card ${def.color} ${small ? 'small' : ''}">${index !== null ? `<span class="position-number">第 ${index + 1} 张</span>` : ''}${inner}</div>`;
}
function handMarkup(cards = []) {
  if (!cards.length) return '<p class="empty-hand">爪爪空空的，等下一次抽牌。</p>';
  const rows = Math.ceil(cards.length / (compactHand.matches ? 8 : 16));
  const perRow = Math.ceil(cards.length / rows);
  return Array.from({ length: rows }, (_, row) => {
    const group = cards.slice(row * perRow, (row + 1) * perRow);
    const spread = Math.min(32, (group.length - 1) * 5);
    return `<div class="hand-fan" style="--fan-gaps:${group.length - 1}">${group.map((c, i) => {
      const x = group.length === 1 ? 0 : i / (group.length - 1) - .5;
      return `<div class="hand-slot ${selected.includes(c.id) ? 'is-selected' : ''}" style="--fan-x:${x};--fan-angle:${x * spread}deg;--fan-y:${x * x * Math.min(112, (group.length - 1) * 20)}px;--fan-order:${i}">${cardMarkup(c, { selectable: true })}</div>`;
    }).join('')}</div>`;
  }).join('');
}
function header() {
  const online = room?.status === 'connected';
  return `<header class="topbar"><a class="brand" href="${escape(location.pathname)}" ${room ? 'data-act="ask-leave"' : ''}><span class="brand-cat">${catArt('peach', 'paw', 1)}</span><span>爆炸猫<span class="brand-sub">好友厨房</span></span></a><nav>${room ? `<span class="connection ${online ? '' : 'reconnecting'}">${room.role === 'practice' ? '陪练在场' : online ? '已连接' : '正在连接…'}</span>${button('邀请', 'invite', 'quiet', room.role === 'practice')}` : ''}${button('玩法', 'rules', 'quiet')}${button(room ? '离开' : '食谱', room ? 'ask-leave' : 'recipes', 'quiet')}</nav></header>`;
}
function home() {
  return `<div class="home-screen">${header()}<section class="home-content"><div class="home-copy"><p class="handwritten">小心，这间厨房有点炸。</p><h1>今晚，<br>一起炸毛吧。</h1><p class="intro">挑一道灾难食谱，喊上你的朋友。<br>偷点好牌，藏点坏心思，做最后一只猫。</p><div class="home-form"><label for="nickname">今天怎么称呼你？</label><input id="nickname" maxlength="16" value="${escape(nickname)}" autocomplete="off" placeholder="给自己起个猫咪昵称"/><div class="home-actions">${button('开一间好友厨房 <span aria-hidden="true">↗</span>', 'create', 'primary large')}${button('加入朋友的房间', 'join-toggle', 'secondary large')}</div>${joinOpen ? `<form id="join-form" class="join-form"><label class="sr-only" for="room-input">八位房间码</label><input id="room-input" maxlength="8" value="${escape(invitedRoom)}" placeholder="输入 8 位房间码" autocomplete="off" autocapitalize="characters"/><button class="primary" type="submit">加入</button></form>` : ''}${button('先和猫咪陪练玩一局 <span aria-hidden="true">→</span>', 'practice', 'practice-link')}</div><p class="home-note">2–5 位朋友 · 无需注册 · 手机也能玩</p></div><div class="home-art" aria-hidden="true"><div class="recipe-note"><span>今日主厨推荐</span><strong>拆弹配小鱼干</strong><span>危险程度：刚刚好</span><svg viewBox="0 0 100 35"><path d="M5 18q20-28 40 0T85 18" fill="none" stroke="currentColor" stroke-width="3"/></svg></div><div class="art-plate"></div><div class="hero-cat">${catArt('peach', 'bomb', 1, true)}</div><div class="hero-friend">${catArt('mint', 'snip', 0)}</div><div class="hero-card one">${cardBack()}</div><div class="hero-card two">${cardBack()}</div><span class="art-caption">这次绝对不是我放的。</span></div></section><footer class="home-footer"><span>一桌朋友，一点小坏心。</span><span>非官方好友同乐版 · 原创猫咪插画</span></footer></div>`;
}
function seat(p, i, lobby = false) {
  const active = room.view.turn === p.id && !lobby && p.alive;
  return `<article class="seat ${active ? 'active' : ''} ${p.alive ? '' : 'eliminated'} ${!p.online ? 'offline' : ''}" data-player="${escape(p.id)}"><div class="avatar ${AVATAR_COLORS[i]}">${catArt(AVATAR_COLORS[i], p.alive ? 'paw' : 'vortex', i)}</div><div class="seat-info"><strong>${escape(p.name)}${p.id === room.me ? '<span class="you-tag">你</span>' : ''}</strong><span>${!p.online ? '等你回来' : lobby ? p.bot ? '猫咪陪练' : p.id === room.view.host ? '本桌主厨' : '准备开饭' : !p.alive ? '已经炸毛' : `${p.count} 张手牌${active ? ' · 正在行动' : ''}`}</span></div>${lobby && room.game && p.id !== room.me ? button('×', 'remove', 'remove-seat', false, `data-id="${escape(p.id)}" aria-label="移除 ${escape(p.name)}"`) : ''}${p.bark ? '<span class="seat-status">吠叫猫在等你</span>' : ''}${p.trap ? `<span class="seat-status">下一张归 ${escape(playerName(p.trap.owner))}</span>` : ''}${p.marked.length ? `<div class="marked-cards">${p.marked.map(x => `<span title="公开标记牌">${escape(cardName(x.card))}</span>`).join('')}</div>` : ''}</article>`;
}
function lobby() {
  const v = room.view, r = RECIPES.find(r => r.id === v.recipeId), n = v.players.length;
  const suitable = n >= r.min && n <= r.max;
  return `<div class="room-screen">${header()}<section class="lobby-heading"><div><p class="handwritten">${room.role === 'practice' ? '先热热爪，再找朋友。' : '小厨房开张，朋友请入座。'}</p><h1>还差一点热闹。</h1></div><div class="invite-ticket"><span>${room.role === 'practice' ? '猫咪陪练桌' : '把房间码告诉朋友'}</span><strong class="room-code">${room.role === 'practice' ? '本地练习' : escape(room.room)}</strong>${room.role !== 'practice' ? button('复制邀请链接', 'invite', 'text-button') : '<span>不需要联网服务</span>'}</div></section><div class="lobby-layout"><section class="lobby-guests"><div class="section-line"><h2>今天的饭搭子</h2><span>${n} / 5 已入座</span></div><div class="seat-list">${v.players.map((p, i) => seat(p, i, true)).join('')}${n < 5 ? `<div class="empty-seat"><span class="empty-cat">${catArt('sky', 'paw', 1)}</span><div><strong>这里留给一位朋友</strong><span>${room.game ? '也可以叫猫咪来陪练' : '等房主邀请更多朋友'}</span></div>${room.game ? button('+ 猫咪陪练', 'add-bot', 'secondary') : ''}</div>` : ''}</div><div class="lobby-tip"><strong>开锅前的小提醒</strong><p>先出牌，最后抽牌。炸弹抽到你手里之前，一切都还有转机。</p></div></section><section class="recipe-preview ${r.color}"><div class="section-line"><span>本局食谱</span>${room.game ? button('换一道 ↗', 'recipes', 'text-button') : '<span>由房主挑选</span>'}</div><div class="recipe-illustration">${catArt(r.color, r.id.includes('black-hole') ? 'vortex' : r.id.includes('attack') ? 'bolt' : 'taco', 1, true)}</div><h2>${escape(r.name)}</h2><p>${escape(r.description)}</p><div class="recipe-meta"><span>${r.min === r.max ? r.min : `${r.min}–${r.max}`} 人</span><span>约 ${r.minutes} 分钟</span><span>${r.level}</span></div>${suitable ? `<p class="starting-note">每人 ${getRecipe(r.id, n).start} 张起手牌${r.defuses ? ' ＋ 1 张拆弹' : ' · 没有拆弹'}</p>` : `<p class="starting-note warning">这道食谱需要 ${r.min}–${r.max} 人，换一道或调整座位。</p>`}${room.game ? button('都到齐了，开锅！', 'start', 'primary large', !suitable || blocked()) : '<div class="waiting-label">等房主开锅…</div>'}</section></div></div>`;
}
function promptPanel(v) {
  const q = v.prompt;
  if (!q) return '';
  if (q.type === 'waiting') return `<div class="action-message"><strong>${escape(playerName(q.owner))} 正在秘密操作</strong><span>把好奇心收起来，马上就好。</span></div>`;
  if (q.type === 'garbage') {
    const mine = q.owners.includes(room.me) && !q.submitted.includes(room.me);
    return `<div class="action-message"><strong>${mine ? '选一张手牌，放回牌堆' : '等大家把牌选好'}</strong><span>${q.submitted.length} / ${q.owners.length} 已选好，其他人看不到你的选择。</span></div>${mine ? button('就放这张', 'garbage-answer', 'primary', selected.length !== 1 || blocked()) : ''}`;
  }
  if (q.type === 'insert') {
    if (insertKey !== q.card.id) { insertKey = q.card.id; insertPosition = 0; }
    insertPosition = Math.min(insertPosition, q.max);
    return `<div class="insert-panel"><div class="insert-card">${cardMarkup(q.card, { small: true })}</div><div class="insert-controls"><h2>${escape(q.label)}</h2><p>这个位置只有你知道，不会重新洗牌。</p><label for="insert-position" id="position-label">${positionLabel(insertPosition, q.max)}</label><input type="range" id="insert-position" min="0" max="${q.max}" value="${Math.min(insertPosition, q.max)}"/><div class="range-labels"><span>牌堆顶</span><span>牌堆底</span></div>${button('悄悄放回去', 'insert-answer', 'primary', blocked())}</div></div>`;
  }
  if (q.type === 'future') {
    const key = q.cards.map(c => c.id).join(':');
    if (futureKey !== key) { futureKey = key; futureOrder = q.cards.map(c => c.id); }
    return `<div class="future-panel"><div><h2>${q.reorder ? '未来，交给你安排' : '偷偷看一眼未来'}</h2><p>从左到右是牌堆顶端的顺序。${q.share ? `确认后会分享给 ${escape(playerName(q.share))}。` : '只有你看得到。'}</p></div><div class="future-cards">${futureOrder.map((id, i) => `<div>${cardMarkup(q.cards.find(c => c.id === id), { small: true, index: i })}${q.reorder ? `<div class="reorder-buttons">${button('←', 'reorder-left', 'quiet', i === 0, `data-index="${i}" aria-label="向牌堆顶移动"`)}${button('→', 'reorder-right', 'quiet', i === futureOrder.length - 1, `data-index="${i}" aria-label="向牌堆底移动"`)}</div>` : ''}</div>`).join('')}</div>${button(q.reorder ? '按这个顺序放回' : '看好了，放回去', 'future-answer', 'primary', blocked())}</div>`;
  }
  if (q.type === 'steal') {
    const target = v.players.find(p => p.id === q.target);
    return `<div class="steal-panel"><h2>从 ${escape(target.name)} 手里挑一张</h2><p>只有标记牌可以看见，其余都凭爪气。</p><div class="steal-cards">${Array.from({ length: target.count }, (_, index) => {
      const known = target.marked.find(m => m.index === index);
      return `<button class="steal-choice" data-act="steal-answer" data-index="${index}" aria-label="拿第 ${index + 1} 张${known ? `：${escape(cardName(known.card))}` : '背面牌'}" ${blocked() ? 'disabled' : ''}>${known ? cardMarkup(known.card, { small: true }) : cardMarkup(null, { hidden: true, small: true })}</button>`;
    }).join('')}</div></div>`;
  }
  if (q.type === 'name') return `<form id="name-card-form" class="name-card-form"><label for="requested-card">向 ${escape(playerName(q.target))} 要哪种牌？</label><select id="requested-card">${Object.entries(CARDS).map(([k, c]) => `<option value="${k}" ${k === 'defuse' ? 'selected' : ''}>${escape(c.name)}</option>`).join('')}</select><button class="primary" type="submit" ${blocked() ? 'disabled' : ''}>点名要这张</button></form>`;
  return '';
}
function positionLabel(p, max) { return p === 0 ? '放在最上面，下一抽就是它' : p === max ? '放在最下面' : `上面留 ${p} 张牌，再放入这张`; }
function selectedPanel(v) {
  const hand = me()?.hand || [], chosen = selected.map(id => hand.find(c => c.id === id)).filter(Boolean);
  if (!chosen.length) return `<div class="selection-empty"><strong>把小坏心思握在手里</strong><span>点一张看效果；选同名两张或三张可以组合。</span></div>`;
  const single = chosen.length === 1, def = CARDS[chosen[0].type];
  const can = single ? !def.passive && !def.cat && (chosen[0].type === 'nope' ? v.phase === 'reaction' && v.reaction.canNope : chosen[0].type === 'alterNow' ? ['play', 'reaction'].includes(v.phase) : v.phase === 'play' && v.turn === room.me) : validCombo(chosen) && v.phase === 'play' && v.turn === room.me;
  return `<div class="selected-description"><strong>${single ? escape(def.name) : `${chosen.length} 张组合`}</strong><span>${single ? escape(def.text) : chosen.length === 2 ? '从另一位玩家手中，挑走一张牌。' : '向另一位玩家点名索要一种牌；没有就拿不到。'}</span></div><div class="selection-buttons">${button('取消', 'clear', 'quiet')}${button(single ? '打出这张' : '使用组合', 'play-selected', 'primary', !can || blocked() || !me().alive)}</div>`;
}
function gameScreen() {
  const v = room.view, r = RECIPES.find(r => r.id === v.recipeId), self = me();
  const offline = v.players.filter(p => p.alive && !p.online);
  let status = v.phase === 'finished' ? `${playerName(v.winner)} 赢啦！` : v.phase === 'reaction' ? `${playerName(v.reaction.actor)} 想要${v.reaction.title}` : v.phase === 'prompt' ? '一点小秘密，稍等一下' : v.turn === room.me ? '轮到你啦，慢慢挑' : `${playerName(v.turn)} 的回合`;
  return `<div class="game-screen">${header()}<section class="game-info"><div><h1>${escape(r.name)}</h1><span>${v.direction === 1 ? '顺时针' : '逆时针'} ↻ · ${v.players.filter(p => p.alive).length} 只猫还在场</span></div><div class="table-tools">${button('牌局记录', 'log', 'quiet')}${button('看过的牌', 'intel', 'quiet', !v.intel)}${button('卡牌图鉴', 'cards', 'quiet')}</div></section>${offline.length || room.status !== 'connected' ? `<div class="connection-banner" role="status">${room.status !== 'connected' ? '正在恢复连接，牌局会原样等你。' : `正在等 ${escape(offline.map(p => p.name).join('、'))} 回来，操作已暂停。`}</div>` : ''}<section class="table-stage"><div class="opponents">${v.players.filter(p => p.id !== room.me).map(p => seat(p, v.players.findIndex(x => x.id === p.id))).join('')}</div><div class="table-felt"><div class="table-stitch"></div><div class="table-label">猫咪厨房 <span>小心烫爪</span></div><div class="deck-area"><div class="deck-column"><button id="draw" data-act="draw" class="draw-pile ${v.deckTop ? 'danger-pile' : ''}" ${v.phase !== 'play' || v.turn !== room.me || !self.alive || blocked() ? 'disabled' : ''} aria-label="抽一张牌，结束回合">${v.deckTop ? cardMarkup(v.deckTop, { small: true }) : cardBack()}<span class="deck-badge">${v.deckCount}</span></button><span>抽牌堆 · ${v.deckCount} 张</span></div><div class="discard-column">${v.discardTop ? cardMarkup(v.discardTop, { small: true }) : `<div class="discard-empty"><span>爪印留这里</span><span>弃牌区</span></div>`}<span>弃牌堆 · ${v.discardCount} 张</span></div></div><div class="table-status"><strong>${escape(status)}</strong>${v.phase === 'play' ? `<span>${v.remaining > 1 || v.attacked ? `还需完成 ${v.remaining} 个回合 · ` : ''}先出牌，最后抽牌。</span>` : ''}${v.phase === 'finished' ? `<span>小厨房没炸，友谊应该也还在。</span>${room.game ? button('再来一锅', 'back-lobby', 'primary') : '<span>等房主安排下一局</span>'}` : ''}</div></div></section><section class="action-panel ${v.phase === 'prompt' ? 'with-prompt' : ''}" aria-live="polite">${v.phase === 'prompt' ? promptPanel(v) : v.phase === 'reaction' ? `<div class="reaction-line"><div><strong>${v.reaction.cancelled ? '这次行动被否决了' : `有人要${escape(v.reaction.title)}`}</strong><span>${v.reaction.canNope ? '可用「才不要」反制，或用「立刻改变未来」。' : '抽牌不能否决，但可以「立刻改变未来」。'} ${v.reaction.passed.length} / ${v.players.filter(p => p.alive).length} 已放行</span></div>${self.alive && !v.reaction.passed.includes(room.me) ? button('放行，继续吧', 'pass', 'primary', blocked()) : '<span class="waiting-label">等朋友响应…</span>'}</div>` : v.phase === 'finished' ? '<div class="action-message"><strong>这一锅，收工。</strong><span>可以翻看牌局记录，再来一道不一样的食谱。</span></div>' : selectedPanel(v)}</section>${v.phase === 'reaction' && selected.length ? `<section class="reaction-selection">${selectedPanel(v)}</section>` : ''}<section class="hand-zone"><div class="hand-heading"><div class="self-avatar ${colors(self)}">${catArt(colors(self), 'paw', 1)}</div><div><strong>${escape(self.name)} <span>你的手牌</span></strong><p>${self.alive ? `${self.count} 张 · ${self.trap ? `下一抽交给 ${escape(playerName(self.trap.owner))}` : '只有你看得到'}` : '已经出局 · 可以继续看朋友们的热闹'}</p></div>${v.phase === 'play' && v.turn === room.me && self.alive ? button('抽牌，结束回合', 'draw', 'primary draw-button', blocked()) : ''}</div><div class="hand" aria-label="你的手牌">${handMarkup(self.hand)}</div></section></div>`;
}
function dialog() {
  if (!modal) return '';
  let title = '', content = '', wide = false;
  if (modal === 'rules') {
    title = '开锅前，认识一下规则'; content = `<div class="rules-copy"><p><strong>目标只有一个：做最后一只没炸毛的猫。</strong></p><ol><li>选择食谱，按人数发牌；不同食谱的起手牌和拆弹数量不同。</li><li>轮到你时，先出零张或多张牌，最后抽一张。也可以用跳过、攻击等效果避免抽牌。</li><li>抽到爆炸猫：自动消耗拆弹，再由你秘密选择插回位置。没有拆弹就出局。</li><li>两张同名牌可以偷牌；三张同名牌可以点名索牌。万用猫只能代替普通猫牌。</li><li>行动执行前，大家可以放行、使用 Nope 或立刻改变未来。Nope 可以被再次否决。</li></ol><p><strong>容易忘：</strong>普通跳过只减一回合；攻击可以累加；正面内爆猫不能拆弹；僵尸猫只是普通猫牌。</p><p>联机由房主维持牌局。刷新当前标签页可以恢复；房主关闭厨房后其他人无法接管。</p><a href="${SOURCE_RULES}" target="_blank" rel="noreferrer">查阅官方完整规则 ↗</a></div>`;
  } else if (modal === 'recipes') {
    title = '今晚，想吃哪道灾难？'; wide = true;
    const n = room?.view?.players.length;
    content = `<p>18 道配方，同一间小厨房。${n ? `当前 ${n} 人，可用食谱已标出。` : '进入房间后，可以根据人数再挑选。'}</p><div class="recipe-filters">${['全部', '入门', '进阶', '刺激'].map(x => button(x, 'recipe-filter', recipeFilter === x ? 'filter active' : 'filter', false, `data-filter="${x}"`)).join('')}</div><div class="recipe-grid">${RECIPES.filter(r => recipeFilter === '全部' || r.level === recipeFilter).map(r => {
      const suitable = !n || n >= r.min && n <= r.max;
      return `<article class="recipe-option ${r.color}"><div class="recipe-option-art">${catArt(r.color, r.id.includes('black') ? 'vortex' : r.id.includes('attack') ? 'bolt' : 'taco', 1)}</div><h3>${r.name}</h3><span>${r.min === r.max ? r.min : `${r.min}–${r.max}`} 人 · ${r.minutes} 分钟</span><p>${r.description}</p><div>${button(suitable ? '就选这道' : '人数不合适', 'choose-recipe', 'secondary', !suitable || (!!room && (!room.game || room.view.phase !== 'lobby')), `data-id="${r.id}"`)}${button('配牌', 'ingredients', 'quiet', false, `data-id="${r.id}"`)}</div></article>`;
    }).join('')}</div>`;
  } else if (modal.startsWith('ingredients:')) {
    const r = RECIPES.find(r => r.id === modal.split(':')[1]); title = r.name;
    const n = Math.min(r.max, Math.max(r.min, room?.view?.players.length || r.min)), spec = getRecipe(r.id, n);
    content = `<p>${n} 人配方 · 每人 ${spec.start} 张起手牌${spec.defuses ? '，另加 1 张拆弹' : '，没有拆弹'}。</p><table class="ingredients"><thead><tr><th>卡牌</th><th>总张数</th></tr></thead><tbody>${Object.entries(spec.counts).map(([type, n]) => `<tr><td>${cardName(type)}</td><td>${n}</td></tr>`).join('')}</tbody></table><p>数量包含发给玩家的牌。中文食谱名为本项目趣味译名。</p><a href="${r.source}" target="_blank" rel="noreferrer">查看配方来源 ↗</a>`;
  } else if (modal === 'cards') {
    title = '猫咪卡牌图鉴'; wide = true; content = `<div class="card-guide">${Object.entries(CARDS).map(([type, c]) => `<article>${cardMarkup({ type }, { small: true })}<p>${escape(c.english)}<br>卡池 ${c.count} 张</p></article>`).join('')}</div>`;
  } else if (modal === 'log') {
    title = '厨房里发生了什么'; content = `<ol class="game-log">${room.view.log.map(l => `<li>${escape(l.text)}</li>`).join('')}</ol>`;
  } else if (modal === 'intel') {
    title = room.view.intel?.label || '还没有看过牌'; content = `<p>这是你之前获知的信息，并非实时牌堆；洗牌、插牌和其他操作可能已改变顺序。</p><div class="future-cards">${room.view.intel?.cards.map((c, index) => cardMarkup(c, { small: true, index })).join('') || ''}</div>`;
  } else if (modal === 'target') {
    title = '把这点小坏心思送给谁？'; content = `<div class="target-list">${room.view.players.filter(p => p.id !== room.me && p.alive &&
      (targetAction.type === 'combo' ? p.count > 0 : targetAction.cardType === 'mark' ? p.count > 0 : targetAction.cardType === 'take' ? !p.trap : true)).map(p => `<button class="target-option" data-act="target" data-id="${escape(p.id)}"><span class="avatar ${colors(p)}">${catArt(colors(p), 'paw', 1)}</span><strong>${escape(p.name)}</strong><span>${p.count} 张牌</span></button>`).join('') || '<p>暂时没有可选目标。</p>'}</div>`;
  } else if (modal === 'leave') {
    title = room.role === 'host' ? '要关掉这间厨房吗？' : '要先离开厨房吗？';
    content = `<p>${room.role === 'host' ? '所有朋友都会离开这局。刷新页面可以恢复，主动关闭则会结束房间。' : room.role === 'practice' ? '这局练习会结束。' : '进行中的牌局会等你回来；可用原房间码在当前标签页重新加入。'}</p><div class="dialog-actions">${button('再玩一会儿', 'close-modal', 'secondary')}${button(room.role === 'host' ? '关闭厨房' : '离开', 'leave', 'primary')}</div>`;
  }
  return `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-heading"><h2 id="dialog-title">${escape(title)}</h2>${button('×', 'close-modal', 'modal-close', false, 'aria-label="关闭窗口"')}</div>${content}</section></div>`;
}
function render() {
  const focused = document.activeElement, focusId = focused?.id, selectionStart = focused?.selectionStart;
  const modalScroll = $('.modal')?.scrollTop || 0;
  const previousModal = !!$('.modal');
  if (room?.view) selected = selected.filter(id => me()?.hand?.some(c => c.id === id));
  const content = !room ? home() : !room.view ? `<div class="room-screen">${header()}<div class="connecting-screen">${catArt('sky', 'paw', 1)}<h1>正在找朋友的厨房…</h1><p>房间 ${escape(room.room)} · 首次连接可能需要几秒。</p>${button('取消连接', 'leave', 'secondary')}</div></div>` : room.view.phase === 'lobby' ? lobby() : gameScreen();
  $('#app').innerHTML = content + dialog();
  document.body.dataset.phase = room?.view?.phase || 'home'; document.body.dataset.connection = room?.status || 'home';
  if ($('.modal')) $('.modal').scrollTop = modalScroll;
  if (focusId && document.getElementById(focusId)) {
    const el = document.getElementById(focusId); el.focus({ preventScroll: true });
    if (typeof selectionStart === 'number' && el.setSelectionRange && !['range', 'number'].includes(el.type)) el.setSelectionRange(selectionStart, selectionStart);
  } else if (modal && !previousModal) $('.modal-close')?.focus({ preventScroll: true });
}
function send(action) { selected = []; futureKey = ''; insertKey = ''; modal = null; room?.send(action); render(); }
function playSelected() {
  const hand = me().hand, cards = selected.map(id => hand.find(c => c.id === id)).filter(Boolean);
  if (!cards.length) return;
  targetAction = cards.length > 1 ? { type: 'combo', ids: cards.map(c => c.id) } : { type: 'play', cardId: cards[0].id, cardType: cards[0].type };
  const needsTarget = cards.length > 1 || CARDS[cards[0].type].target || (cards[0].type === 'barking' && (me().bark || hand.filter(c => c.type === 'barking').length === 2));
  if (needsTarget) { modal = 'target'; render(); } else send(targetAction);
}
$('#app').addEventListener('click', async event => {
  const card = event.target.closest('[data-card]') || event.target.closest('.hand-slot')?.querySelector('[data-card]');
  if (card) {
    const id = card.dataset.card, hand = me().hand;
    if (selected.includes(id)) selected = selected.filter(x => x !== id);
    else if (room.view.prompt?.type === 'garbage') selected = [id];
    else { const ids = [...selected, id]; selected = ids.length <= 3 && (ids.length === 1 || validCombo(ids.map(x => hand.find(c => c.id === x)))) ? ids : [id]; }
    render(); return;
  }
  const el = event.target.closest('[data-act]'); if (!el || el.disabled) return;
  event.preventDefault(); const action = el.dataset.act;
  if (action === 'create') startRoom('host');
  else if (action === 'practice') startRoom('practice');
  else if (action === 'join-toggle') { joinOpen = !joinOpen; render(); $('#room-input')?.focus(); }
  else if (['rules', 'recipes', 'cards', 'log', 'intel'].includes(action)) { modal = action; render(); }
  else if (action === 'close-modal') { modal = null; render(); }
  else if (action === 'ask-leave') { modal = 'leave'; render(); }
  else if (action === 'leave') { room?.stop(); changed(null); }
  else if (action === 'add-bot') room.addBot();
  else if (action === 'remove') room.removePlayer(el.dataset.id);
  else if (action === 'start') send({ type: 'start', recipeId: room.view.recipeId });
  else if (action === 'back-lobby') send({ type: 'lobby' });
  else if (action === 'draw') send({ type: 'draw' });
  else if (action === 'pass') send({ type: 'pass' });
  else if (action === 'clear') { selected = []; render(); }
  else if (action === 'play-selected') playSelected();
  else if (action === 'target') send({ ...targetAction, target: el.dataset.id });
  else if (action === 'insert-answer') send({ type: 'answer', position: insertPosition });
  else if (action === 'future-answer') send({ type: 'answer', order: futureOrder });
  else if (action === 'garbage-answer') send({ type: 'answer', cardId: selected[0] });
  else if (action === 'steal-answer') send({ type: 'answer', index: Number(el.dataset.index) });
  else if (action.startsWith('reorder-')) {
    const i = Number(el.dataset.index), j = i + (action === 'reorder-left' ? -1 : 1);
    [futureOrder[i], futureOrder[j]] = [futureOrder[j], futureOrder[i]]; render();
  } else if (action === 'recipe-filter') { recipeFilter = el.dataset.filter; render(); }
  else if (action === 'ingredients') { modal = `ingredients:${el.dataset.id}`; render(); }
  else if (action === 'choose-recipe') { homeRecipe = el.dataset.id; modal = null; room?.recipe(homeRecipe); render(); }
  else if (action === 'invite') {
    const url = new URL(location.href); url.search = ''; url.searchParams.set('room', room.room); url.hash = '';
    try { await navigator.clipboard.writeText(url.href); notice('邀请链接复制好了，发给你的朋友吧。'); }
    catch { notice(`房间码：${room.room}。复制当前网站地址，再把房间码告诉朋友。`); }
  }
});
$('#app').addEventListener('input', event => {
  if (event.target.id === 'nickname') nickname = event.target.value;
  if (event.target.id === 'insert-position') { insertPosition = Number(event.target.value); $('#position-label').textContent = positionLabel(insertPosition, room.view.prompt.max); }
});
$('#app').addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'join-form') startRoom('guest');
  if (event.target.id === 'name-card-form') send({ type: 'answer', cardType: $('#requested-card').value });
});
document.addEventListener('keydown', event => {
  if (!modal && event.target.matches('[data-card]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    const cards = [...document.querySelectorAll('.hand [data-card]')], i = cards.indexOf(event.target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : Math.max(0, Math.min(cards.length - 1, i + (event.key === 'ArrowRight' ? 1 : -1)));
    event.preventDefault(); cards[next]?.focus();
  }
  if (event.key === 'Escape' && modal) { modal = null; render(); }
  if (event.key === 'Tab' && modal) {
    const focusable = [...$('.modal').querySelectorAll('button:not([disabled]), a, input, select')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
compactHand.addEventListener('change', () => { if (room?.view) render(); });
window.addEventListener('pagehide', () => room?.stop(true));
window.addEventListener('pageshow', e => { if (e.persisted) restore(); });
function restore() {
  let saved; try { saved = readSession(sessionStorage, invitedRoom); } catch {}
  if (saved) {
    room = new Room({ saved, name: nickname, onChange: changed, onNotice: notice }); room.start();
  } else render();
}
restore();
