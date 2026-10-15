# 拼图修复 · 试玩广告 项目开发规范（AGENTS.md）

> 本文档是**规范**，也是每次迭代的实现 Prompt。**开工前先读这一份**，所有改动必须遵守本文约定。

## 文档地图

| 文件 | 什么时候读 |
|---|---|
| **本文件** | 每次开工前。约定、规范、开关语义、事件清单、调参表索引 —— 「该怎么做」 |
| [docs/ADAPT.md](docs/ADAPT.md) | 动**转屏 / 撑满 / Widget 对齐 / 横屏两栏 / 拼图框自适应 / 碎片池竖栏**之前（= §7 全文） |
| [docs/RELEASE.md](docs/RELEASE.md) | 动 **MRAID / CTA / 打包器 / 引擎裁剪 / 多平台产物**之前（= §8 全文，含 §8.5 打包管线、§8.6 三平台） |
| [docs/TUNING.md](docs/TUNING.md) | 要调某个 Inspector 参数、但不确定它挂在哪、现在还生不生效时（= §16 表格） |
| [docs/STATUS.md](docs/STATUS.md) | **每次动手前** —— 当前槽位数 / 开关值 / 音频 / 打关 / 待确认 / 美术空壳 / 还没做的事（原「现状速查」） |
| [docs/ARCH.md](docs/ARCH.md) | 新增 / 改名脚本、找某个职责落在哪个文件时（= §4 全文） |
| [docs/VIDEO.md](docs/VIDEO.md) | 动结尾视频、换片源、改播放区域之前（= §18 全文） |
| [docs/WORKLOG.md](docs/WORKLOG.md) | **按功能名进 `docs/worklog/` 的索引**（正文拆成 13 个 10–40KB 的小文件）。想知道「这处为什么写得这么绕 / 之前试过什么方案」，**只读对应的那一个小文件，别通读** |
| [docs/changes/](docs/changes/) | 每次提交一个短文档（改了什么 / 为什么 / 怎么验的 / 影响什么）。**回头查「这次为什么改」先看这里** |
| [docs/ANALYTICS.md](docs/ANALYTICS.md) | 接 / 改 / 查试玩埋点（§17）。**§1–§6 是可移植的接入规范**（官方事件全表 + 参考实现 + 映射规则），**换项目可以直接拿走**；§7 才是本项目的接线 |

文中「§N」一律指**本文件**的对应小节。WORKLOG 里的「§N」也指本文件。
ANALYTICS.md 自成一个文件，它内部的「§N」指它自己，写明 `AGENTS.md §N` 的才指本文件。

**本文件的分区**：§0–§13 是规范与约定 · §15–§18 是开关语义 / 调参表索引 / 埋点 / 视频。

> ⚠️ **§4 / §7 / §8 / §16 / §18 的正文不在这里**，加上原「现状速查」整节，都拆到上面那几个 docs/ 文件了。
> 原因是工作区指令有 64KB 预算：原 `CLAUDE.md` 已涨到 61.5KB（占 96%），再涨就会被**从中间截断**。
> **小节编号一个都没动** —— 文中所有「§4」「§7.1」「§8.6」「§18」照样指得到对应 docs 文件。

---

## 现状速查

> 📄 **全文已移到 [docs/STATUS.md](docs/STATUS.md)** —— 槽位 / 碎片池 / 终局 / 每格揭晓与揭角 / 完成背景 /
> 结束界面 / 音频 / 打关 / MCP 端口，外加**功能开关当前值、待确认项、美术空壳清单、还没做的事**。
>
> ⚠️ 那是**结论性状态**，会随换美术、改关卡而变。**动手前先读一遍**，别拿旧结论当依据；
> 数字过期就直接改 STATUS.md，**不要搬回本文件**（本文件每轮都注入，预算很紧）。

## 0. 项目基线

| 项 | 值 |
|---|---|
| 引擎 | Cocos Creator **3.8.8**，TypeScript |
| 项目路径 | `d:\cocos\Puzzle_261015\Puzzle_new_Template` |
| 设计分辨率 | **720 × 1280**，fitHeight + fitWidth（**运行期会被 `ScreenAdapter` 改掉**，见 §7.1） |
| 方向 | 竖屏为主，**必须同时支持横屏**（§7.1） |
| 类型 | 拼图修复类试玩广告（Playable Ad） |
| 投放平台 | **AppLovin**（主）；Moloco / Google 同一份源码出另外两份产物（§8.6） |
| 体积红线 | 单 HTML **< 5MB**（§9） |
| 编辑器操作 | 通过 MCP（HTTP，端口**现算 = 27502**，见现状速查） |

**前置条件**：Cocos Creator 编辑器必须打开本项目且 `funplay-cocos-mcp` 扩展已加载（端口在监听），MCP 工具才可用。
场景 / 节点 / 预制体 / 组件挂载操作**优先走 MCP**，不手写 `.scene`、`.prefab` JSON。

**两条并行的驱动通道**（都在用，互不冲突）：

| 通道 | 怎么用 | 什么时候用 |
|---|---|---|
| **DSH 原生 MCP 工具** | 直接调 `mcp__cocos__execute_javascript`（= 旧的 `execute_javascript`）、`mcp__cocos__get_scene_info`、`mcp__cocos__list_assets` 等，**全量工具都在**（`toolProfile = full`） | 交互式探查、单步操作、要看结构化返回值时 |
| **node 桥**（仓库自带） | `node tools/exec.mjs <scene\|editor> <脚本.js> [argsJson] [--no-save]`<br>`node tools/mcp.mjs <工具名> [argsJson]` | 批量 / 可重复的接线动作。**接线优先走这条** —— `.js` 脚本进版本库、可复查、不依赖会话 |

`scene` 上下文默认自动存场景（`--no-save` 关掉）。**改完 `.ts` 要先刷资源库**（`tools/js/refresh.js`），
否则编辑器内存里跑的还是旧类（§16 末尾）。

**npm 快捷方式**（`package.json`）：`npm run cocos -- <scene|editor> <脚本.js>`（= `exec.mjs`）、
`npm run check`（= 只读跑 `verify-scene.js`）、`npm run pack` / `pack:report` / `dist`。

**DSH 侧的工作区接线**（换机器要重建）：

- **技能**：`.dsh/skills/` 下的**真实文件**（两个技能：`funplay-cocos-mcp-workflow` /
  `funplay-cocos-ui-composition`，各含 `SKILL.md` + `.funplay-cocos-mcp.json`）。
  已进版本库（`.gitignore` 里 `.dsh/*` + `!.dsh/skills/`），**直接 clone 就有，不用再建联接**。
  ⚠️ 不再有 `.claude/` 目录 —— DSH 本来就只读 `.dsh/skills`。
- **指令文件**：本文件叫 `AGENTS.md`（DSH 原生认这个名）。⚠️ DSH 同时把 `CLAUDE.md` 当候选，
  **两个都在就会被读两遍**（双倍注入）—— **只留本文件，不要重新引入 `CLAUDE.md`**。
- **MCP 接线**：DSH 侧在 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `insert: mcp-cocos` 那一条
  （`@deepseek-ai/dsh-mcp-client`）；编辑器没开时只是没有那些工具，不阻塞启动。
  **不再有 `.mcp.json`**（Claude Code 遗留、DSH 从不读它，已删）。

## 1. 玩法定义

1. 屏幕下方是**碎片池**，玩家从中拖动碎片。
2. 拖动碎片靠近目标缺口，**进入吸附半径即自动吸附**（不需要松手，也不需要精确对位）。
3. 未进入任何正确缺口范围就放开（或拖到错误位置）→ 碎片 **tween 弹回碎片池原位**。
4. 每次成功吸附触发**单块修复事件**：该缺口位置由「修复前」切换到「修复后」，播放局部反馈。
5. **修满 `winCount` 格** → 触发**终局**：抛 `GAME_OVER` 冻结玩法并跳商店。
   **跳转就在这一格吸附成功的那一下**，不等它的揭晓动画（细节见 [docs/WORKLOG.md](docs/WORKLOG.md) 的「终局跳转」）。
   **`winCount` 的当前值见 [docs/STATUS.md](docs/STATUS.md)**（这里是**机制**，不是现值）：
   `winCount` = 槽位总数时是**全部修完**才跳（修满那一刻顺带抛总修复事件 `LEVEL_COMPLETE`）；
   `winCount < 槽位数` 时是「修够几格就走」；`winCount = 0` 则退回更老的一条路 ——
   不跳商店，全部修完 → 总修复事件 + 进度满 + 结束界面。
6. 碎片数量 = 缺口数量，**不打乱顺序**（固定排列，按 `pieceId` 排序，方便调试与美术预览）。
7. 有**空闲引导**：玩家一段时间不操作，就演一遍「手指拖着半透明副本，把池里最前面那块碎片送到它的缺口」。
   碰一下屏幕立刻收掉，再空闲又演一遍，通关才停。见 WORKLOG「空闲引导」。
   ⚠️ 当前 `FeatureFlags.guide` 是**关**的，所以这条实际不生效（见现状速查风险 2）。
8. 有**自动打关**（可选，`FeatureFlags.autoPlay`）：玩家自己修够 `AutoPlayer.afterPlaced` 块之后
   系统接管 —— 收掉玩家输入，剩下的碎片**一批一批**地放走（每一步把池里此刻摆出来的 `batches` 屏
   —— 一屏 = `PiecePool.batchSize` 块 —— 一起放掉，块与块之间错开 `stagger` 起飞，全落完再消耗、
   隔 `gap` 秒放下一批）。走的是玩家同一条流水线，
   所以揭晓 / 音效 / 进度 / 埋点照常，最后一块修好照旧按 `winCount` 跳商店。见 §15 / §16 / WORKLOG「自动打关」。

**无失败态、无扣命、无倒计时**（除非后续明确追加）。「修错」只在配了 `altView` 的槽位上存在，当前走不到。

## 2. 图层结构（三层，自下而上）

```
BackgroundLayer   破败的空白背景（最底）
BrokenLayer       修复前的各个碎片（缺口位置的破损视觉）
RepairedLayer     修复后的图片 + 携带正确遮挡关系的图片
```

- **遮挡关系可配置**：允许同一缺口上存在多层碎片 / 遮挡图，每层带 `zOrder` 字段，吸附成功后按 `zOrder` 设置 `siblingIndex`。
- 每块碎片（Slot）持有：`brokenSprite`（修复前）、`repairedSprite`（修复后）、`overlays[]`（遮挡层，可选）。
- 遮挡层显示时机由配置控制（`IMMEDIATE` 单块修复时显示 / `ON_COMPLETE` 全部完成时显示），默认 `ON_COMPLETE`。
- 实作上 `RepairedLayer` 在本项目里没用，`Repaired` 是槽位节点的子节点 —— 见 §3 的层级表与 WORKLOG「目录与层级的偏差」。

## 3. 节点层级规范（预览态必须可见）

**硬性要求**：所有节点位置、尺寸、锚点在编辑器预览态直接可见可调，**不允许用代码动态生成关键视觉节点**。
代码只允许生成运行时的碎片实例与特效实例。

**唯一的例外**：拼图框那三处（`GameLayer` / `Scene_BG` / `完成背景`）的**尺寸**由
`ui/PuzzleAreaFit.ts` 按底图比例推导（§7.1）—— 它是**派生量，不是作者摆的**，所以在编辑器里
带 `@executeInEditMode` 实时算，看得见的仍然是真值。位置 / 锚点照旧全是手摆的，组件一个字节都不动。

```
Canvas                          Widget 全屏
├── BackgroundLayer             Widget 全屏，挂 BackgroundSwap（横竖屏各一张底图）
│   └── Bg_Sprite               Sprite —— 广告整体背景，四边 Widget + CUSTOM + SLICED
├── GameLayer                   Widget 撑出来的「拼图目标范围」，比整体背景小
│                               ⚠️ 挂了 RECT Mask（同尺寸），出框的图会被裁掉
│   ├── Scene_BG                Sprite —— 拼图场景背景（线稿图）；贴齐
│   │                           GameLayer 四边，所以它就是拼图区的大小，排在最底层
│   │   ├── 完成背景            Sprite —— 修完那张成图，修满后画笔把它刷出来再挪到 Scene_BG 上
│   │   └── 魔法仙尘            ParticleSystem2D —— 笔头走到哪撒到哪（位置每帧由 SceneBgSwap 现算）
│   ├── BrokenLayer             每关一个 PieceSlot 子节点
│   │   ├── Slot_01             PieceSlot 组件（只是分组节点，尺寸不参与玩法）
│   │   │   ├── Broken          Sprite —— 修复前那张图。缺口框就是它的世界包围盒
│   │   │   └── Repaired        RepairedSlot 组件 —— 修复后那张图
│   │   ├── Slot_02
│   │   └── ...                 （当前 6 格）
│   ├── RepairedLayer
│   └── SlotMaskRoot            （可选）缺口遮罩
├── EffectLayer                 特效挂载根节点（RepairSweep / RepairReveal / CircleReveal / StickerApply / TrailEmitter）
├── UILayer                     用户自建，见 §7.3
│   ├── GuideLayer              空闲引导（GuideRoot / GuideGhost / GuideFinger）
│   ├── ProgressLayer           进度显示（四边不贴，尺寸钉死，见 §7.1）
│   └── CtaLayer                结束界面（CtaRoot → End）+ EndgameCta（失败界面 Fail 也挂这儿）
└── PiecePoolLayer              碎片池
    └── ScrollView              Widget：底部贴边，高度自适应
        └── view                挂 RECT Mask
            └── content         Layout = HORIZONTAL，ResizeMode = CONTAINER
├── GameCta                     游戏中常驻的下载按钮。
                                ⚠️ 必须是 Canvas 的子节点、且排在 PiecePoolLayer **后面** ——
                                碎片池底图（PoolBG）一直铺到画布下沿之下，排在它前面就被盖住。
                                竖屏贴下沿（Widget），横屏由 LandscapeLayout 挪到左边空位中点
└── PlayableAnalytics           埋点组件（无节点视觉），见 §17
```

（`DragRoot` 夹在 `PiecePoolLayer` 与 `UILayer` 之间 —— 拖起来的手感碎片要盖住碎片池，但不能盖住 CTA。）

**两层背景**：`BackgroundLayer/Bg_Sprite` 是广告整体背景（铺满整屏），`GameLayer/Scene_BG` 是拼图场景背景
（只有拼图区那么大，空图，修复前的物品是它上面一个个独立节点）。两层之间没有任何代码耦合，纯场景。

**`GameLayer` 上挂了 RECT `Mask`**：矩形取节点自己的 UITransform 尺寸，所以跟 Widget 撑出来的框**永远同尺寸**，
转屏重排后自动跟着变，不需要任何代码。作用是给「拼图目标范围」一个硬边界 ——
`BrokenLayer` / `RepairedLayer` / `Scene_BG` 是它的子节点，超出框的部分只显示框内那一截。
**`DragRoot` 与 `EffectLayer` 是它的兄弟层，不受影响** —— 拿在手上的碎片、拖尾、修复特效会盖过边缘，不该被裁。

- RECT / ELLIPSE 类型的 `Mask` 依赖引擎的 `mask` + `graphics` 两个模块。这两个模块**不能裁**，见 §9。
- 编辑期**也生效**（`Mask` 带 `@executeInEditMode`），所以在编辑器里挪图就能立刻看到哪一截被切掉。
- `Mask` 只改渲染，不改坐标：`PieceSlot.box()` / `PiecePool.carryScaleOf` 读的都是 UITransform，
  吸附与吸附落点照旧按整个世界框算（**贴着边缘的缺口，玩家仍然能把碎片拖到框外那半边的中心去吸附**）。

**`BrokenLayer` / `RepairedLayer` 是纯分组节点**：代码只遍历它们的子节点，**从不读它们的尺寸**
（父节点的尺寸既不裁剪也不移动子节点 —— 只有挂 `Mask` 才裁）。所以这两层的 `contentSize` 跟玩法无关。
会影响的只有 `position` / `anchorPoint` / `scale` —— 槽位一律按**世界坐标**取，整层一动，所有缺口（画面和吸附点）一起动。

命名规范：`层名` 用 PascalCase + Layer 后缀；槽位 `Slot_XX`；修复后节点 `Repaired_XX`；遮挡层 `Overlay_XX_YY`；
背景 `Bg_Sprite`（整体）/ `Scene_BG`（拼图区）/ `PoolBG`（碎片池）。序号从 `01` 起。

## 4. 脚本模块划分

**规范**：单一职责，**每个脚本 ≤ 1000 行**，模块间**只通过 EventBus 通信**，禁止跨模块直接持有引用。

> 📄 **完整目录树与每个脚本的职责见 [docs/ARCH.md](docs/ARCH.md)**（§4 全文）。
> **新增 / 改名 / 找职责落点**时读那一份。
>
> 顶层分包：`core/` 事件与池 · `config/` 开关与商店地址 · `data/` 类型 · `level/` 槽位与关卡 ·
> `gameplay/` 拖拽吸附与揭晓特效 · `ui/` 屏幕适配与进度 · `platform/` MRAID/CTA/埋点 ·
> `audio/` 音频总控 · `bootstrap/` 唯一入口 `GameEntry.ts`。
>
> ⚠️ **「代码里有」不等于「当前场景在用」** —— 哪些组件其实没挂进场景，见 [docs/STATUS.md](docs/STATUS.md)。
> 改名不会断引用（`.scene` 按**脚本 uuid** 记 `__type__`），但 `.ts` 与 `.ts.meta` 必须一起改。

## 5. 事件驱动规范

### EventBus 要求

- 提供 `on(event, cb, target?)` / `off(event, cb, target?)` / `emit(event, ...args)` / `offTarget(target)` / `offAll()`。
- **注册与注销必须对称**：在 `onEnable` 注册，在 `onDisable` 注销；组件销毁时调用 `offTarget(this)` 兜底。
- 事件名统一从 `GameEvent` 取，禁止裸字符串散落在业务代码里。

### 事件清单

| 事件 | 触发方 | 载荷 | 监听方 |
|---|---|---|---|
| `GAME_INIT` | GameEntry | — | 各模块 |
| `LEVEL_BUILT` | LevelFactory | `slotData[]` | PiecePool, SnapSystem, SceneBgSwap, **PlayableAnalytics** |
| `POOL_BUILT` | PiecePool | `PieceEntry[]`（池里那个数组**本身**，会随消耗 splice） | GuideController, LandscapeLayout |
| `PIECE_PICK` | DragController | `pieceNode` | GuideController, AudioManager, **PlayableAnalytics** |
| `PIECE_DRAG` | DragController | `pieceNode, worldPos, slotIndex` | SnapSystem |
| `PIECE_SNAP_SUCCESS` | SnapSystem | `pieceNode, slotIndex` | RepairSystem, AudioManager |
| `PIECE_SNAP_FAIL` | DragController | `pieceNode` | AudioManager |
| `PIECE_REPAIRED` | RepairSystem | `slotIndex, progress` | EndgameCta（**修满 `winCount` 就凭它当场跳**） |
| `REPAIR_FAILED` | PieceSlot（**配了「前置槽位 + 达标后的修复图」的那格**） | `slotIndex` | EndgameCta, GroundWater, AudioManager, **PlayableAnalytics** |
| `PIECE_SHOWN` | PieceSlot | `slotIndex` | RepairSweep, EndgameCta（**只剩失败路**）, SceneBgSwap（**数到最后一格 → 抛 `END_SHOW`**）, AudioManager（数到最后一格 → 魔法光粒） |
| `REPAIR_PROGRESS` | RepairSystem | `current, total` | ProgressController, **PlayableAnalytics** |
| `LEVEL_COMPLETE` | RepairSystem（计数到齐 = **最后一块吸附成功当刻**） | — | RepairSweep, ProgressController, GuideController, AudioManager, **SceneBgSwap（走「直接亮出来」时凭它当刻亮完成图，§18 前面那条）** |
| `END_SHOW` | SceneBgSwap（**最后一格露面**那一刻 = 放置那一段演完） | — | CtaController（**配了结尾视频就先演它、演完才亮界面**，§18）, AudioManager（停全部音） |
| `END_DROP` | CtaController（logo **开始下落**那一刻，比 `END_SHOW` 晚一个 `bgFadeTime`） | — | AudioManager |
| `GAME_OVER` | EndgameCta（终局那一跳发出去之前） | — | DragController, PiecePool, GuideController, GameCta, AudioManager（掐掉自动打关音）, **PlayableAnalytics** |
| `AUTO_PLAY` | AutoPlayer（玩家修够门槛、系统接管那一刻） | — | DragController, PiecePool, GuideController, AudioManager（接管期间不放拿起 / 放置）, **StickerApply（接管后不演收尾脉冲）** |
| `GUIDE_HIDE` | DragController | — | GuideController |
| `GUIDE_HOLD` / `GUIDE_RESUME` | PieceSlot（`repair()` 开头 / `spotDone()` 末尾，**一格一段**） | — | GuideController |
| `CTA_SHOW` / `CTA_CLICK` | CtaController / EndgameCta / GameCta | — | 平台回调, AudioManager（`CTA_CLICK` 停全部音）, **PlayableAnalytics** |
| `ORIENTATION_CHANGED` | GameEntry | `isPortrait` | DragController, PieceGlow, TrailEmitter, LandscapeLayout, BackgroundSwap, PiecePool, GameCta |
| `AUDIO_MUTE` | MraidBridge | `muted` | AudioManager |

**事件与发射方一律不动**：接埋点（§17）、加音效（规则见 [docs/WORKLOG.md](docs/WORKLOG.md) 的「音频：配置列表 + 常驻音」）、加表现，都只在**监听侧**加，
不改发射方，也不新增事件名到业务代码里。§15 的开关表里不出现事件名。

（`AudioManager` 的下拉框里有**一个不是总线事件的选项** `BUTTON_DOWN` —— 它听的是
`AudioManager.buttons` 那几个按钮节点的 `TOUCH_START`，没进这张表、也没进 `GameEvent`。见「音频配置」。）

## 6. 数据配置（换美术不改代码）

**核心诉求：换一套美术，只需要往槽位拖图，不改一行代码。**

实现方式：`PieceSlot` / `RepairedSlot` 用 `@property` 暴露所有美术槽位：

```ts
@property({ type: SpriteFrame, displayName: '修复前（破损图）' }) brokenSprite = null;
@property({ type: SpriteFrame, displayName: '修复后（完整图）' }) repairedSprite = null;
@property({ type: [SpriteFrame], displayName: '遮挡层备用图（顺序即 z 序）' }) overlays = [];
@property({ displayName: '碎片序号' }) pieceId = 0;
@property({ displayName: '吸附半径（px）', tooltip: '0 表示按下面的半径比自动算' }) snapRadius = 0;
@property({ displayName: '吸附半径比', tooltip: '相对缺口短边' }) snapRadiusRatio = 0.25;
@property({ type: OverlayMode, displayName: '遮挡层显示时机' }) overlayMode = OverlayMode.ON_COMPLETE;
@property({ displayName: '层级' }) zOrder = 0;
```

- 每个 `@property` 必须带 `displayName`（中文），**代码标识符保持英文** —— Inspector 里看到中文，grep 代码时还是英文。
  单位与反直觉的语义写进 `tooltip`。数字类参数同理，见 §16。
- 每关一个**关卡 Prefab**（槽位数量、位置、图片可能各不相同），全部关卡共用同一套组件与脚本。
- 缺口的位置、尺寸、吸附半径**一律取「修复前那张图」节点的世界包围盒**（`PieceSlot.box()`），代码里不写死坐标。
  **`Slot_XX` 只是分组节点，它自己的尺寸和玩法无关**。
  - **唯一的例外是拿起时的放大倍率（`PieceSlot.carryHeight` / `PiecePool.carryScaleOf`）：它跟「修复后那张图」走**。
    池里那块碎片本来就是修复后的图，拿起来按它自己的尺寸放大，吸附那一刻才不会跳一下。
  - 因此 `brokenView` 是**必填**的：它既是修复前的画面，也是缺口框的来源。`verify-scene.js` 会报 null。
  - 修复前那张图必须是槽位节点的**子节点**，不能就在槽位节点自己身上 —— `repair()` 是把 `brokenView.node`
    整个隐藏掉，挂在槽位节点上会连修复后的图一起藏了。
  - 包围盒取的是节点的 `UITransform` 矩形，所以那张图的 Sprite 尺寸模式要是 `CUSTOM`。
  - 「修复前 / 修复后」两张图必须**同位置同尺寸**，否则修复瞬间会跳一下。
  - ⚠️ **量一个节点自己的框一律手算**：`contentSize × worldScale` + `anchorPoint` + `worldPosition`。
    **不要用 `UITransform.getBoundingBoxToWorld()`** —— 它会把「活着的子节点」并进结果（挂了项目影、
    序列帧节点、`PeelBack`、`Glow` 之后框就悄悄变大，缺口框和拿起倍率跟着错）。
- 碎片池顺序由槽位 `pieceId` 决定，不打乱。**`pieceId` 必须唯一** —— 并列时退化成场景里的子节点顺序
  （`Array.sort` 稳定），能跑但留隐患。
- 新增关卡 = 复制 Prefab → 换图 → 调位置，零代码改动。

## 7. UI 与屏幕适配

> 📄 **全文已移到 [docs/ADAPT.md](docs/ADAPT.md)**（§7.1 双方向支持 / §7.2 安全区 / §7.3 适配与接口边界）。
> **动转屏、撑满、Widget 对齐、横屏两栏、拼图框自适应、碎片池竖栏之前，先读那一份。**
>
> 留在本文件的总则只有一句：**重排全部交给 Widget，代码基本不参与**（`ScreenAdapter` 改的是画布策略、
> 一个节点坐标都不碰；`LandscapeLayout` 是唯一的例外）。

## 8. AppLovin / MRAID 接入规范

> 📄 **全文已移到 [docs/RELEASE.md](docs/RELEASE.md)**（§8.1 要求对照表 / §8.2 启动时序与构建管线 /
> §8.3 CTA / §8.4 音频策略 / §8.5 构建与打包 / §8.6 三平台 / §8.7 分发包）。
> **碰 MRAID、CTA、打包器、多平台产物之前，先读那一份。**
>
> 四条红线留在这儿，改任何外壳层代码都不许破：
> ① **只允许 `mraid.open()`**（禁 `window.open` / `location.href`）；② **不自建任何关闭按钮**；
> ③ **音频必须在首次用户交互之后才响**（解锁两条路：全局 `input` + `PIECE_PICK`）；
> ④ 交付是**单个内联 HTML < 5MB**，不引用任何外部托管文件（Google 的 exitapi 是唯一例外）。

## 9. 引擎模块裁剪

**目的**：AppLovin 要求单 HTML < 5MB，且资源 base64 后体积膨胀约 33%。引擎体积是最大的可控项。

体积预算（目标）：引擎 ≤ 1.2MB、全部美术资源 ≤ 2.5MB（base64 编码前）、脚本 + 配置 + 其余 ≤ 0.5MB。

在 `设置 → 功能裁剪` 中关闭以下模块：

**必关**：`spine-3.8`、`spine-4.2`、`dragon-bones`、`tiled-map`、`webview`、`physics-2d`
（含 box2d 系列）、`profiler`、`geometry-renderer`、`terrain`、`light-probe`、`xr`、`intersection-2d`
（吸附用简单距离计算，不需要碰撞检测）。

⚠️ **`video` 是这条清单的唯一例外**（2026-10-15 起开着）：结尾视频（§18）要用 `cc.VideoPlayer`，
关掉它组件直接不存在。引擎体积的代价见 WORKLOG 实测。

**必留**：`mask` + `graphics` —— 场景里有两处硬依赖（`GameLayer` 的拼图区边界、`PiecePoolLayer/ScrollView/view`
的池裁剪），RECT 类型内部就建 `cc.Graphics`。两个都关掉就是整块拼图区不再裁剪，且 `Mask` 组件在运行期报错。

**按需**：
- `particle-2d` — **必留**：`Scene_BG/魔法仙尘` 那个 `ParticleSystem2D`（完成背景的仙尘）是硬依赖，裁掉它整条画笔涂色的粒子就没了。
- `animation` — 若修复表现用 `AnimationClip` 则保留，纯 tween 则关闭（当前保留）。
- `rich-text` — 引导文案若需富文本则保留，否则关闭。

**不要动** `render-pipeline`（保持 `custom-pipeline`，改动风险高、收益低）。

裁剪必须在**功能开发完成后**统一执行并回归测试。

⚠️ **两处字段要一致，面板不保证帮你同步**：`settings/v2/packages/engine.json` 里
`modules.configs.defaultConfig.cache.<模块>._value` 和同级的 `includeModules` 数组是分开写的，改完要
`grep includeModules` 对一遍。若两处都对了、产物里却还有该模块，那就是**引擎没重编**（builder 用了 `temp/` 里的旧引擎）：
去 `设置 → 功能裁剪` 里改一次并保存，逼它重编，光改 JSON 不够。

## 10. 工作方式约定

- **不截图、不识别图片**：禁止任何耗费 token 的视觉分析操作。
- **动手前先搜一轮现成方案，别重复造轮子** —— 不管是**表现 / 效果**（拖尾、揭晓、扫光、涂色、贴纸、
  屏震、缓动、材质刷）还是**工程 / 接入问题**（构建打包、体积压缩、引擎模块裁剪、MRAID / 各平台适配、
  引擎自身的坑）：**先翻本仓库 [docs/WORKLOG.md](docs/WORKLOG.md)（同一件事很可能已经踩过），再上网搜**
  —— 官方文档 / 官方示例仓库 / Cocos 论坛 / GitHub / Stack Overflow，关键词 `cocos creator 3.x` + 问题点。
  **先找，确实没有再自己动手。**
  - 抄回来**先核对引擎版本**：本项目 3.8.8，3.7 以前的老写法（`cc.` 命名空间、旧材质 / effect 格式）
    直接对不上，白改一轮。
  - 优先级 **引擎自带 > 官方示例 > 社区实现 > 自研**。现在的 `BrushReveal` 走的就是
    「引擎的 `EffectAsset` + 材质刷」，不是自己撸渲染 —— 这是这类需求的默认姿势。
  - 用了外部方案 / 看过但否掉了，都在 [docs/WORKLOG.md](docs/WORKLOG.md) 对应小节记一行
    **来源链接 + 为什么没用 / 改了什么**，免得下一轮又搜一遍同一件事。
  - ⚠️ 这条与上面「不截图」不冲突：禁的是视觉分析，**查文档、搜代码是允许且鼓励的**。
- **优先 MCP**：编辑器内的场景搭建、节点创建、组件挂载、预制体操作全部走 `funplay_cocos` MCP。
- **零冗余代码**：不写解释性注释（除非逻辑非直观）、不写防御性判空、不写用不到的分支与兜底、
  不预留"以后可能用到"的接口。
- **不生成无关文件**，不擅自改动职责范围外的脚本。临时探针跑完就删（且收尾一律 `try / finally`）。
- **每次提交配一个短文档**：在 `docs/changes/` 下新建 `YYYY-MM-DD-<简述>.md`，抄 [TEMPLATE.md](docs/changes/TEMPLATE.md)。
  四段就够 —— **改了什么 / 为什么这么改（含否掉的方案）/ 怎么验的 / 影响什么+还没验的部分**。
  写完 `git add` 一起提交，提交后把 short hash 回填进文档。**这是 git 一句话摘要替代不了的**（当时全仓库只有 6 个 commit，
  全是一行摘要，而踩坑细节只在 WORKLOG 里 —— 所以别再让 WORKLOG 独自承担这件事）。
- **省 token 的工作方式**（本文件**每轮都注入**，所以下面每条都直接影响开销）：
  - **一次工具调用干多件事**，中间**不要逐句解说** —— 解说的字既进历史又每轮重发。
  - **只打印提取结果**，别把整个文件 / 整棵目录树 dump 出来；要上下文就用 `read` 带 offset/limit。
  - ⚠️ **改本文件一次改完**：每编辑一次，DSH 就会**把整份 AGENTS.md 重新注入一遍**（约 37KB/次）。
    先把要改的攒在一起再落笔；能写进 docs/ 的就别动这一份。
  - 大范围探查（查资料、通读陌生代码）**交给 subagent** —— 它的中间步骤不进本会话上下文。
  - 收尾报告**默认 ≤ 10 行**：结论 + 改了什么 + 待你决定，不复述过程。
- **当我说「这个项目可以结束了」**（或同义说法：收尾了 / 交付了 / 今天到这），**按顺序做三件事，别多问**：
  1. 切出新分支，命名 **`Puzzle_<年月日6位>_<项目名>`** —— 年月日是 `YYMMDD`，
     项目名取本次交付的概括，例：`Puzzle_261015_PlayableAd`。**不直接提交到主线**。
  2. 提交工作区（先补上 `docs/changes/` 那条记录），再 `git push -u origin <分支名>`；
     **没有 remote 就跳过推送并告诉我**，别自作主张加远程。
  3. 写**工作日报**存到 `docs/reports/YYYY-MM-DD.md`，同时在回复里原样贴出：
     **只回答「今天干了什么」，≤100 字**，用 `1. 2. 3. 4.` **一条条列**，每条一句话；
     不写过程、不写原理、不写待办、不加小标题。
- 每次只实现一个模块并自检，不一次性铺开全部代码。
- **改完 `.ts` 要 `refresh_assets`**，否则预览跑的仍是旧包（预览 chunk 是启动时编的）。
- **改完场景要跑 `verify-scene.js`**（只读）。**`tools/js/build-scene.js` 是危险动作，别再跑了** ——
  它把 Canvas 下所有层 destroy 再重建，你手摆的整棵层级会一起没。
- 场景改完**别只看自动存盘那行**：`exec.mjs` 末尾那次存盘可能静默失败（返回 `⚠️ 场景没存上`），
  再调一次 `node tools/exec.mjs editor tools/js/save.js` 就成功。核对要读文件，不是读内存。

## 11. 实现顺序

> 📄 已归入 [docs/WORKLOG.md](docs/WORKLOG.md) 的「附录：从 AGENTS.md 移出的规范章节（§11–§13）」。
> 那是**从零重建**时的参考顺序 —— 当前 39 个脚本 + 场景都已完成，这一节只剩历史价值。

## 12. 待确认假设

> 📄 同上附录。四条假设（单块修复的定义 / 碎片池形态 / 吸附半径优先级 / 不放干扰碎片）**都已经落地**，
> 现在的事实来源是 §6 与 [docs/TUNING.md](docs/TUNING.md)，不必再当"待确认"看。

## 13. 主动建议与风险（需决策）

> 📄 同上附录。多数条目已标「已完成」；**仍未结的交付风险**只有两条 —— Moloco 的 `XMLHttpRequest`
> 字面量、以及 Moloco / Google 都还没上真机或官方校验器，见 [docs/RELEASE.md](docs/RELEASE.md) 与「现状速查」。

## 14. 已实现的功能与踩坑索引

**本节的正文已移到 `docs/worklog/`**（原 §14「实现现状与偏差」—— 踩坑档案而不是规范，含实测读数、
被否掉的方案、以及每条末尾的「还没验的部分」）。**入口是 [docs/WORKLOG.md](docs/WORKLOG.md) 的索引**：
先按功能名找到对应文件（`docs/worklog/01..13-*.md`，每个 10–40KB），**再只读那一个**。常见入口：

| 想查 | 去 WORKLOG 找 |
|---|---|
| 某格的表现是怎么接的（揭晓 / 收尾动作 / 换节点） | 「场景现在的揭晓接线」「Slot_0N …」 |
| 拖动相关（亮边 / 拖尾 / 点击收不到） | 「点击碎片没反应」「拖动特效」 |
| 进度条 / 音频 / 空闲引导 | 同名小节 |
| 横竖屏 / 撑满 / 结束界面 / 常驻按钮 | 「竖屏撑满屏幕」「结束界面」「游戏中常驻的下载按钮」 |
| 贴纸揭角 / 贴平 | 「贴纸揭角」「揭角参数按格配」「修复贴纸贴平」 |
| 终局跳转、「点哪里都跳」 | 「终局跳转」「"点哪里都跳"是怎么做到的」 |
| 自动打关 / 音频那几条怎么接的 | 「自动打关」「音频改版」 |
| 完成背景那支画笔 + 魔法仙尘 | 「完成背景复用「画笔涂色」」 |
| 单块揭晓为什么走「贴纸贴平」而不是画笔 | 「单块揭晓改成「画笔涂色」」+ 现状速查 |

## 15. 功能开关（`config/FeatureFlags.ts`）

`assets/scripts/config/FeatureFlags.ts` 是**唯一的开关面板**：一个布尔字段关掉一整项可选表现。
它是个组件，**挂在 Canvas 上**，值在 Inspector 里勾。改完**存场景 + 重开预览** —— 面板是场景数据，
跑着的那个预览不会热更新。**当前各开关的值见上面「现状速查」。**

| 开关 | 关掉以后 | 落点 |
|---|---|---|
| `pieceGlow` | 碎片不再生成 Glow 子节点与材质 | `gameplay/PieceFactory.ts` |
| `stickerPeel` | 碎片不再挂 `StickerPeel`，拿起时没有揭角那一下 | `gameplay/PieceFactory.ts`（两处一起） |
| `trail` | 不生成白点贴图、不建拖尾节点 | `gameplay/TrailEmitter.ts` |
| `revealOnRepair` | 修好时不再播序列帧、也不放大，修复图照旧瞬间出现 | `gameplay/RepairReveal.ts` |
| `stickerApply` | 配了「贴纸贴平揭晓」的槽位不再演那一下 —— 破损图收掉、修复图直接出现 | `gameplay/StickerApply.ts` |
| `circleReveal` | 配了「圆形扩散揭晓」的槽位退回「序列帧 + 放大」 | `gameplay/CircleReveal.ts` |
| `brushReveal` | 配了「画笔涂色揭晓」的槽位不再刷 —— 破损图当场收掉、修复图直接出现 | `gameplay/BrushReveal.ts` |
| `sweepOnRepair` | 单块吸附成功不再扫光 | `gameplay/RepairSweep.ts` |
| `sweepOnComplete` | 全部修完不再扫光（收尾少一拍；`SceneBgSwap.delay` 要跟着填 0） | `gameplay/RepairSweep.ts` |
| `guide` | 空闲引导整棵 `GuideRoot` 藏起来，也不注册任何监听（含全局 `input` 那条） | `ui/GuideController.ts` |
| `progress` | 进度层整层隐藏 | `ui/ProgressController.ts` |
| `audio` | 不注册任何音频监听（含首次触摸解锁那条全局 `input` 监听） | `audio/AudioManager.ts` |
| `autoPlay` | 不注册任何监听，玩家自己修完为止（门槛 / 节奏在 `AutoPlayer` 上，见 §16） | `gameplay/AutoPlayer.ts` |

**读侧与组件顺序无关**：消费方照旧写 `FeatureFlags.audio`（静态 getter），getter 每次现扫场景找那个面板实例。
这不是绕远路：同节点的组件 `onLoad` / `onEnable` 按数组顺序走，而 `AudioManager` 就挂在 Canvas 上、
在 `onEnable` 里读开关 —— 面板要是刚好排在它后面，开播时读到的就是默认值。

面板不在场时（编辑模式不跑生命周期；面板被误删）getter 退回 `DEFAULTS`（全开）—— 删掉面板不会让玩法残缺，
但会**静默忽略勾选**，这就是 `verify-scene.js` 里那条 `FeatureFlags` 存在性检查的意义。
唯一的例外是 `autoPlay`，它在 `DEFAULTS` 里是 `false`：它改的是**玩法本身**（玩家放几块之后系统接管），
不是「多演一下少演一下」，面板丢了就该退回「玩家自己修完」的老行为，而不是替他打完。
挂载走 `tools/js/mount-flags.js`（幂等，已有就原样保留值，不会复位）。
**Scene 根节点挂不了组件**（引擎直接报错），所以别想着往那儿挪。

**落点规则**：gate 放在「会建节点 / 生成贴图 / 起 tween / 改 active」的那一句前面，
`onEnable` 与 `onDisable` 的对称性一律不动（`EventBus.off` 对没注册过的回调是安全的）。

- 整个组件只干这一件事（`TrailEmitter` / `AudioManager` / `AutoPlayer`）：`onLoad` / `onEnable` 首行 early return。
- 关掉后要顺带藏起自己那棵「作者可见」节点的（`GuideController` / `ProgressController`）：
  在 `onEnable` 里先 `hideAll()` / `root.active = false` 再 return。
- 一个组件管两个开关（`RepairSweep`）：gate 在两个 handler 首行，不 gate 监听注册。
- 挂在别人身上的（`PieceGlow`）：由 `PieceFactory` 两处一起决定（不 `addComponent` + 不调 `apply`），
  少任一处就是空引用或白建节点。

⚠️ **运行期开关省不下字节**：web-mobile 产物是 SystemJS `System.register` 模块、`mangleProperties: false`，
跨模块没有死代码消除 —— 被关掉的代码、以及它引用的 `.effect` 资源照旧进包。省下的只有运行期开销。
**开关之外真正能省体积的只有 §9 的引擎裁剪。**

**合规项不进开关表**：转屏重排、MRAID 生命周期、CTA、**埋点（§17）** —— 关掉就是不合规，
不给开关，免得手滑关掉交出去。

## 16. Inspector 里的调参表

> 📄 **表格全文已移到 [docs/TUNING.md](docs/TUNING.md)**（参数名 / 字段 / 挂在哪个组件 / 现在还有没有生效）。
> 它下面那「七条踩过的坑」（揭角按形状逐格配、碎片间距改定值、整行永远居中、收尾三拍靠两个数凑一对、
> `batches` 的代价、新增 `@property` 要刷资源库、`build-scene.js` 别再跑）搬到了
> [docs/WORKLOG.md](docs/WORKLOG.md) 同一份附录里。
>
> **总原则不变：能调的数全在 Inspector，代码里一个常量都不留。**

## 17. 埋点（Playable Analytics）

> 📄 **全文在 [docs/ANALYTICS.md](docs/ANALYTICS.md)**（§1–§6 是可移植的接入规范，§7 是本项目的接线）。
> 一句话现状：接在 [PlayableAnalytics.ts](assets/scripts/platform/PlayableAnalytics.ts)，**只听 `EventBus`、
> 发射方一行没改**；只用官方预定义事件名；里程碑分母是 `EndgameCta.winCount`（**现在 = 0 ⇒
> `CHALLENGE_SOLVED` 永不上报**，与「现状速查」第 2 条是同一件事，交审前必须确认）；埋点不给开关。

## 18. 结尾视频（`platform/EndVideo.ts`）

> 📄 **全文见 [docs/VIDEO.md](docs/VIDEO.md)** —— 节点结构、四约束、声音、打包、体积估算、还没验的部分。
> 动视频 / 换片源之前读那一份。

