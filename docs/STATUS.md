# 项目现状速查

> 从 `AGENTS.md` 拆出来的**结论性状态**（原来是主文件的「现状速查」整节）。
> 这里的东西**每轮都在变**（换美术 / 改关卡 / 调开关）—— 动手前读一遍，过期就直接改本文件。
> **不要往 AGENTS.md 搬回去**：那是每次开工都注入的规范文件，64KB 预算已经不够用。

> 这一节是**结论**，不是历史 —— 详细来龙去脉在 [docs/WORKLOG.md](WORKLOG.md)。
> ⚠️ 这里的数字会随换美术 / 改关卡而变，动手前先现读一遍。

### 当前场景（2026-10-15 核实）

| 项 | 值 |
|---|---|
| 槽位 | **23 个**：`Slot_01` … `Slot_23`；`pieceId` 实测是 `0,1,1,3,4,…,22` —— ⚠️ **有两个 1、没有 2**（§6 要求唯一，并列时退化成子节点顺序）。这几格是**换 23 片新美术**那轮改的，位置/序号还在调 |
| 碎片池 | `batchSize = 3`（一屏 3 块，这一批用光才补下一批）、`batchFadeTime = 0.5`、**`reflow = false`**（自动补位**关着**，用掉的碎片留个空位）、**碎片间距 = 80（定值，`content` 的 Layout 上配，代码不再算）** |
| 终局 | `EndgameCta.winCount = 0` —— ⚠️ **退回「全部修完出结束界面」那条老路**（§1.5）：不跳商店、也没有第 N 格就跳那一下。**看着像调试态**（方便一眼看到完成图亮出来 + 结尾视频那一段），交审前要确认 |
| 每格揭晓 | 23 格**都同时配了** `stickerApply` 和 `brushReveal`，而 `PieceSlot.repair()` 先问 `stickerApply`（§3 那两行的顺序）⇒ **实际走「贴纸贴平」**，画笔那一格走不到。`circleReveal` / `revealAnim` / `swapHide`+`swapShow` 全空。另外 **`FeatureFlags.brushReveal` 是关的**，想单块走画笔要两个都改 |
| 每格揭角 | 23 格都勾了「本格单独配揭角」（`peelOverride = true`），每格一份**按各自形状算出来的**参数（不是抄全局）：21 格掀**右下角**、`Slot_15` / `Slot_23` 宽扁 ⇒ 掀**右边**；掀起的深度固定 `0.28 × 短边`，所以比例值逐格不同（0.066–0.228）。规则与重算脚本见 §16 末那条 |
| 失败路 | **走不到**：23 格的 `altView` / `requires` 全空 ⇒ `REPAIR_FAILED` 永不抛 |
| 收尾 | **两拍，都用现成事件**：① **最后一块吸附成功当刻**（`LEVEL_COMPLETE`）**就把完成图亮出来** —— `SceneBgSwap.instant = true`：不建材质、不起 tween、不撒仙尘，只是把 `完成背景` 的贴图挪到 `Scene_BG` 上；② **最后一格露面**（最后一个 `PIECE_SHOWN` = 放置那一段演完）才抛 `END_SHOW` ⇒ **结尾视频 3.88s**（§18，配了才演、点一下可跳过）⇒ 结束界面。这两拍之间演的是最后那几格的「贴纸按平」—— 它们演在**已经完整**的画面上，所以没有缺口，只是把碎片按平到图上。**从最后一块落位到出 CTA 约 3.9s + 那零点几秒**。⚠️ 「定格 0.5s」「那道 0.9s 的横扫光」「1.5s 的画笔涂色」**三样都撤了**：前两样靠 `FeatureFlags.sweepOnComplete = false`（关着时 `SceneBgSwap.delay` **必须是 0**，`verify-scene.js` 会卡「白等」），第三样靠 `SceneBgSwap.instant`；那几组参数都还留在组件上，随时能退回（`tools/js/set-finale.js` 传 `{"sweep":true}` 开横扫、取消勾选 `instant` 回画笔，画笔那条**不提前**：等最后一格露面才落笔）。⚠️ 最后一批**齐落**（`AutoPlayer` 里错峰归零，见下「打关」）。⚠️ `winCount > 0` 的老路上演不到（商店在最后一块**吸附当刻**就开了） |
| 完成背景 | `Scene_BG`（线稿图 582×840）下挂着 `完成背景`（`成图`，同尺寸，平时 `active = false`）、`魔法仙尘`（`ParticleSystem2D`）与 `结尾视频`（§18）。**现在是「直接亮出来」**（`SceneBgSwap.instant = true`）：**最后一块吸附成功当刻**（`LEVEL_COMPLETE`）把 `完成背景` 的贴图挪到 `Scene_BG` 上、把 `完成背景` 睡回去；**等最后一格露面**（最后一个 `PIECE_SHOWN`）才抛 `END_SHOW`。不演画笔、也不撒仙尘。画笔那一套还留着（12 笔 / 半径 0.08 / 1.5s），**取消勾选 `instant` 就退回它**（那条路不提前：最后一格露面才落笔），见 §16 |
| 结束界面 | **是主路径**（`winCount = 0`）：23 格全修完 ⇒ `LEVEL_COMPLETE`（= 最后一块落位）⇒ **当刻亮出完成图** ⇒ 最后一格 `PIECE_SHOWN`（= 放置那一段演完）⇒ `END_SHOW` ⇒ **结尾视频 3.88s**（§18，配了才演）⇒ `CtaController` 亮结束界面。⚠️ `End/bg` 还是**纯白 4×4**，那一屏现在是白底 |
| 音频 | 6 条（`AudioManager@Canvas`，见「音频配置」）：bgm 常驻、拿起（贴纸）、放置（放置音）、自动打关（循环）、魔法光粒、三颗 CTA 按下去那一声 |
| 打关 | `AutoPlayer`：`afterPlaced = 3` / `startDelay = 0` / `stagger = 0.01` / **`batches = 2`** / `gap = 0.02` / `flyTime = 0.1`，总开关**开着**。节奏是**一批一批**放：每一步把池里此刻摆出来的 `batches` 屏（= **2 屏 6 块**）一起放走，同一批内错开 `stagger`，全落完再补下一批。⚠️ 池子平时只摆一屏 —— 多摆的那一屏靠 `PiecePool.buildMore()` 在接管期间临时摆上，所以**最外围那两块是从裁剪窗外飞进来的**。⚠️ **最后一批不做错峰**（齐落）。⚠️ `stagger` 现在是 0.01s，错落感看不出来，「齐落」这一下也就等于没改 —— 想要节奏对比得把 `stagger` 调到 0.1 上下。⚠️ 接管之后那一屏的**贴纸收尾脉冲不演**（几格同时收放会糊成一片闪，见 §5 `AUTO_PLAY` / §16）。⚠️ `winCount = 0` 时它**不受「门槛要小于 winCount」那条限制**，会一路把 23 格全放完 |
| MCP 端口 | **不用再问了：按项目路径现算，本项目恒为 `27502`**（扩展的 `portMode = project`）。公式 `20000 + sha256("funplay-cocos-mcp:" + 小写正斜杠项目路径)[0:8] % 10000`，实现在 [tools/lib/cocos-port.mjs](../tools/lib/cocos-port.mjs) —— `exec.mjs` / `mcp.mjs` 都走它，`MCP_PORT` 仍可覆盖（扩展改成固定端口时才需要） |

**已经退场的表现（代码还在、场景里一个都没配）**——动手做「表现」之前先认一下，
别照 [docs/WORKLOG.md](WORKLOG.md) 里那些历史小节以为它还在跑：

| 表现 | 现状 |
|---|---|
| 收尾动作「通马桶 / 扫地 / 喷瓶」 | `FlushAction` / `BroomSweep` / `SprayAction` 组件在代码里，**场景里一个实例都没有**；它们依赖的 `气体大` / `气体小` / `马桶隐藏节点` / `扫把隐藏节点` 等节点也**已经不存在** |
| 地上脏水 | `GroundWater` 组件与 `地上脏水` 节点都不在场景里 |
| 换节点（`swapHide` + `swapShow`） | 23 格全为 null（那个机制本身还在代码里） |
| 两种状态（`altView` + `requires`） | 23 格全空，见上表「失败路」 |
| 胶带揭晓 / 稻草人序列帧 | `TapeReveal.ts`、`FrameLoop.ts` **已从代码里删除**，`TAPE_REVEAL` / `WINDOW_REPAIRED` 两个事件也已不在 `GameEvent` |
| 待机动作 `IdleMotion` | 组件在代码里，场景里没有实例（没有可挂的节点了） |
| 圆形扩散 / 序列帧揭晓 / 单块扫光 / **总修复横扫** | 组件都还挂在 `EffectLayer` 上，但**开关全关**且 23 格都没配 ⇒ 不演（见上表开关）。⚠️ **总修复那道横扫的扫光**（`sweepOnComplete`）2026-10-15 也关掉了 —— 它曾经是收尾的一环，现在整段不要了（见上表「收尾」） |
| 画笔涂色（`brushReveal`） | 组件挂在 `EffectLayer` 上、**23 格也都配了它**，但 ① 开关 `brushReveal` **是关的**；② 同一格还配着 `stickerApply`，而 `repair()` 先问贴纸贴平。**两个条件任改其一它都还是走不到** —— 想单块走画笔，得关掉这 23 格的 `stickerApply` 并把开关打开 |
| 贴纸贴平（`stickerApply`） | **这才是 23 格现在实际走的**（开关开着，23 格全配）。`tools/js/mount-sticker-apply.js` 会把画笔那边清掉 |

### 功能开关当前状态（§15）

| 开关 | 值 | 影响 |
|---|---|---|
| `stickerPeel` | 开 | 拿起碎片时揭角（接的是「揭角 → 贴平」） |
| `stickerApply` | 开 | 修好时贴纸贴平 —— **23 格全配着它，这是现在真正生效的单块揭晓** |
| `brushReveal` | **关** | ⚠️ 23 格也全配了画笔，但开关关着 + `repair()` 先问 `stickerApply` ⇒ 单块走不到画笔。**完成背景那一支画笔另说**：它不走这个开关，现在由 `SceneBgSwap.instant`（「直接亮出来」）关着 |
| `progress` / `audio` | 开 | |
| `pieceGlow` | **关** | 拖起来没有白边发光 |
| `trail` | **关** | 没有拖尾光点 |
| `revealOnRepair` | **关** | 修好时不播序列帧、不放大 |
| `circleReveal` | **关** | 圆形扩散整条停用 |
| `sweepOnRepair` | **关** | 单块吸附成功不扫光（自动打关连放 20 块，一块一闪会很吵） |
| `sweepOnComplete` | **关**（2026-10-15 关掉） | 全部修完横扫整块拼图（23 格并集）—— 收尾现在不要这一拍了；**关着时 `SceneBgSwap.delay` 必须是 0**（两个数由 `tools/js/set-finale.js` 成对写，`verify-scene.js` 会卡「白等」） |
| `guide` | 开 | 空闲引导照常演（§8.1 第 6 条有兜底） |
| `autoPlay` | 开 | 自动打关：玩家放够 3 块后系统接管，一路放完 23 格。见 §15 / §16「自动打关」 |

### 音频配置（`AudioManager@Canvas`，§16）

| 激活事件 | 音效 | 音量 | 渐入渐出 | 循环 | 干什么的 |
|---|---|---|---|---|---|
| `NONE`（常驻） | `bgm.mp3` | 1 | 1 / 1 | 一直 | 无缝循环的背景垫乐 |
| `PIECE_PICK` | `贴纸.mp3` | 1 | 0 / 0 | 否 | **拿起碎片**那一下（和揭角同一拍） |
| `PIECE_SNAP_SUCCESS` | `放置音.MP3` | 1 | 0 / 0 | 否 | **修好一块**。一条放到底 —— 音阶 1-6 的顺序列表已弃用（那 6 个资源也删了） |
| `AUTO_PLAY`→`GAME_OVER` | `自动打关.MP3` | 1 | 0.3 / 0.5 | **是** | 系统接管那一段**整段循环**着放，最后一块落地（`GAME_OVER`）渐出收掉 |
| `LAST_SHOWN` | `魔法光粒.MP3` | 1 | 0 / 0.4 | 否 | **最后一格露面**那一下（= 放置演完、要进结尾视频了）。⚠️ 它本来是配给「那支画笔开演」的，画笔现在不演了（`instant`），这一声还在响 —— 留不留见下「待确认」 |
| `BUTTON_DOWN` | `button_down.mp3` | 1 | 0 / 0 | 否 | **按下按钮那一瞬**（`GameCta` / `End/btn` / `Fail/btn` 三颗） |

- **自动打关那一段不放「拿起 / 放置」**：`AutoPlayer` 每一块都会抛 `PIECE_PICK` / `PIECE_SNAP_SUCCESS`，
  而那段全是系统在替玩家放，再响一遍就是六连音。闸门在 `AudioManager` 里（`AUTO_SILENT` 那两条 +
  `AUTO_PLAY` / `GAME_OVER` 开关），**发射方一行没动**。
- **`LAST_SHOWN` 不是一个总线事件**：它是「最后一格露面」（= `SceneBgSwap` 抛 `END_SHOW` 那一拍）。
  ⚠️ 完成图现在**提前**到最后一块落位（`LEVEL_COMPLETE`）就亮了，这一声留在后面没跟着提前。
  `PIECE_SHOWN` 每格都发，§5 又不让加事件名，所以由 `AudioManager` 自己把 `PIECE_SHOWN` 数到
  `LEVEL_BUILT` 报的总数 —— 和 `SceneBgSwap` 内部同一个判法。
- **`BUTTON_DOWN` 也是一个假事件**：它听的是 `AudioManager.buttons` 那几个节点的 `TOUCH_START`。
  不用 `CTA_CLICK` 是因为那是**松手**才发，而 `openStore()` 排在它**前面**（`GameCta.onClick` 第一句）
  —— 等它响时商店已经在开了。**加按钮就往 `buttons` 里拖一个节点。**
- `POST_OVER` 那条豁免（关场停全部时放行的几条）现在只有按压音效在用；
  胜利风铃 `LEVEL_COMPLETE` 与结束界面自己的 `END_DROP` 都还留在豁免名单里，但**场景里已经没有对应的条目**。
- 改配置在 Inspector 里加条目拖资源即可；重新接一遍走 `node tools/exec.mjs scene tools/js/mount-audio.js`（幂等）。

### ⚠️ 待确认（都不是代码问题，是配置决策）

1. **单块修好的观感只剩「揭角 → 贴平」**：那 5 个开关（glow / trail / revealOnRepair / circleReveal /
   `sweepOnRepair`）都关着，修好一块时既不扫光也不播序列帧。**是有意收敛还是一轮轮改下来忘了开**，需要确认。
   （`sweepOnComplete` 2026-10-15 先开、当天又关掉了；收尾现在只剩「当刻亮完成图 + 结尾视频」两拍。）
2. **`winCount = 0` 意味着修完不跳商店**：走的是老路（结束界面 + 玩家自己点 CTA）。**看着像为了看完成背景
   那支画笔而留的调试态**；同时 §17 的 `CHALLENGE_SOLVED` 只挂在 `GAME_OVER` 上，而 `GAME_OVER` 只有
   `EndgameCta.trigger()` 会抛 —— `winCount = 0` 时**这条埋点永远不会上报**。交审前必须确认。
3. ⚠️ **`pieceId` 有重号**：23 格里有两个 `1`、缺一个 `2`（实测 `0,1,1,3,4,…,22`）。§6 要求唯一 ——
   并列时碎片池的顺序退化成子节点顺序，能跑但留隐患。
4. **完成图在「最后一块落位当刻」就亮出来**（`SceneBgSwap.instant`，不走画笔）：这一拍**没有任何动画**，
   完成图是一下子出现的；接下来演的是最后那几格的「贴纸按平」，演完才抛 `END_SHOW` 进结尾视频。
   **这一下硬不硬、要不要留半拍**（把 `SceneBgSwap.delay` 填 0.2~0.4 —— 但 `verify-scene.js` 会按「白等」报，
   得先改口径），得在 Game View / 真机上看。也可以取消勾选 `instant` 退回画笔涂色
   （那条路**不提前**：等最后一格露面才落笔）。
5. **`LAST_SHOWN` 那条音效（`魔法光粒.MP3`）现在没效果可配**：它是给「完成背景那支画笔开演」写的，
   画笔不演了，这一声却在最后一格露面时照旧响 —— 而 `END_SHOW` 紧接着就 `stopAll()`，所以听感上是
   一声被掐掉的短音。**要么删掉这条 cue，要么把它当成「完成图出现」的音效留下** —— 需要你定。

**已了结**：~~`winCount = 4` 修不满整张图~~ —— 2026-10-14 改成全部修完才跳。
2026-10-15 又变成 `winCount = 0`（原因见上第 2 条）。

### 美术现状与空壳（2026-10-15 核实）

23 格**修复后的图都齐了**（`repairedView` 那张全有贴图）；`Scene_BG` 是**线稿图**（582×840），
`完成背景` 是**成图** —— 「线稿打底、修完刷成图」就是这一版画面的主线。

**还没配图 / 配错的**：

| 位 | 现状 | 要修的话 |
|---|---|---|
| `Slot_11` / `Slot_12` / `Slot_13` / `Slot_14` / `Slot_17` / `Slot_18` 的 `Broken` | **没贴图**（`brokenView.spriteFrame = null`）—— 缺口框是世界包围盒给的，空图 = 零尺寸框，这几格既画不出破损图、也吸不上（半径 0） | 拖图进去（换 23 片那轮还没铺完） |
| `Bg_Sprite`（整体背景） | 挂的是 **`纯白` 4×4** —— 拼图区以外整屏是白的 | 换美术给的底图。⚠️ 换完再配 inset（见下） |
| `End/bg`（结束界面底） | 同样是 **`纯白` 4×4** | 同上 |
| `PoolBG`（碎片池底图） | **没贴图**（`spriteFrame = null`） | 拖一张进去 |
| `ProgressController@UILayer` | `label` 为空 —— `ProgressLayer` 下没有进度文字节点 | 加个 Label 拖进那个口，代码不用改 |
| `BackgroundSwap@CtaRoot` | `landscapeFrame` 为空 —— 结束界面横屏没有专属底图 | 出「横版结束背景」之后指过去 |

> ⚠️ `verify-scene.js` 那条 `背景图九宫格 inset 没配齐（0,0,0,0）` 在当前美术下是**误报**：
> 底图是 4×4 的 `纯白`，SLICED 配 inset 0 就等于 SIMPLE、逐像素相同，没有构图元素需要保护。
> **等换上真底图之后再按它说的去配 `.meta` 的 `borderTop/Bottom/Left/Right`** —— 那时它才有意义。

### 还没做的事

- **`GameEntry.start()` 里还留着一小段调试探针**（`scheduleOnce(this.probe, 0.5)` + `probe()` + 两个 import）。
  要在 Game View 里核完 `[Probe]` 那行再删。详见 WORKLOG 末尾「待你确认」。
- **Moloco 的 `XMLHttpRequest` 字面量**还没改造，那份产物**先别上传**；Moloco / Google 两家**都还没**
  拿真机或官方校验器验过（§8.6 末尾那两条）。
- **交审前要真人过一遍「全程不操作」这条路**（现在 `guide` 关着，画面是静止的）。

---

