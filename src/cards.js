// Text and artwork are independently written/drawn; mechanics follow the RFD field guide.
const card = (name, english, count, color, symbol, text, extra = {}) => ({ name, english, count, color, symbol, text, ...extra });
const CAT_CAPTION = '单张无效，可搭万用猫\n同名2张：偷1张\n同名3张：点名索牌';
export const CARDS = {
  exploding: card('爆炸猫', 'Exploding Kitten', 6, 'rose', 'bomb', '抽到时必须拆弹，否则出局。拆弹后秘密放回牌堆。', { passive: true }),
  defuse: card('拆弹', 'Defuse', 8, 'mint', 'snip', '爆炸时保命。消耗这张牌，再把爆炸猫秘密插回牌堆。', { passive: true }),
  imploding: card('内爆猫', 'Imploding Kitten', 4, 'plum', 'vortex', '背面抽到：翻成正面插回。正面抽到：直接出局，无法拆弹。', { passive: true }),
  streaking: card('裸奔猫', 'Streaking Kitten', 1, 'peach', 'leaf', '在手中时能秘密保管一张爆炸猫。失去它，藏着的炸弹就会爆炸。', { passive: true }),
  barking: card('吠叫猫', 'Barking Kitten', 2, 'peach', 'bark', '另一张在谁手里，谁就要拆弹。没人持有时留在面前，等待另一张。'),
  attack: card('攻击 ×2', 'Attack (2x)', 6, 'rose', 'bolt', '结束当前回合，让下家连续行动两回合。被攻击时，再把剩余回合一起转交。'),
  targeted: card('指定攻击 ×2', 'Targeted Attack (2x)', 4, 'rose', 'target', '把两回合交给指定玩家；已有的攻击回合也一起累加。', { target: true }),
  personal: card('自我攻击 ×3', 'Personal Attack (3x)', 4, 'peach', 'bolt', '让自己连续行动三回合。已有攻击负担时，额外再加三回合。'),
  skip: card('跳过', 'Skip', 5, 'sky', 'skip', '不抽牌，结束一个回合。还有攻击回合时，仍需继续。'),
  superSkip: card('超级跳过', 'Super Skip', 2, 'sky', 'skip', '不抽牌，结束你所有剩余回合。'),
  reverse: card('反转', 'Reverse', 5, 'mint', 'reverse', '反转出牌方向，并跳过一个回合。双人局相当于跳过。'),
  nope: card('才不要！', 'Nope', 8, 'rose', 'nope', '行动执行前取消它，也能取消另一张否决。不能取消猫咪爆炸或拆弹。', { reactive: true }),
  shuffle: card('洗牌', 'Shuffle', 5, 'sky', 'shuffle', '重新洗匀抽牌堆。内爆猫的正反面不会改变。'),
  see3: card('预知未来 ×3', 'See the Future (3x)', 6, 'plum', 'eye', '秘密查看顶端三张，不改变顺序。'),
  see5: card('预知未来 ×5', 'See the Future (5x)', 3, 'plum', 'eye', '秘密查看顶端五张，不改变顺序。'),
  alter: card('改变未来 ×3', 'Alter the Future (3x)', 3, 'plum', 'stars', '秘密查看顶端三张，并按喜欢的顺序放回。'),
  alterNow: card('立刻改变未来', 'Alter the Future (3x) NOW', 2, 'plum', 'stars', '也可以在别人的行动执行前，查看并重排顶端三张。'),
  share: card('分享未来 ×3', 'Share the Future (3x)', 4, 'plum', 'eye', '重排顶端三张，再只给当前方向的下一位玩家看。'),
  swap: card('交换顶底', 'Swap Top and Bottom', 3, 'sky', 'reverse', '不查看牌面，交换抽牌堆最上面与最下面的一张。'),
  bottom: card('从底部抽牌', 'Draw from the Bottom', 3, 'sky', 'down', '改为抽最下面的一张，结束一个回合。'),
  bury: card('埋起来', 'Bury', 4, 'mint', 'leaf', '抽取顶牌，查看后秘密插回，结束一个回合；内爆猫保持原朝向。'),
  take: card('这张归我', "I'll Take That", 4, 'peach', 'paw', '放在另一位玩家面前，拿走对方下一次抽到的牌，包括危险猫。', { target: true }),
  mark: card('标记', 'Mark', 4, 'peach', 'target', '随机选对方一张手牌，让大家看见；离开其手牌后取消标记。', { target: true }),
  garbage: card('垃圾回收', 'Garbage Collection', 2, 'mint', 'bin', '包括自己在内，每位有手牌的玩家秘密放回一张，一起洗入牌堆。'),
  catomic: card('猫原子弹', 'Catomic Bomb', 1, 'rose', 'bomb', '取出牌堆中的所有爆炸猫，洗匀其他牌，再把爆炸猫放在顶端。结束一个回合。'),
  taco: card('塔可猫', 'Tacocat', 4, 'peach', 'taco', '单张无效。与同名猫或万用猫凑成2张，可从另一位玩家手中选走1张牌；凑成3张可点名索要一种牌，对方没有则拿不到。', { cat: true, caption: CAT_CAPTION }),
  rainbow: card('彩虹猫', 'Rainbow-Ralphing Cat', 4, 'plum', 'rainbow', '单张无效。与同名猫或万用猫凑成2张，可从另一位玩家手中选走1张牌；凑成3张可点名索要一种牌，对方没有则拿不到。', { cat: true, caption: CAT_CAPTION }),
  zombie: card('僵尸猫', 'Zombie Cat', 4, 'mint', 'fish', '单张无效，没有复活效果。与同名猫或万用猫凑成2张，可从另一位玩家手中选走1张牌；凑成3张可点名索要一种牌，对方没有则拿不到。', { cat: true, caption: CAT_CAPTION }),
  beard: card('胡子猫', 'Beard Cat', 4, 'sky', 'bow', '单张无效。与同名猫或万用猫凑成2张，可从另一位玩家手中选走1张牌；凑成3张可点名索要一种牌，对方没有则拿不到。', { cat: true, caption: CAT_CAPTION }),
  feral: card('万用猫', 'Feral Cat', 6, 'peach', 'paw', '单张无效，只能代替普通猫牌，不能代替攻击、拆弹等功能牌。凑成2张组合可从另一位玩家手中选走1张牌；3张可点名索牌，对方没有则拿不到。', { cat: true, caption: '仅代替普通猫牌\n2张组合：偷1张\n3张组合：点名索牌' }),
};
const HAND_ORDER = [
  'defuse', 'streaking', 'nope', // 保命与反制
  'attack', 'targeted', 'personal', 'skip', 'superSkip', 'reverse', // 攻击与回合
  'see3', 'see5', 'alter', 'alterNow', 'share', // 未来
  'shuffle', 'swap', 'bottom', 'bury', 'garbage', 'catomic', // 牌堆
  'barking', 'take', 'mark', // 玩家互动
  'taco', 'rainbow', 'zombie', 'beard', 'feral', // 组合猫牌
  'exploding', 'imploding', // 危险猫
];
const handRank = new Map(HAND_ORDER.map((type, index) => [type, index]));
// Sort a display copy: stealing and marked cards still use the original hand indices.
export const sortHandForDisplay = cards => [...cards].sort((a, b) => handRank.get(a.type) - handRank.get(b.type));
export const cardName = c => CARDS[typeof c === 'string' ? c : c.type]?.name || '未知牌';
export const TOTAL_CARDS = Object.values(CARDS).reduce((n, c) => n + c.count, 0);
export const SOURCE_RULES = 'https://www.explodingkittens.com/pages/rules-recipes-for-disaster';
