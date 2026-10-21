# 规则依据与食谱选择

核对日期：2026-10-21。目标是复现 Recipes for Disaster 的玩法；中文卡名和食谱名使用易读的项目译名，英文名保留在数据中用于对照。

## 直接来源

1. [官方规则入口](https://www.explodingkittens.com/pages/rules-recipes-for-disaster)。
2. [2025 Core Instructions](https://cdn.shopify.com/s/files/1/0345/9180/1483/files/EKG-RFD_Instructions_Core_04APR2025_Web-compressed.pdf?v=1743819845)：基础回合、开局、胜负、二三张组合。
3. [2025 Field Guide](https://cdn.shopify.com/s/files/1/0345/9180/1483/files/EKG-RFD_field_guide_instructions_04APR2025_Web-compressed.pdf?v=1743819838)：30 种牌的数量、效果与交互。
4. [官方繁中说明书](https://www.gokids.com.tw/tsaiss/gokids/rules/EK-RFD%20%E8%AA%AA%E6%98%8E%E6%9B%B8_%E6%B5%AE%E6%B0%B4%E5%8D%B0.pdf)。
5. [官方食谱选择器](https://www.explodingkittens.com/pages/recipes)：从页面 `data-recipe-settings` 的人数配置核对，不能只依赖页面初始显示的默认食谱。
6. 官方数字库的 [双人黑洞](https://www.explodingkittens.biz/community/recipesfordisaster/2023/04/20/black-hole-2-player/)、[双人豪华餐](https://www.explodingkittens.biz/community/recipesfordisaster/2023/04/20/power-play-2-player/)、[双人分享餐](https://www.explodingkittens.biz/community/recipesfordisaster/2023/04/20/sharing-is-caring-2-player/)。
7. [官方实物食谱展示照片](https://www.explodingkittens.com/cdn/shop/files/03EK_RFDLifestyle1_1400_d034212a-c9e5-4b88-a438-c6f8021f3d13_1400x.png?v=1761775275)：用于核对网页中相互冲突的起手数和双人配方。

## 基本玩法

食谱是一套配牌方式，改变卡牌种类、张数、起手数和节奏，不是游戏中合成卡牌的系统。卡池共 121 张，玩家每局仅取出食谱要求的部分。

开局先移出爆炸猫、内爆猫，按食谱发拆弹，再从安全牌中发起手牌，最后将危险猫洗入抽牌堆。轮到自己可以出零张或多张牌，通常通过抽一张牌结束一个回合。抽到爆炸猫且没有保护或拆弹就出局，最后存活者获胜。

两张同名牌可从其他玩家手里选走一张；三张可点名要一种牌，对方没有则无事发生。万用猫只能代替普通猫牌。采用当前规则中的二张/三张组合，没有加入旧版本的五张不同牌回收规则。

## 收录的 18 道食谱

| 项目名称 | 官方英文名 | 人数 | 起手安全牌（另发拆弹） |
| --- | --- | --- | --- |
| 闪电猫 | Lightning Kittens | 2–4 | 1 |
| 经典小厨房 | Exploding Kittens Classic Mode | 2–5 | 7 |
| 才不要酱 | Nope Sauce | 2–5 | 7；五人 5 |
| 黑洞锅 | Black Hole | 3–5 | 7；五人 5；不发拆弹 |
| 双人黑洞锅 | Black Hole 2 Player | 2 | 7；不发拆弹 |
| 攻击千层面 | Attack of the Attacks | 2–5 | 7；五人 5 |
| 危险特调 | Danger Mode | 2–4 | 7 |
| 先看一口 | Eye for an Eye | 3–5 | 7 |
| 冒险加餐 | Meowsochist | 2–5 | 5 |
| 豪华全家桶 | Power Play | 3–5 | 7 |
| 双人豪华餐 | Power Play 2 Player | 2 | 7 |
| 有福同享 | Sharing Is Caring | 3–5 | 5 |
| 双人分享餐 | Sharing Is Caring 2 Player | 2 | 7 |
| 顺爪牵猫 | Sticky Fingers | 2–5 | 7；五人 5 |
| 火力大拼盘 | The Purrrge | 3–5 | 7 |
| 猫咪心理战 | Mind Games | 2–5 | 5 |
| 囤粮小能手 | Card Hoarders | 2–4 | 5 |
| 猫猫大乱斗 | Cat Fight | 2–4 | 2 |

除黑洞两种配方外，每人额外发一张拆弹。完整配方由 `src/recipes.js` 中的 `getRecipe(id, players)` 给出；游戏食谱窗口的「配牌」按当前房间人数显示总张数，包含已发给玩家的牌。代码对全部支持人数验证每种牌均不超过盒装卡池，并验证能发完起手牌。

## 官方材料存在的差异

- Attack of the Attacks：官网人数 JSON 中出现超过盒装数量的 Super Skip / Targeted Attack 配置。采用[官方数字库](https://www.explodingkittens.biz/community/recipesfordisaster/2023/04/20/attack-of-the-attacks/)的超级跳过 2、指定攻击 4；五人起手按实物食谱图取 5。
- Power Play 双人：数字库写拆弹总数 `P+2`（双人即 4），实物图写 3；采用实物的 3。普通多人版仍为 `P+2`。
- Sticky Fingers 五人起手按实物图取 5；Black Hole 五人起手取官网说明的 5。
- Classic Mode 的网页描述与人数数据不完全一致；本项目开放已完成配牌校验的 2–5 人。

这些选择不是宣称某一版盒装说明有误。找到更清楚的对应版本证据时，应同步修改数据、测试与本文件。

## 电子化处理与可见性

- 出牌、抽牌前显示 10 秒响应窗口；所有存活玩家确认放行后提前执行，到时由房主自动为未响应者放行。Nope 不能取消抽牌，NOW 可在行动开始前插入；新的否决、NOW 或恢复被打断的行动会重新获得 10 秒。正在处理看牌、选牌或插牌时不计时、不能打断；离线暂停，重连或房主刷新恢复后重新计时。这是本网页版的节奏约定。
- 为减少无意义选择，有拆弹时自动使用。玩家亲自决定插回的位置，从顶部到最底部；其他人只能看到「正在秘密操作」。
- 普通跳过结束一个回合，超级跳过结束全部待完成回合；攻击把仍未完成的攻击回合加到新的攻击上。两人反转视作普通跳过。
- 反面内爆猫翻正插回；正面内爆猫不能拆弹。埋牌不改变内爆猫原有朝向。截牌接收者承担拿到危险猫的效果；这是按 Field Guide 的截牌接收规则组合实现的交互，没有把未检索到的专项 FAQ 当作额外证据。
- 流浪猫允许持有一只爆炸猫；偷走保护牌或拿到额外爆炸猫会立即处理。吠叫猫不能被 Nope，拆弹后两张吠叫猫直接弃掉，不插入牌堆。
- 垃圾回收先让所有人秘密选择，待全员选完再一起洗回；不逐个公开或提前移动。
- 玩家出局的手牌进入私密退场区，不添加到公开弃牌堆，按 2025 Field Guide 处理。
- 历史看牌信息会标为历史信息，不随其他人的秘密洗牌、抽牌、重排自动更新。
- 房主可查看完整本地状态；客人只拿到过滤后的视图。没有防作弊服务器，不将好友信任模型描述为竞技级防作弊。
