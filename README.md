# 爆炸猫 · 好友厨房

《爆炸猫：灾难食谱》的非官方浏览器实现，供自己和朋友同乐。奶油粉与薄荷绿的可爱界面、原创 SVG 猫咪牌面、中文玩法、18 道食谱。无需账号。

**在线游玩：[爆炸猫 · 好友厨房](https://exploding-kittens-friends.wizard-friends.workers.dev/) · [GitHub Pages 原入口](https://jack15678.github.io/exploding-kittens-friends/)**

## 本地开始

需要 Node.js 22 或以上。

```sh
npm ci
npm run build
npm run dev:relay
```

打开 http://127.0.0.1:8788/ 。先点「猫咪陪练」即可本地开局；好友桌由一人「开一间好友厨房」，其他人输入八位房间码或打开邀请链接。

需要前端热更新时，另开终端运行 `npm run dev`，访问 http://127.0.0.1:5174/；Vite 会把 `/api` 和 WebSocket 转发到 8788。

`127.0.0.1` 链接只能在当前电脑打开。让远方朋友访问，需要先把网站部署到共同可访问的 HTTPS 地址。部署后房间码仍由房主浏览器创建。

## 已实现

- 2–5 人好友桌；本地练习；房主可添加猫咪陪练。各食谱有独立人数范围。
- 121 张基础卡池、30 种牌型、18 道食谱（15 个主题及 3 个双人变体）。食谱库可直接查看当前人数的配牌数量。
- 抽牌、拆弹与秘密插回、内爆猫正反面、攻击累加、Nope 连锁、NOW 插入响应、预知/重排/分享未来、二三张组合、标记、截牌、垃圾回收、吠叫猫、流浪猫与猫原子弹。
- 行动前有 10 秒响应倒计时，可使用响应牌或手动放行；全员放行会提前执行，到时自动放行。反制或恢复被打断的行动重新计时，断线和秘密选牌期间暂停。
- 房主保存完整牌局；其他玩家只收到自己的手牌和可公开信息。牌局记录、历史看牌信息、卡牌图鉴、手机布局。
- 手牌按功能类别自动整理，同名牌相邻，抽到新牌后自动归位；桌面居中呈扇形，鼠标悬停时斜向上浮放大。手机和触屏完整分开排列，点击选中后再点操作区按钮出牌，保留组合多选；牌多时自动换行，无横向滚动条。键盘可用方向键浏览、空格选中。
- 点击弃牌堆顶的牌，或响应窗口里的「查看这张牌」，可打开完整卡牌说明。
- 同一标签页刷新恢复身份、手牌和未完成步骤。玩家掉线时暂停；连接恢复后继续。房主刷新后，朋友自动重连。
- 好友房间右下角有默认折叠的聊天框；新消息短暂浮出预览并显示未读数，点击展开收发消息。保留本房间最近 80 条，每条最多 240 字，刷新恢复记录；离开房间后清除本地记录。

陪练只根据自己的玩家视图决定行动，不读取牌堆或其他手牌；策略比较简单，用来熟悉玩法。

## 联机与部署

采用 Cloudflare Worker + Durable Object WebSocket 中继，连接层参考同级 `wizard-friends`。手机和电脑都主动连接 HTTPS/WSS 服务，不再依赖 PeerJS、WebRTC 直连或 TURN。房主浏览器仍负责规则、洗牌、10 秒响应倒计时以及按玩家过滤私密信息，中继只认证连接与定向转发。

没有游戏账号、云端完整牌局存档或房主迁移。房主网页需保持打开；手机锁屏或长时间切后台仍可能暂停游戏。刷新和短暂断线后，客人自动重新加入并获取最新状态，未确认的出牌不会自动重放。主动「关闭厨房」会关闭中继房间；仅刷新不会关闭。中继保存房主凭据摘要和房间关闭标记，空置房间元数据最多保留 7 天；完整手牌和聊天仍由房主保存并过滤。

部署使用已有 Cloudflare 账号的 Wrangler 登录：

```sh
npx wrangler whoami
npm run deploy
```

`wrangler.jsonc` 创建独立的 `exploding-kittens-friends` Worker 和 SQLite Durable Objects，不改其他游戏。可使用 Workers Free 方案及 `workers.dev` 域名，额度按 Cloudflare 账号方案计算，不需要 TURN 服务。静态网页与中继默认部署在同一域名；Cloudflare 凭据仅保存在本机授权中，不能提交或放入前端环境变量。

保留 [GitHub Pages 原入口](https://jack15678.github.io/exploding-kittens-friends/)。先部署 Worker，再把仓库 Actions 变量 `RELAY_URL` 设为 Worker 的 HTTPS 根地址；Pages 工作流将其注入公开的 `VITE_RELAY_URL`。Worker 允许 `https://jack15678.github.io` 来源。推送 main 自动测试、构建和更新 Pages；修改 Worker 时还需要执行 `npm run deploy`，让两端协议同步。

所有玩家应在本局结束后一起刷新到中继版本。旧 PeerJS 页面与新版房间不互通；新域名不能读取旧域名的浏览器存档。继续使用原 GitHub Pages 域名时，同标签页快照可恢复，但其他玩家也需更新。所有设备的网络仍需能访问 Cloudflare HTTPS/WSS。

## 验证

```sh
npm test
npm run build
```

规则测试包含全部食谱的完整模拟对局、逐步卡牌守恒检查、攻击/否决/内爆/偷牌爆炸/私密信息、身份绑定、并发响应和保存恢复。构建输出位于 `dist/`。

真实浏览器验证需要安装 Chrome，并先启动 `npm run dev:relay`，再在另一个终端启动 `npm run dev`：

```sh
npm run test:open
npm run test:browser
npm run test:network
npm run test:chat
npm run test:mobile-cards
npm run test:reaction
npm run test:close
```

脚本通过 Playwright CLI 运行。浏览器检查覆盖手机/桌面布局、食谱、整局陪练、刷新、结算和退出；联机检查创建三个隔离浏览器上下文，禁用 WebRTC 并通过真实 WebSocket 中继，用 390px 触屏房主检查建房、双方刷新、掉线暂停与重连、手牌过滤、并发放行、完整结算和关闭房间。手机卡牌检查使用布局夹具验证独立点选、组合和完整说明；响应检查用两个真实联机页面验证 10 秒自动放行及计时期间手牌 DOM 稳定。网络服务不可用时该检查会失败，不会自动换成模拟传输。截图保存在本地忽略目录 `output/playwright/`。

## 代码与规则依据

- `src/cards.js` / `src/recipes.js`：卡牌与食谱数据。
- `src/game.js`：纯规则状态机、命令校验与玩家视图。
- `src/room.js` / `src/room-transport.js` / `src/relay-socket.js` / `src/session.js`：房间、连接、身份与本地恢复。
- `worker/index.js`：Cloudflare 房间中继、房主身份认证和私有消息定向路由。
- `src/bot.js`：仅使用玩家视图的陪练。
- `src/main.js` / `src/art.js` / `src/style.css`：交互、原创插图与响应式界面。
- [规则来源、食谱差异与实现约定](docs/RULES.md)。

已启用 dev-memory，开发记录在本地 `docs/dev-memory/`，不随 Git 提交；Hook 配置已生成，是否被宿主信任尚未确认，当前记录由开发过程手动维护。

这是非官方、非商业的朋友同乐项目，不代表取得原作授权。牌面插图和简短中文说明为本项目原创，未复制原版牌面资源。
