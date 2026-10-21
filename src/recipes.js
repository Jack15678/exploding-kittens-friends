import { CARDS } from './cards.js';
const cats = { taco: 4, rainbow: 4, zombie: 4 };
const base = (p, extra = 0) => ({ exploding: p - 1, defuse: p + extra });
const recipe = (id, name, english, min, max, minutes, description, build, options = {}) => ({
  id, name, english, min, max, minutes, description, start: 7, defuses: 1, build,
  source: `https://www.explodingkittens.com/pages/recipes?name=${id}`, ...options,
});
// D-002 / docs/RULES.md records every correction to conflicting official web data.
export const RECIPES = [
  recipe('lightning-kittens', '闪电猫', 'Lightning Kittens', 2, 4, 2, '一小叠牌，一场心跳。先来一局热热爪。', p => ({ ...base(p), skip: 4, reverse: 2, nope: 2 }), { start: 1, level: '入门', color: 'sky' }),
  recipe('exploding-kittens-classic-mode', '经典小厨房', 'Classic Mode', 2, 5, 15, '偷牌、拆弹、互相使坏。从熟悉的味道开始。', p => p === 2 ? { ...base(p, 1), nope: 3, attack: 2, skip: 3, shuffle: 2, see3: 2, taco: 4, rainbow: 4, beard: 4 } : { ...base(p, 1), nope: 5, attack: 4, skip: 4, shuffle: 4, see3: 5, ...cats, beard: 4 }, { level: '入门', color: 'peach' }),
  recipe('nope-sauce', '才不要酱', 'Nope Sauce', 2, 5, 15, '加一点否决，再加一点否决。计划随时变卦。', p => ({ ...base(p), nope: 8, shuffle: 4, skip: 4, alterNow: 2, swap: 2, attack: 3, targeted: 2, catomic: 1, bury: 3, taco: 4, feral: 6, reverse: 4 }), { start: p => p === 5 ? 5 : 7, level: '进阶', color: 'rose' }),
  recipe('black-hole', '黑洞锅', 'Black Hole', 3, 5, 15, '没有拆弹的厨房。看着内爆猫慢慢靠近。', p => ({ imploding: p - 1, skip: 5, nope: 4, shuffle: 5, alter: 3, share: 4, swap: 3, bottom: 3, reverse: 4, taco: 3, rainbow: 3, feral: 4 }), { defuses: 0, start: p => p === 5 ? 5 : 7, level: '进阶', color: 'plum' }),
  recipe('black-hole-2-player', '双人黑洞锅', 'Black Hole · Two Players', 2, 2, 10, '两只猫，一颗内爆。谁会先无路可退？', () => ({ imploding: 1, alter: 2, bottom: 1, feral: 4, nope: 3, rainbow: 2, shuffle: 2, skip: 3, swap: 1, taco: 2 }), { defuses: 0, level: '进阶', color: 'plum', source: 'https://www.explodingkittens.biz/community/recipesfordisaster/2023/04/20/black-hole-2-player/' }),
  recipe('attack-of-the-attacks', '攻击千层面', 'Attack of the Attacks', 2, 5, 15, '把回合一层层叠起来，再端给下一位朋友。', p => ({ ...base(p, 1), attack: 6, targeted: 4, skip: 4, superSkip: 2, reverse: 3, see3: 3, ...cats, nope: 4, catomic: 1 }), { start: p => p === 5 ? 5 : 7, level: '进阶', color: 'rose' }),
  recipe('danger-mode', '危险特调', 'Danger Mode', 2, 4, 10, '六只爆炸猫全都进锅。每一抽都值得深呼吸。', p => ({ exploding: 6, defuse: p, attack: p === 3 ? 3 : 4, targeted: p === 4 ? 2 : 4, superSkip: 1, shuffle: 3, reverse: 5, bottom: 2, streaking: 1, ...cats, feral: 4 }), { level: '刺激', color: 'rose' }),
  recipe('eye-for-an-eye', '先看一口', 'Eye for an Eye', 3, 5, 15, '未来几乎看得见，但看见不一定能躲开。', p => ({ ...base(p, 1), exploding: p - 2, imploding: 1, see3: 5, alter: 3, alterNow: 2, share: 4, mark: 4, shuffle: 2, ...cats, attack: 4, skip: 4 }), { level: '进阶', color: 'plum' }),
  recipe('meowsochist', '冒险加餐', 'Meowsochist', 2, 5, 10, '多吃一口风险，也可能多捡一张救命牌。', p => ({ exploding: p, defuse: p + 3, personal: 4, take: 2, reverse: 3, alterNow: 2, share: 3, garbage: 2, taco: 4, rainbow: 4, feral: 6, streaking: 1 }), { start: 5, level: '刺激', color: 'peach' }),
  recipe('power-play', '豪华全家桶', 'Power Play', 3, 5, 15, '最强的牌一起上桌，每次出手都有分量。', p => ({ ...base(p, 2), imploding: 1, streaking: 1, nope: 4, see5: 3, share: 4, attack: 4, bury: 2, bottom: 2, skip: 4, superSkip: 2, taco: 4, feral: 6, garbage: 2 }), { level: '刺激', color: 'mint' }),
  recipe('power-play-2-player', '双人豪华餐', 'Power Play · Two Players', 2, 2, 10, '缩小份量，不缩小威力。两个人也能很热闹。', () => ({ exploding: 1, defuse: 3, imploding: 1, streaking: 1, nope: 2, see5: 1, share: 1, attack: 2, bottom: 1, skip: 1, superSkip: 1, taco: 2, feral: 4, garbage: 1 }), { level: '刺激', color: 'mint', source: 'https://www.explodingkittens.biz/community/recipesfordisaster/2023/04/20/power-play-2-player/' }),
  recipe('sharing-is-caring', '有福同享', 'Sharing Is Caring', 3, 5, 10, '好牌一起分享，坏消息也是。小心吠叫猫。', p => ({ ...base(p, 1), mark: 4, share: 4, skip: 4, take: 4, ...cats, feral: 4, barking: 2 }), { start: 5, level: '进阶', color: 'peach' }),
  recipe('sharing-is-caring-2-player', '双人分享餐', 'Sharing Is Caring · Two Players', 2, 2, 10, '这次只有一个朋友可以坑，也只有一个朋友会坑你。', () => ({ exploding: 1, defuse: 3, barking: 2, feral: 4, take: 1, mark: 2, rainbow: 2, share: 2, skip: 3, taco: 2 }), { level: '进阶', color: 'peach', source: 'https://www.explodingkittens.biz/community/recipesfordisaster/2023/04/20/sharing-is-caring-2-player/' }),
  recipe('sticky-fingers', '顺爪牵猫', 'Sticky Fingers', 2, 5, 15, '看准朋友的手牌，下爪前想想会不会偷到炸弹。', p => ({ exploding: p, defuse: p + 1, attack: 4, skip: 4, take: 4, mark: 4, streaking: 1, ...cats, beard: 4, feral: 6 }), { start: p => p === 5 ? 5 : 7, level: '进阶', color: 'mint' }),
  recipe('the-purrrge', '火力大拼盘', 'The Purrrge', 3, 5, 10, '攻击、反转、超级跳过，一口气端上桌。', p => ({ ...base(p), imploding: 1, catomic: 1, superSkip: 2, skip: 5, reverse: 5, attack: 6, targeted: 4, personal: 4, shuffle: 5, nope: 8 }), { level: '刺激', color: 'rose' }),
  recipe('mind-games', '猫咪心理战', 'Mind Games', 2, 5, 15, '知道很多，能改很少。该用表情骗过朋友了。', p => ({ ...base(p), bury: 4, see3: 6, skip: 4, mark: 4, bottom: 2, reverse: 4, ...cats }), { start: 5, level: '进阶', color: 'plum' }),
  recipe('card-hoarders', '囤粮小能手', 'Card Hoarders', 2, 4, 10, '怎么折腾都得抽牌。手牌越来越厚，心跳越来越快。', p => ({ ...base(p), exploding: Math.max(1, p - 2), imploding: 1, see3: 4, share: 4, swap: 3, bottom: 2, shuffle: 3, ...cats, nope: 4 }), { start: 5, level: '进阶', color: 'mint' }),
  recipe('cat-fight', '猫猫大乱斗', 'Cat Fight', 2, 4, 5, '小小牌堆里装满攻击，一开局就亮出爪子。', p => ({ ...base(p), attack: 4, targeted: 2, nope: 3, alterNow: 2, reverse: 3 }), { start: 2, level: '刺激', color: 'rose' }),
];
export function getRecipe(id, players) {
  const r = RECIPES.find(x => x.id === id);
  if (!r || !Number.isInteger(players) || players < r.min || players > r.max) throw new Error('这道食谱不适合当前人数。');
  const counts = r.build(players);
  for (const [type, count] of Object.entries(counts)) {
    if (!CARDS[type] || !Number.isInteger(count) || count < 0 || count > CARDS[type].count) throw new Error('食谱配牌超出卡池。');
  }
  return { ...r, counts, start: typeof r.start === 'function' ? r.start(players) : r.start };
}
