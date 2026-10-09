# 拼图修复 · 试玩广告 项目开发规范

> 本文档是本项目的长期规范，也是每次迭代的实现 Prompt。所有改动必须遵守本文约定。

## 0. 项目基线

| 项 | 值 |
|---|---|
| 引擎 | Cocos Creator **3.8.8**，TypeScript |
| 项目路径 | `d:\cocos\Puzzle_new` |
| 设计分辨率 | **720 × 1280**，fitHeight + fitWidth |
| 方向 | 竖屏 |
| 类型 | 拼图修复类试玩广告（Playable Ad） |
| 投放平台 | **AppLovin**（MRAID v2.0、单 HTML 内联、总体积 < 5MB） |
| 编辑器操作 | 通过 MCP `funplay_cocos`（HTTP `http://127.0.0.1:8765/`） |

**前置条件**：Cocos Creator 编辑器必须打开本项目且 `funplay-cocos-mcp` 扩展已加载（8765 端口在监听），MCP 工具才可用。所有场景 / 节点 / 预制体 / 组件挂载操作优先走 MCP，不手写 `.scene`、`.prefab` JSON。

## 1. 玩法定义

1. 屏幕下方是**碎片池**，玩家从中拖动碎片。
2. 拖动碎片靠近目标缺口，**进入吸附半径即自动吸附**（不需要松手，也不需要精确对位）。
3. 未进入任何正确缺口范围就放开（或拖到错误位置）→ 碎片 **tween 弹回碎片池原位**。
4. 每次成功吸附触发**单块修复事件**：该缺口位置由「修复前」切换到「修复后」，播放局部反馈。
5. 全部碎片归位 → 触发**总修复事件**：整体表现 + 进度满 + 引导 CTA。
6. 碎片数量 = 缺口数量，**不打乱顺序**（固定排列，方便调试与美术预览）。
7. 有**空闲引导**：玩家一段时间不操作，就演一遍「手指拖着半透明副本，把池里最前面那块碎片送到它的缺口」。碰一下屏幕立刻收掉，再空闲又演一遍，通关才停。见 §14「空闲引导」。

**无失败态、无扣命、无倒计时**（除非后续明确追加）。

## 2. 图层结构（三层，自下而上）

```
BackgroundLayer   破败的空白背景（最底）
BrokenLayer       修复前的各个碎片（缺口位置的破损视觉）
RepairedLayer     修复后的图片 + 携带正确遮挡关系的图片
```

- **遮挡关系可配置**：允许同一缺口上存在多层碎片 / 遮挡图，每层带 `zOrder` 字段，吸附成功后按 `zOrder` 设置 `siblingIndex`。
- 每块碎片（Slot）持有：`brokenSprite`（修复前）、`repairedSprite`（修复后）、`overlays[]`（遮挡层，可选）。
- 遮挡层显示时机由配置控制（`IMMEDIATE` 单块修复时显示 / `ON_COMPLETE` 全部完成时显示），默认 `ON_COMPLETE`。

## 3. 节点层级规范（预览态必须可见）

**硬性要求**：所有节点位置、尺寸、锚点在编辑器预览态直接可见可调，**不允许用代码动态生成关键视觉节点**。代码只允许生成运行时的碎片实例与特效实例。

```
Canvas                          Widget 全屏
├── BackgroundLayer             Widget 全屏
│   └── Bg_Sprite               Sprite —— 广告整体背景，铺满屏幕
├── GameLayer                   Widget 撑出来的「拼图目标范围」，比整体背景小
│                               ⚠️ 挂了 RECT Mask（同尺寸），出框的图会被裁掉
│   ├── Scene_BG                Sprite —— 拼图场景背景（空图占位，美术自己拖）；贴齐
│   │                           GameLayer 四边，所以它就是拼图区的大小，排在最底层
│   ├── BrokenLayer             每关一个 PieceSlot 子节点
│   │   ├── Slot_01             PieceSlot 组件（只是分组节点，尺寸不参与玩法）
│   │   │   ├── Broken          Sprite —— 修复前那张图。缺口框就是它的世界包围盒
│   │   │   └── Repaired        RepairedSlot 组件 —— 修复后那张图
│   │   ├── Slot_02
│   │   └── ...
│   ├── RepairedLayer
│   │   ├── Repaired_01         RepairedSlot 组件
│   │   └── Overlay_01_01       zOrder 可配
│   └── SlotMaskRoot            （可选）缺口遮罩
├── EffectLayer                 特效挂载根节点
├── UILayer                     用户自建，见 §7
│   ├── GuideLayer              文字引导 + 手指指引
│   ├── ProgressLayer           进度显示
│   └── CtaLayer                EndCard / 下载按钮
└── PiecePoolLayer              碎片池
    └── ScrollView              Widget：底部贴边，高度自适应
        └── view
            └── content         Layout = HORIZONTAL，ResizeMode = CONTAINER
                                ScrollView 横向滚动
└── GameCta                     游戏中常驻的下载按钮（§14）。⚠️ 必须是 Canvas 的子节点、且排在
                                PiecePoolLayer 后面 —— 碎片池底图（PoolBG）一直铺到画布下沿之下，
                                排在它前面就被盖住。位置：竖屏归节点上的底部 Widget，横屏由
                                LandscapeLayout 挪到左边空位的中点（见 §14）
```

**两层背景**：`BackgroundLayer/Bg_Sprite` 是广告整体背景（铺满整屏），`GameLayer/Scene_BG` 是拼图场景背景（只有拼图区那么大，空图，修复前的物品是它上面一个个独立节点）。两层之间没有任何代码耦合，纯场景。

**`GameLayer` 上挂了一个 RECT `Mask`**：矩形取节点自己的 UITransform 尺寸，所以跟 Widget 撑出来的框**永远同尺寸**，转屏重排后自动跟着变，不需要任何代码。作用是给「拼图目标范围」一个硬边界 —— `BrokenLayer` / `RepairedLayer` / `Scene_BG` 是它的子节点，超出框的部分（demo 里 `Slot_01` 往上顶出 68px）只显示框内的那一截。**`DragRoot` 与 `EffectLayer` 是它的兄弟层，不受影响** —— 这是要的效果：拿在手上的碎片和拖尾会盖过边缘，不该被裁。`Mask` 只改渲染，不改坐标：`PieceSlot.box()` / `PiecePool.carryScaleOf` 读的都是 UITransform，吸附与吸附落点照旧按整个世界框算（**贴着边缘的缺口，玩家仍然能把碎片拖到框外那半边的中心去吸附**）。
- RECT / ELLIPSE 类型的 `Mask` 依赖引擎的 `mask` + `graphics` 两个模块（内部会在这同一个节点上建一个 `cc.Graphics`）。这两个模块**不能裁**，见 §9。
- 编辑期**也生效**（`Mask` 带 `@executeInEditMode`，`onEnable` 里直接 `_enableRender()`），所以在编辑器里挪 `Slot_01` 的图就能立刻看到哪一截被切掉，不用开预览。

**`BrokenLayer` / `RepairedLayer` 是纯分组节点**：代码只遍历它们的子节点，**从不读它们的尺寸**（父节点的尺寸既不裁剪也不移动子节点 —— 只有挂 `Mask` 才裁）。所以这两层的 `contentSize` 跟玩法无关：`GameLayer` 缩到 478×565 之后它们还是 720×980，不影响任何东西，也不必跟着变；现在虽然 `GameLayer` 有 `Mask`，裁的也是**世界位置**落在框外的那部分，与这两层的 `contentSize` 无关。会影响的只有 `position` / `anchorPoint` / `scale` —— 槽位一律按**世界坐标**取，整层一动，所有缺口（画面和吸附点）一起动。想让编辑期的框也对上拼图区，给它们也挂四边 Widget（`t/b/l/r` 全 0）即可：两层中心本来就在 `GameLayer` 的中心，挂上去不会挪动任何槽位。

命名规范：`层名` 用 PascalCase + Layer 后缀；槽位 `Slot_XX`；修复后节点 `Repaired_XX`；遮挡层 `Overlay_XX_YY`；背景 `Bg_Sprite`（整体）/ `Scene_BG`（拼图区）/ `PoolBG`（碎片池）。序号从 `01` 起。

## 4. 脚本模块划分

单一职责，**每个脚本 ≤ 1000 行**，模块间**只通过 EventBus 通信**，禁止跨模块直接持有引用。

```
assets/scripts/
├── core/
│   ├── EventBus.ts          事件总线（on / off / emit / offAll）
│   ├── GameEvent.ts         事件枚举（唯一事件名来源）
│   └── PoolManager.ts       通用对象池管理
├── config/
│   ├── PlayableConfig.ts    商店地址（打包器的占位符闸门扫这里）
│   └── FeatureFlags.ts      功能开关表：一个开关关掉一整项可选表现，见 §15
├── data/
│   └── LevelTypes.ts        配置数据类型定义（SlotData / LevelData / ZOrder / OverlayMode）
├── level/
│   ├── LevelFactory.ts      从关卡 Prefab 构建关卡，输出槽位数据
│   ├── PieceSlot.ts         单槽位组件：@property 暴露所有可拖图槽 + zOrder
│   └── RepairedSlot.ts      修复后节点组件：可配显隐时机
├── gameplay/
│   ├── PieceFactory.ts      碎片视图工厂（创建 / 回收 / 复位）
│   ├── PiecePool.ts         碎片池（Layout 内横向排列，对象池复用）
│   ├── DragController.ts    拖拽输入（触摸事件 → 位置更新）
│   ├── SnapSystem.ts        吸附判定（距离 < snapRadius → 吸附）
│   └── RepairSystem.ts      修复流程：单块修复 + 进度 + 总修复
├── ui/
│   ├── GuideController.ts   空闲引导：手指 + 半透明副本演一遍拖动（纯画面，不碰玩法）
│   ├── ProgressController.ts 进度显示
│   ├── ScreenAdapter.ts     屏幕策略：按窗口比例换 ResolutionPolicy 把画布撑满（见 §7.1）
│   ├── LandscapeLayout.ts   横屏两栏布局：拼图区放大居中偏左 + 碎片池竖栏在右（见 §7.1）
│   └── BackgroundSwap.ts    横竖屏各一张底图，转屏换 `Bg_Sprite` 的 spriteFrame（见 §7.1）
├── platform/
│   ├── MraidBridge.ts       MRAID 生命周期、ready 时序、平台判定、静音通知（`openStore()` 是唯一跳转入口）
│   ├── CtaController.ts     结束界面：背景淡入 + logo / 按钮下落弹跳，以及 mraid.open() 跳转
│   └── GameCta.ts           游戏中常驻的下载按钮：竖屏贴下沿（Widget）/ 横屏由 LandscapeLayout
│                            挪到左边空位中点 + 呼吸，见 §14
├── audio/
│   └── AudioManager.ts      音频总控：配置列表（激活事件 / 音效 / 音量 / 结束事件），见 §14
└── bootstrap/
    └── GameEntry.ts         唯一入口，负责初始化与模块装配
```

## 5. 事件驱动规范

### EventBus 要求
- 提供 `on(event, cb, target?)` / `off(event, cb, target?)` / `emit(event, ...args)` / `offTarget(target)`。
- **注册与注销必须对称**：在 `onEnable` 注册，在 `onDisable` 注销；组件销毁时调用 `offTarget(this)` 兜底。
- 事件名统一从 `GameEvent` 取，禁止裸字符串散落在业务代码里。

### 事件清单

| 事件 | 触发方 | 载荷 | 监听方 |
|---|---|---|---|
| `GAME_INIT` | GameEntry | — | 各模块 |
| `LEVEL_BUILT` | LevelFactory | `slotData[]` | PiecePool, SnapSystem |
| `POOL_BUILT` | PiecePool | `PieceEntry[]`（池里那个数组**本身**，会随消耗 splice） | GuideController |
| `PIECE_PICK` | DragController | `pieceNode` | GuideController, AudioManager（另有解锁那一条） |
| `PIECE_DRAG` | DragController | `pieceNode, worldPos, slotIndex` | SnapSystem |
| `PIECE_SNAP_SUCCESS` | SnapSystem | `pieceNode, slotIndex` | RepairSystem, AudioManager（配了才听） |
| `PIECE_SNAP_FAIL` | DragController | `pieceNode` | AudioManager（配了才听） |
| `PIECE_REPAIRED` | RepairSystem | `slotIndex, progress` | 暂无（扫光已改听 `PIECE_SHOWN`） |
| `TAPE_REVEAL` | TapeReveal | `slotIndex` | AudioManager（配了才听） |
| `PIECE_SHOWN` | PieceSlot | `slotIndex` | RepairSweep |
| `WINDOW_REPAIRED` | PieceSlot（**配了胶带揭晓的那格**，即窗户） | `slotIndex` | AudioManager（配了才听） |
| `REPAIR_PROGRESS` | RepairSystem | `current, total` | ProgressController |
| `LEVEL_COMPLETE` | RepairSystem | — | RepairSweep, ProgressController, GuideController, AudioManager（配了才听） |
| `END_SHOW` | SceneBgSwap（底图**换完**那一刻） | — | CtaController, AudioManager（停全部音） |
| `END_DROP` | CtaController（logo **开始下落**那一刻，比 `END_SHOW` 晚一个 `bgFadeTime`） | — | AudioManager（配了才听；结束界面自己要响的音绑这条，见 §14） |
| `GUIDE_HIDE` | DragController | — | GuideController |
| `CTA_SHOW` / `CTA_CLICK` | CtaController | — | 平台回调，AudioManager（`CTA_CLICK` 停全部音） |
| `ORIENTATION_CHANGED` | GameEntry | `isPortrait` | DragController, PieceGlow, TrailEmitter |
| `AUDIO_MUTE` | MraidBridge | `muted` | AudioManager |

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

- 每个 `@property` 必须带 `displayName`（中文），**代码标识符保持英文** —— Inspector 里看到中文，grep 代码时还是英文。单位与反直觉的语义写进 `tooltip`。数字类参数同理，见 §16。
- 每关一个**关卡 Prefab**（槽位数量、位置、图片可能各不相同），全部关卡共用同一套组件与脚本。
- 缺口的位置、尺寸、吸附半径**一律取「修复前那张图」节点的世界包围盒**（`PieceSlot.box()`），代码里不写死坐标。你在编辑器里怎么挪、怎么缩放那张图，吸附范围、吸附落点（`worldCenter`）、拿起时的放大倍率（`PiecePool.carryScaleOf`）都跟着走。**`Slot_XX` 只是分组节点，它自己的尺寸和玩法无关**（原来读的是它，用 scale 调图就会和视觉脱节）。
  - 因此 `brokenView` 是**必填**的：它既是修复前的画面，也是缺口框的来源。`verify-scene.js` 会报 null。
  - 修复前那张图必须是槽位节点的**子节点**（现在的 `Slot_01/Broken`），不能就在槽位节点自己身上 —— `repair()` 是把 `brokenView.node` 整个隐藏掉，挂在槽位节点上会连修复后的图一起藏了。
  - 包围盒取的是节点的 `UITransform` 矩形，所以那张图的 Sprite 尺寸模式要是 `CUSTOM`（不然画的框和矩形的对不上）。
  - 「修复前 / 修复后」两张图必须**同位置同尺寸**，否则修复瞬间会跳一下。
- 碎片池顺序由槽位 `pieceId` 决定，不打乱。
- 新增关卡 = 复制 Prefab → 换图 → 调位置，零代码改动。

## 7. UI 与屏幕适配

### 7.1 双方向支持（硬性要求）

广告**必须同时支持横屏与竖屏全屏**，且中途转屏不能中断玩法。禁止锁定方向，禁止提示用户旋转屏幕。

- **撑满屏幕（2026-10-09 改，横屏同日补上）**：原来 `fitHeight + fitWidth` 都开 = SHOW_ALL，它把画布**钉死在 720×1280**，比设计稿大出来的屏幕没有任何节点去画 —— 就是竖屏上下、横屏左右那两条黑边。现在 `ui/ScreenAdapter.ts` 在 `GameEntry.onLoad` 里按窗口真实比例换策略：比设计稿**瘦**（手机竖屏，比例 < 720/1280）走 `FIXED_WIDTH`（画布高度补出来）、比设计稿**胖**（iPad 竖屏、横屏、宽扁窗口）走 `FIXED_HEIGHT`（画布宽度补出来）。横竖屏走的是**同一句**「补长边」，没有任何方向分支。两条都是**补长边**——画布撑满屏幕，设计稿内部一个像素不裁、比例不变，多出来的那条边是真实画布，四边拉满的层自己就铺过去了。转屏 / 改窗口尺寸走 `screen.on('window-resize')` 重算。
  - **横屏也补长边（2026-10-09）**：横屏比例恒大于设计稿的 720/1280，所以横屏补出来的是**宽度** —— 画布变成 1770×1280 这种宽幅，设计稿正好吃满高度、左右各多出 (画布宽 − 720)/2 由背景铺满，黑边归零。`ScreenAdapter` 只管策略，横屏的构图由下面这个模块重排。
  - **横屏两栏（2026-10-09，`ui/LandscapeLayout.ts`，挂在 Canvas 上）**：拼图区与进度条等比放大到 `scale`（默认 1.4，约吃满屏幕高度）后**居中偏左**，碎片池竖过来当**右边那栏**；两栏整体在画布上居中，所以拼图列在左、竖栏在右，横向留白对称。
    - **竖栏就是碎片池自己**：`Layout.type` HORIZONTAL→VERTICAL、间距换成 `spacingY`、四边 padding 对称、`ScrollView` 改成只上下滚、`view`（Mask 那层）与池层改成栏的尺寸 —— 栏高 = 所有碎片高之和 + 间距 + 上下边距（`Layout` 算的），**栏宽得自己量**：`Layout._doLayout` 的 VERTICAL 分支只写 `height`，宽度留着不动，所以取「最宽那块 + 左右边距」。
    - ⚠️ **交叉轴必须压平，否则转屏后四块碎片连成一条斜线（2026-10-09）**：引擎的 `Layout` **只写主轴**（`HORIZONTAL` 写 x、`VERTICAL` 写 y），另一条轴走 `fnPositionY` / `fnPositionX`，而它们是 `this._isAlign ? Vec3.ZERO : child.position` —— 不压平就**原样沿用子节点上一次的坐标**（`cocos/ui/layout.ts:1119` / `:1131`）。后果：切横屏时 `VERTICAL` 只重写 y，x 还是竖屏那一行的值（实测 `-302.7, -124, 76.95, 279.9`，每块差约 180px），配上下移的 y 就是一条斜线；切回竖屏同理。修法是在动 `layout.type` 的同一处把交叉轴压平：`onLoad` 写 `layout.alignHorizontal = true`（当时是 HORIZONTAL）、`toLandscape()` 里设成 VERTICAL 之后写 `layout.alignVertical = true`、`restorePortrait()` 里还原成 HORIZONTAL 之后写 `layout.alignHorizontal = true`。
      - `alignHorizontal` / `alignVertical` 是 get/set，两个 setter **各带类型守卫**（类型不匹配就直接 return，不报错也不生效），而它们读写的是**同一个** `_isAlign` 字段 —— 所以「在哪个方向就写哪一个」是唯一稳妥的写法。
      - ⚠️ **这个勾存不进场景**：setter 不是 `@property`，exec 脚本里赋值不会让编辑器认为场景改过（`save-scene` 返回 `false`、场景文件 mtime 不变，`tools/js/save.js` 强存也失败）。所以它写在代码里，`verify-scene.js` 也没法查（编辑模式下恒为 false）——**别去场景里勾那个「对齐」，勾了也会丢**。
    - **碎片池底图要转 90° 并等比放大（2026-10-09）**：`PoolBG` 是照横向条带画的（demo 674×372），竖栏里不转就是一根横杠横在竖列后面（**这条与上面那个「斜」无关**，是另一处：底图朝向不对）。`toLandscape()` 里按 `poolBgRotate`（默认 90）转过来，再按**覆盖式等比**放大：`k = max(栏宽 ÷ 底图高, 栏高 ÷ 底图宽) × poolBgScale` —— 转 90° 后本地 x 轴指向世界 y，所以世界宽 = 本地高 × k、世界高 = 本地宽 × k。**取 max 是「盖住、不拉伸」**（像 `background-size: cover`，比例不变，多出来的往两边伸）。demo 实数：栏 227.5×720、`k = max(227.5/372, 720/674) = 1.0683`，footprint **397×720**，左右各伸出约 85px。
      - ⚠️ 伸出去的那截**别撞上拼图列**：栏中心在 x=456，减去 198.7 后左边缘 257.3；拼图列右边缘 242.25 —— 只剩约 15px 余量。改 `poolBgScale`、`railGap`、`scale`、碎片尺寸中任何一个都会动这条边距，`poolBgScale > 1` 时先心算一遍。
      - `poolBgScale = 1` 是「刚好盖住」；想让它往两边多铺一点就调大。填 0 或负数会把底图翻没，别填。
    - **裁剪框（`view` 上的 RECT Mask）与 ScrollView 节点一起归零（2026-10-09）**：竖屏下 `sv.node` @ (3.27, −24.747)、`view` @ (−1.546, 0)，都是照 720×300 条带对齐底边用的偏移；竖栏是居中构图，这两个偏移留着会让 Mask 窗口比栏偏出 1.5px 左右。`toLandscape()` 里 `sv.view.node.setPosition(0,0,0)` + `sv.node.setPosition(0,0,0)` 之后，Mask 窗口就和栏严丝合缝（都是 227.5×720 @ 0）。⚠️ **`sv.view` 是 `UITransform` 不是节点**（`ScrollView` 的 getter 取的是 `content.parent` 的 UITransform），位置要走 `sv.view.node` —— 直接 `sv.view.setPosition()` 会抛，`sv.view.position` 读到的是 `undefined`。
    - **碎片不跟着放大**：`PieceFactory.pieceHeight` 横竖屏同一个值，拿起来时才按 `carryScaleOf` 长到缺口那么大（横屏约 1.4 倍）—— 那本来就是它一直在做的事，没有新增「转屏改尺寸」的路。
    - **玩法逻辑一行没碰**：缺口框 / 吸附半径 / 拿起倍率全按世界坐标现算，放大对吸附是透明的。
    - **安全区**：`maxRailHeight` 压到 880，竖栏居中后顶端最高 +440，正好不伸进右上角关闭按钮那个 200×200（设计单位）安全区。
    - **转回竖屏原样还回去**：`onLoad` 存下竖屏的节点位置 / 缩放 / 尺寸 / 挂件开关 / Layout 参数，转回来逐项还原 + `scrollToLeft()`（内容位置是 `ScrollView` 运行期管的，不存快照）。来回转屏不会越转越偏。
    - 横屏这一套**只能写代码** —— Widget 没有「横竖屏两套配置」，`Layout` 的方向和 `ScrollView` 的轴向更是只有代码能改。它是下面那条「重排全交给 Widget」的**唯一例外**（`ScreenAdapter` 不算，它改的是画布策略、一个节点坐标都不碰）。
    - **`CtaRoot` 已定（2026-10-09，形态一「整屏铺满」）**：`CtaLayer → CtaRoot → End → bg` 一路四边 Widget，`End/bg` 是 `SLICED`。横屏下结束界面铺满整屏，底图由 `CtaRoot` 上那个 `BackgroundSwap` 换成 `横屏背景.jpg`（竖版那张是 `竖版结束背景.jpg`，`onLoad` 读的就是它）。详见 §14「结束界面」。
  - **横屏另有一张底图（2026-10-09，`ui/BackgroundSwap.ts` 挂在 `BackgroundLayer` 上）**：竖屏用 `背景图.jpg`、横屏换 `横屏背景.jpg`（2226×1668，`assets/recourses/UI及背景/`），转屏时换 `Bg_Sprite` 的 `spriteFrame`。竖屏那张不另配口 —— `onLoad` 读的就是 `Bg_Sprite` 上挂着的那张，转回来原样还回去（同 `SceneBgSwap` 的「图只配一处」）。两个口：`bg`（`Bg_Sprite` 的 Sprite）/ `landscapeFrame`；接线走 `tools/js/mount-bg-swap.js`（幂等）。
    - 铺满方式**不变**：还是靠 `Bg_Sprite` 自己的四边 Widget + `sizeMode = CUSTOM` + `type = SLICED`。**横屏那张的 `.meta` inset 现在是全 0 = 纯拉伸**（`背景图.jpg` 那张是四边 160）—— 2226×1668 是 4:3，在 16:9 手机的画布上横向要拉 1.33×，觉得糊/变形就给它的 `.meta` 配 inset → 重新导入 → 看 Game View。想在横屏改成「等比放大裁切（cover，不拉伸但上下各裁掉一截）」得写代码，`Sprite` 没有这个模式。
  - **为什么一句 `setDesignResolutionSize` 就够了**（引擎源码核对过，别把这句挪到 `start` 去）：`view.setDesignResolutionSize` 先重算 `visibleRect`，再抛 `design-resolution-changed`。同一次派发里：`Canvas._onResizeCamera` 立刻更新相机 `orthoHeight`；`WidgetManager.onResized` 把 `alignMode` 是 `ON_WINDOW_RESIZE`/`ALWAYS` 的 Widget 全置脏并 `_nodesOrderDirty = true`。紧接着那次 `AFTER_SCENE_LAUNCH` / `AFTER_UPDATE` 的 `refreshScene` 会**先按层级排序再对齐**（父先于子），而 `Canvas` 自己就挂着一个四边 Widget（`alignMode = 2`），它的父节点是 Scene → 运行期 `getReadonlyNodeSize` 取的就是 `visibleRect` —— 所以画布节点先变成撑满后的尺寸，各层再照着它对齐，同一帧内完成，不会闪。
  - 编辑期 `EDITOR_NOT_IN_PREVIEW` 让这条路整体短路（Canvas 的 Widget 拿的是 `getDesignResolutionSize()`），这就是场景面板里看不出变化的原因。
  - ⚠️ 这条**是对原文「保持 fitHeight + fitWidth」的有意偏离**。`fitHeight` / `fitWidth` 在项目设置里没动（还是都开），偏离发生在运行期 —— `view.setDesignResolutionSize()` 把策略换掉了，项目设置只是初值。
  - ⚠️ **编辑器场景面板看不出这个变化**：编辑模式恒按 `getDesignResolutionSize()` 算，画布永远是 720×1280。撑满只发生在运行时（Game View / 产物）。
- **画布变高之后，三处必须跟着改**（`tools/js/mount-adapt.js` 幂等接线，理由写在该脚本头）：
  1. `BackgroundLayer/Bg_Sprite` —— 补四边 Widget + `sizeMode = CUSTOM` + **`type = SLICED`**。九宫格四边各 160（写在 `背景图.jpg.meta` 的 `borderTop/Bottom/Left/Right`），拉伸时只拉中间那段，四边的构图元素不变形。**inset 是可调项**：改 `.meta` → 重新导入 → 看 Game View。
  2. `GameLayer` / `PiecePoolLayer` / `UILayer/ProgressLayer` —— 三处**一条边都不贴**，尺寸钉死（580×748.559 / 720×300 / 460×90）。它们靠「停在设计稿位置」居中，理由见下面那条。
  - ⚠️ 每拆掉一条对齐边，Widget 都会把节点放回**场景里存的 `contentSize`**（`GameLayer` 存的是 980，不是四边撑出来的 748.56）并把中心留住 —— 尺寸必须显式再钉一次，见 `mount-adapt.js`。
  - 三处的 `Widget` 组件**留着**，只是勾全空 —— 这是「故意不对齐」的记号，别当成没用的组件删掉或者重新勾上（勾回去就是长屏偏下）。`verify-scene.js` 的 `checkAdapt` 会拦住。
  - ⚠️ WidgetManager 的整树重排要等下一次 `AFTER_UPDATE`，编辑模式不一定跑得到，所以接线脚本末尾**自上而下 `updateAlignment()`** 刷一遍，否则存进场景的 `UITransform` 会停在中间态。
- 画布尺寸会随转屏 / 撑满而变，**世界坐标一律现读，不存快照**：`SnapSystem` 原来的吸附目标用的是建关卡时快照的 `SlotData.worldPos`，画布一变就过期。已改成现读 `slot.worldCenter`（live getter），`SlotData.worldPos` 这个字段一并删除。
- **重排全部交给 Widget，代码基本不参与**（原来那个 `LayoutController` 已删）。转屏时各层按自己 Widget 的 `t/b/l/r` 重新算位置和尺寸，设计稿内部的比例关系永远不变。`GameEntry` 照旧抛 `ORIENTATION_CHANGED`，横屏那一套（两栏）由 `LandscapeLayout` 听它来做，竖屏一律回落到 Widget 摆出来的位置。`ScreenAdapter` 改的是画布策略（`view.setDesignResolutionSize`），一个节点的坐标都不碰 —— 竖屏下各层仍然全靠 Widget。
- 想让某层横竖屏各一套尺寸，加 Widget 边已经不够了：Widget 没有「横屏一套、竖屏一套」的表达方式，得写代码（就是上面那条横屏两栏的例外）。当前玩法内容三处（`GameLayer` / `PiecePoolLayer` / `ProgressLayer`）**一条边都不贴**、尺寸钉死、停在设计稿位置 —— 横竖屏都靠这个「设计稿居中在画布上」的行为，别给它们加对齐边。
- 转屏时若碎片正在被拖动，取消拖动并弹回原位（复用 `PIECE_SNAP_FAIL` 流程）—— 这条还在代码里，`DragController.onOrientation`。

### 7.2 安全区与 SDK 占用区

- AppLovin SDK **自动在右上角绘制关闭按钮（X）**，广告内**禁止自建任何关闭按钮**。
- 右上角预留不可交互安全区（建议 ≥ 120×120），进度条、CTA、引导文案均不得压在其上。
- 游戏中那个常驻下载按钮（§14）贴在**下沿**（横屏在左侧空位的中点），和这块安全区不冲突；它从开局就可见，所以必须响应触摸（§7.3 查的是「看不见却能点到」，反过来同样成立）。

### 7.3 适配与接口边界

- 所有全屏或贴边节点必须挂 **Widget**：背景与各 Layer 四边对齐；碎片池贴边、尺寸自适应；CTA 与进度按设计稿对齐。禁止硬编码坐标做适配。
- **UI 界面由项目负责人自建预制体**（引导文案、进度、EndCard、CTA 按钮、手指指引）。脚本方只负责：
  1. 用 `@property` 暴露对应预制体 / 节点的引用口；
  2. 抛出并监听 §5 的事件；
  3. 提供 `show()` / `hide()` 方法。
- **CTA 防误触**（AppLovin QA 明确检查项）：按钮未显示时必须完全不响应触摸，绝不允许"不可见却能点到"。

## 8. AppLovin / MRAID 接入规范

### 8.1 核心要求对照表

| # | AppLovin 要求 | 本项目落地方式 |
|---|---|---|
| 1 | 总文件大小 < 5MB | 见 §9 体积预算 |
| 2 | 支持 MRAID v2.0 | 用 SDK 注入的全局 `mraid`，**不引入 mraid.js**（引用或内联都不行） |
| 3 | 广告为单个内联 HTML | 构建后处理脚本合并，见 8.2 |
| 4 | 不引用任何外部托管文件 | 图片 / 音频 / 字体全部 base64 内联 |
| 5 | 横竖屏全屏双支持 | 见 §7.1 |
| 6 | 无用户交互时不得超时 | 靠 2026-10-09 的空闲引导：玩家不操作时画面一直在演（手指拖副本），见 §14「空闲引导」。**但它自己不碰玩法**，原 `IdleHandler`（idle 自动吸附一块）仍未恢复 |
| 7 | CTA 用 `mraid.open()` 跳商店 | 见 8.3 |
| 8 | CTA 不得跳转其他链接 | 地址白名单，只允许商店 URL |
| 9 | 不自建关闭按钮 | 见 §7.2 |
| 10 | JS / DOM 操作必须在 mraid ready 之后 | 见 8.2 启动时序 |
| 11 | 音频不自动播放、关闭后静音 | 见 8.4 |
| 12 | WebGL 检测失败需周期性重试 | 见 8.2 |

### 8.2 启动时序与构建管线

- 定制 `build-templates/web-mobile/index.html`：**不要立即启动引擎**。先等 `mraid` ready（`mraid.addEventListener('ready', ...)`；`mraid` 不存在时降级为直接启动，便于浏览器调试），ready 后再加载 Cocos 构建产物。
- WebGL 能力检测失败时按固定间隔重试，不得直接白屏。
- 构建后处理：写独立的 **Node 脚本放在 `tools/`**（**绝不能放 `assets/`**，否则会被 Cocos 当资源导入），把 `build/web-mobile/` 的 `index.html` + 引擎 JS + `assets/**` + `src/**` + 所有 JSON/图片，合并为单个自包含 HTML。
- 该脚本需支持 **base64 内联所有二进制资源**，并把外链 CSS / JS 内联。

### 8.3 CTA 逻辑

```
if (isAndroid) mraid.open(ANDROID_STORE_URL);
else           mraid.open(IOS_STORE_URL);
```

- 平台判定从 `mraid.getDeviceInfo()` 取（取不到时回退 UA）。
- 商店地址集中写在 `config/PlayableConfig.ts`（打包器的占位符闸门扫的是它，见 §8.5）。
- **只允许 `mraid.open()`**，禁止 `window.open` / `location.href`。
- 点击回调抛 `CTA_CLICK` 事件用于埋点。

### 8.4 音频策略

- **禁止自动播放**：任何音效（含常驻的 BGM）必须在首次用户交互之后才允许播放。
- 监听 `mraid.addEventListener('stateChange', ...)`，当 `mraid.getState() === 'hidden'` 时全局静音并停止所有音效；恢复时按需取消静音。
- 点了 CTA 跳商店之后停掉全部音效，也不再起新的（`CTA_CLICK`）。
- 无音频资源或资源未就绪时 `AudioManager` 静默跳过，不报错、不阻塞流程。

细则（配置列表怎么填、闸门挂在哪两条路上）见 §14「音频：配置列表 + 常驻音」。

### 8.5 构建与打包流程（已就绪）

在编辑器里构建 **web-mobile**，扩展 `extensions/playable-builder` 会在构建完成后自动打出单文件 HTML。

```
Creator 构建 web-mobile
  └─ extensions/playable-builder/hooks.js  onAfterBuild
       └─ node tools/pack-playable.mjs --build <buildPath>/web-mobile
            ├── tools/lib/assets.mjs   读产物 + PNG 无损转 WebP
            ├── tools/lib/payload.mjs  base85/base64 + gzip 容器 + 载荷自检
            ├── tools/runtime/playable-runtime.js  浏览器侧：解包 + 五处拦截 + mraid/WebGL 闸门
            ├── tools/runtime/base-fix.js          非层级文档地址补 base
            └── 写 build/playable.html → 验产物 → 体积门禁
```

- **产物**：`build/playable.html`（默认，可用 `--out` 改）。
- **手动跑**：`npm run pack`（完整打包）或 `npm run pack:report`（只看体积明细，不写文件）。
- **失败即中断构建**：`throwError = true`。体积超 5MB、或产物校验不过（闸门缺失、出现 mraid 外链、有外部托管引用）时构建直接失败 —— 不给「构建成功但交不出去」的假象。
  - ⚠️ **`options.buildPath` 是编辑器内部的 URL（`project://build`），不是文件系统路径**（2026-10-09 找到的根因）：`path.join('project://build', 'web-mobile')` 拼出来的是 `.\\project:\\build\\web-mobile` 这种相对路径（`path.join` 还会把 `//` 收成 `\`），打包器一看没这个目录就当场 `exit 1` —— 活是 5.5 秒的，**一秒都没跑完**。`hooks.js` 里 `resolveBuildPath()` 负责把 `project://` 前缀换成 `ROOT`，绝对路径原样透传。
    - 判断依据是**时间**：`temp/builder/log/` 里那次 `playable-builder:(onAfterBuild) start` 与整条构建链的结束落在同一秒，而打包器实测要 5.5s —— 只可能是启动即失败。**这个扩展在工作区里一共跑过四次（10-8 两次、10-9 两次），四次全栽在这儿，之前从来没成功出过产物**；`build/playable.html` 一直是手跑 `npm run pack` 生成的。
    - 想自己看 `options` 全貌：`temp/builder/log/` 里 `Start build task, options:{...}` 那一行打了原始 JSON，`"buildPath":"project://build"` 就写在那儿。
  - ⚠️ **子进程的输出必须 pipe 回来转发，不能用 `stdio: 'inherit'`**（2026-10-09 改）：inherit 时打包器的 ❌ 列表直接写到编辑器自己的 stdout，`temp/logs/project.log` 里一个字都不留，构建一失败就只剩「退出码 1」+「请检查插件的代码逻辑」，**根本没法诊断**（`temp/builder/log/` 里也没有这次的记录）。改成 `['ignore','pipe','pipe']` + 逐行 `console.log(TAG + line)`，❌ / ✅ 全进 `project.log`，`grep playable-builder` 就能捞出来。两条流都走 `console.log` —— 用 `console.error` 的话 Cocos 会给每一行附一段 Error 堆栈，多行消息被切碎。**改完 `hooks.js` 要重启编辑器或重载扩展**，扩展是启动时加载的（构建钩子跑在 builder 的 worker 里，`require` 有缓存，同一个编辑器会话里改了也不生效 —— 判据是堆栈里的 `hooks.js:行号` 还是旧的行号）。
  - ⚠️ **`hooks.js` 里不能依赖 `Editor` 全局**：钩子跑在 builder 的 worker 进程里，项目根用 `path.resolve(__dirname, '..', '..')` 推（`ROOT` 已经是这么来的）。
- **内联原理**：不改引擎、不改构建配置、不改素材，构建产物原样保留，只在浏览器里拦五个入口喂字节 —— SystemJS 取模块源码 / XMLHttpRequest / `HTMLImageElement.src` / `HTMLScriptElement.src` / 裸 `fetch`。没命中的一律回落原生实现，所以同一份产物传服务器上也照常跑。
- **不要**把启动闸门写进 `build-templates/web-mobile/index.html`：打包器只保留产物自身的 DOM 骨架，写在模板里的启动逻辑会被丢弃。
- 本地自测：产物双击即可打开，地址后加 `#debug` 打开启动日志。没有 mraid 时会走降级路径并在控制台说明。
- ⚠️ 产物里**未做**商店链接的占位符校验（`Config/PlayableConfig.ts` 尚未建立）。建好之后要在 `pack-playable.mjs` 里补上：每个平台必须存在一条非占位符链接，否则会跳去 404 商店页而广告平台不报任何错。

## 9. 引擎模块裁剪

**目的**：AppLovin 要求单 HTML < 5MB，且资源 base64 后体积膨胀约 33%。引擎体积是最大的可控项，裁剪是达标的关键手段。

体积预算（目标）：引擎 ≤ 1.2MB、全部美术资源 ≤ 2.5MB（base64 编码前）、脚本 + 配置 + 其余 ≤ 0.5MB。

在 `设置 → 功能裁剪` 中关闭以下模块：

**必关**：`spine-3.8`、`spine-4.2`、`dragon-bones`、`tiled-map`、`video`、`webview`、`physics-2d`（含 box2d 系列）、`profiler`、`geometry-renderer`、`terrain`、`light-probe`、`xr`、`intersection-2d`（吸附用简单距离计算，不需要碰撞检测）。

**必留**：`mask` + `graphics` —— 场景里有两处硬依赖（`GameLayer` 的拼图区边界、`PiecePoolLayer/ScrollView/view` 的池裁剪），RECT 类型内部就建 `cc.Graphics`。两个都关掉就是整块拼图区不再裁剪，且 `Mask` 组件在运行期报错。

**按需**：
- `particle-2d` — 修复特效若用粒子则保留，若纯 tween + 序列帧则关闭。
- `animation` — 若修复表现用 `AnimationClip` 则保留，纯 tween 则关闭。
- `rich-text` — 引导文案若需富文本则保留，否则关闭。

**不要动** `render-pipeline`（保持 `custom-pipeline`，改动风险高、收益低）。

裁剪必须在**功能开发完成后**统一执行并回归测试，避免影响开发期调试。

⚠️ **两处字段要一致，面板不保证帮你同步**：`settings/v2/packages/engine.json` 里 `modules.configs.defaultConfig.cache.<模块>._value` 和同级的 `includeModules` 数组是分开写的。2026-10-08 发现 `spine-3.8` / `webview` / `profiler` / `intersection-2d` 的 `_value` 已经是 `false`，`includeModules` 里却还列着 —— 10:56 那次构建（晚于改设置）的产物白带了 568KB 的 spine（`spine.asm` 363KB + wasm 205KB + mem 20KB，占 4.31MB 产物的 13%），比所有功能开关加起来都多。改完裁剪设置要 `grep includeModules` 对一遍。若两处都对了、产物里却还有该模块，那就是**引擎没重编**（builder 用了 `temp/` 里的旧引擎）：去 `设置 → 功能裁剪` 里改一次并保存，逼它重编，光改 JSON 不够。

## 10. 工作方式约定

- **不截图、不识别图片**：禁止任何耗费 token 的视觉分析操作。
- **优先 MCP**：编辑器内的场景搭建、节点创建、组件挂载、预制体操作全部走 `funplay_cocos` MCP。
- **零冗余代码**：不写解释性注释（除非逻辑非直观）、不写防御性判空、不写用不到的分支与兜底、不预留"以后可能用到"的接口。
- **不生成无关文件**，不擅自改动职责范围外的脚本。
- 每次只实现一个模块并自检，不一次性铺开全部代码。

## 11. 实现顺序

**第 0 步（前置验证）已完成**：构建管线见 §8.5，已用真实 web-mobile 产物验证通过（187 文件 / 6.12MB → 打单文件 4.18MB，含 WebP 压缩），体积预算成立。开发期每次构建都会自动出产物并做体积门禁。

1. `core/`：EventBus、GameEvent、PoolManager
2. `data/LevelTypes.ts`：数据结构定型
3. `level/`：PieceSlot、RepairedSlot、LevelFactory
4. `gameplay/`：PieceFactory、PiecePool（Layout + 对象池）
5. `gameplay/`：DragController、SnapSystem
6. `gameplay/RepairSystem.ts`：单块修复 + 进度 + 总修复
7. `ui/` + `audio/`：对外接口与事件对接（等 UI 预制体就绪后接线）
8. `bootstrap/GameEntry.ts`：装配
9. 引擎模块裁剪与整体回归

## 12. 待确认假设

以下为设计推导，若与实际不符请在动工前指出：

1. 单块修复的表现定义为「该槽位 `brokenSprite` 隐藏、`repairedSprite` 显示」，遮挡层按 `overlayMode` 决定时机。
2. 碎片池为底部横向 ScrollView + 水平 Layout，碎片为 `PieceFactory` 从对象池取出后挂到 Layout 下。
3. 吸附半径优先级：槽位自身 `snapRadius`（px，非 0 时生效）> `snapRadiusRatio` × **缺口短边**（「修复前那张图」包围盒的短边，不是 `Slot_XX` 节点的短边）。两个都在 `PieceSlot` 上，见 §16。
4. 碎片池中不放干扰碎片，每块碎片有唯一正确缺口。

## 13. 主动建议与风险（需决策）

以下是实现方基于 AppLovin 约束提出的意见，部分与原始描述有出入。

1. ~~构建管线验证~~ **已完成，结论：技术路线成立。** 实测 Cocos 3.8.8 的 web-mobile 产物是 **SystemJS + import-map**（不是 ES module），模块名显式注册，所以内联是可行的。已用真实产物跑通：187 个文件 / 6.12MB → 单文件 **4.18MB**（含 PNG→无损 WebP 省下 0.89MB），在 5MB 内且余量 0.82MB —— **但这个余量不宽裕，美术资源总量要卡住**。详见 §8.5。
2. **图片预算是硬约束**：5MB 减去引擎约 2.5–3MB，真正留给美术的只有 2MB 上下，且 base64 还要涨 33%。**建议美术定稿前先估一版资源体积**，超了再返工成本很高（降分辨率、改用 JPEG、拆关卡都来得及，但重画来不及）。
3. **碎片池建议打乱顺序。** 当前定为"不打乱"，但碎片顺序与缺口一一对应时玩家无需思考，试玩时长会偏短；试玩广告通常要在 15–30 秒内制造"想继续玩"的缺口感。建议保留 `shuffle` 开关，默认开启、调试时关闭。
4. **吸附半径建议取碎片短边的 20%–30%。** 半径过大时手指掠过就吸附，玩家无法"拖着看看"；过小则手感发涩。因为碎片与缺口一一对应（§12.4），不存在吸附到错误缺口的问题，半径可以放心调小。现在是 `PieceSlot.snapRadiusRatio`，默认 0.25，Inspector 里直接调。
5. **对象池 + Layout 的排序坑**：从池中取出的碎片挂回 Layout 时必须 `setParent(content)` 且 `setSiblingIndex(i)`，否则 Layout 不会排到预期位置；回收时不要 `destroy()`，用 `removeFromParent()` 保留实例。这条要落实到 `PiecePool` 实现里。
6. ~~**横屏布局需要额外的美术决策**~~ **已决（2026-10-08）：横竖屏共用同一套设计尺寸，重排全交给 Widget**，碎片图不旋转也不压缩。因此删掉了 `LayoutController` 与 `GameConstants.ts`。**2026-10-09 修正**：横屏不再是「等比缩小居中」（那是 SHOW_ALL 的行为），撑满之后竖版构图吃满高度、两侧多出的宽度由 `Bg_Sprite` 铺满；而「横屏变一套尺寸」也**不再**是「加条 Widget 边就行」—— Widget 没有横竖屏两套配置，得写代码，见 §7.1 里那条横屏两栏。
7. **引擎裁剪放在最后执行**（已写入 §9），裁剪会削弱编辑器调试能力，开发期保留更省事。

## 14. 实现现状与偏差（2026-10-08）

21 个脚本已全部写完，TypeScript 零报错；场景 `assets/scene.scene` 已搭好并落盘。以下是与前文的出入，看代码前先看这里。

**MCP 端口是 20168，不是 §0 写的 8765。** 驱动脚本 `tools/exec.mjs`（跑 scene / editor 上下文的 JS，默认自动存场景）与 `tools/mcp.mjs`（通用工具调用）：

```
node tools/exec.mjs <scene|editor> <脚本.js> [argsJson] [--no-save]
node tools/mcp.mjs <工具名> [argsJson]
```

**目录与层级的偏差**

| 位置 | 前文写的 | 实际 | 原因 |
|---|---|---|---|
| 商店地址 | `GameConstants`（§8.3） | `scripts/config/PlayableConfig.ts` | 打包器的占位符闸门要一个显眼且唯一的落点；`GameConstants` 只放调参 |
| Canvas 子节点顺序 | §3 无 `DragRoot` | 多了一层 `DragRoot`，夹在 `PiecePoolLayer` 与 `UILayer` 之间 | 拖起来的手感碎片要盖住碎片池，但不能盖住 CTA |
| `RepairedLayer` | 独立一层（§2） | demo 里没用，`Repaired` 是 `Slot_01` 的子节点 | 遮挡层要跟槽位同生共死；独立层反而要在两处同步坐标 |
| 碎片池 | `content` 直接挂碎片 | 碎片在 `content`，被拿起时挪到 `DragRoot`，原位留一个 `Spacer` 顶住 | 不顶住的话 Layout 会立刻重排，剩下的碎片当着玩家的面跳一下 |

**构建 / 打包**

- 引擎裁剪已执行：关掉 42 个模块（含 §9 全部「必关」项）。`animation` 暂时保留 —— 它在 §9 属于「按需」，等表现定稿再定夺。**但这半没进产物**：`includeModules` 当时没同步，spine 照旧进包（见 §9 末尾）。2026-10-08 已把该数组改成与 `_value` 一致，降幅等一次构建实测。
- `tools/pack-playable.mjs` 补了商店链接闸门（§8.5 末尾那条 TODO）：扫**构建目录里编译后的 JS/JSON**，不是扫打包后的 HTML —— 产物已经 gzip + base85 编码，链接在 HTML 里根本找不到。
- `extensions/playable-builder/hooks.js` 把该闸门分成两档：`debug` 构建只警告，release 构建直接失败。挡的是「带着 `XXXX` 交出去」，不是开发期每次构建。
- **MCP 起不了构建**：builder 包只注册了 `open` / `query-worker-ready` / `query-task`，没有触发构建的消息。构建必须由人在编辑器里点，没法脚本化。

**场景重建**

`tools/js/build-scene.js` 幂等重建整棵 Canvas 层级，`tools/js/verify-scene.js` 只读校验（组件是否有重复、`@property` 引用是否有 null）。改完场景先跑前者再跑后者。两个脚本都要注意：`removeComponent` 不会随节点重建自动发生，所以 Canvas 这类不重建的节点必须走 `comp()` 包装 —— 否则每跑一次就多攒一套重复组件，事件监听也跟着翻倍。

**点击碎片没反应：不是「高层级挡住低层级」，是引擎的派发链断在中间**

引擎里一次触摸有两个派发器（`cocos/input/input.ts`）：

```
input._emitEvent(event)               // 固定顺序，按 priority 降序
  ├─ PointerEventDispatcher  priority = UI     (1)   ← 先跑
  └─ InputEventDispatcher    priority = GLOBAL (0)   ← 后跑，input.on(...) 的监听器住这里
```

```ts
if (!dispatcher.dispatchEvent(event)) break;   // ← UI 派发器返回 false 就整个 break
```

而 `PointerEventDispatcher.dispatchEventTouch` 只要**任何一个节点的事件处理器接住了这次触摸**，就 `dispatchToNextEventDispatcher = false`。于是全局 `input` 的监听器**一个都收不到** —— 不管它 z 序多高。

碎片躺在 `ScrollView → view → content` 里，`ScrollView` 在自己节点上注册了触摸监听，正好接住落在碎片上的触摸。所以 `DragController` 挂在 `input.on(TOUCH_START)` 上永远收不到按下。

修法：把监听从全局 `input` 挪到骨片池的 `content` 节点。节点处理器按 `_sortByPriority` 排序，**深节点排在祖先前面**，`content` 比 `ScrollView` 深，抢得到触摸；拿起后碎片被挪到 `DragRoot`，但触摸已被 `content` 认领，`MOVE` / `END` 不再做命中检测（`NodeEventProcessor._handleTouchMove` 里没有 `hitTest`），照常派发。

两个副作用，都不是这次改的但同一个根因：

- `AudioManager` 的「首次交互才出声」闸门也挂在全局 `input.on(TOUCH_START)` 上 —— 玩家第一次拖碎片时它同样收不到。2026-10-09 补了第二条路：`PIECE_PICK` 也解锁（但**不解锁那条仍得留着**，游戏区空白处点一下走的是它）。见 §14「音频」。
- 节点事件是冒泡的（`event.bubbles = true`），`content` 接住后事件仍会冒到 `ScrollView`，所以 `lockScroll()` 必须照旧在拿起时把 ScrollView 关掉。

`DragController.start()` 里挂过一段**临时**三层探针（全局 / Canvas / content 各记一次），2026-10-08 已删除，连同只在自测里用的 `Canvas / Input / input / Vec3` 四个 import。它跑出来的数**没有证明任何事**：`全局=0` 那一格符合预期，但 `Canvas=0`、`content=0` 的同时 `holding=true` —— 三个计数和「有人拿到了碎片」自相矛盾，说明探针注入的那下 `mousedown` 本身就没进游戏（引擎的 canvas 监听多半不认合成的 `MouseEvent`），而 `holding=true` 来自别处。上面那条「`content` 抢得到触摸」的结论，依据仍然是引擎源码 + 真人拖拽的实测，不是这段探针。

探针还暴露两个坑，记下来：

- **一次定时回调里抛异常会把 once 定时器留在表里**，之后每帧重跑一次：一个 bug 在 `temp/logs/project.log` 里能刷出 941 行（约 60 行/秒，直到预览关掉）。看到同一句报错成百上千次，先怀疑是这个，不是真有上千次触发。
- 探针那两次崩，是**碎片池在预览启动约 2 秒时是空的**（`pool.entries[0]` 为 undefined）。30 次预览启动里有 16 次跑到探针，其中 2 次空池。当时场景本身是干净的（`build-scene.js` + `verify-scene.js` 都过），同一次会话里也没有别的报错，所以「为什么空」还没定论；两次都落在我正在跑场景/编辑器侧 MCP 脚本的时间点上 —— **Game View 预览跑的就是编辑器内存里那个场景**，脚本正在重建层级时启动预览，可能就看到了半成品。浏览器预览（`run_project_preview` 的 browser 模式）和 web-mobile 产物没观察到这个。再遇到空池，先确认启动预览时没人动场景。

**拖动特效（白边发光 + 拖尾）**

新增 `assets/effects/piece-glow.effect`、`gameplay/PieceGlow.ts`、`gameplay/TrailEmitter.ts`；`EffectLayer` 此前只在 `build-scene.js` 的 `LAYERS` 里登记却没建出来，现在真的建了，排在 `DragRoot` 之后、`UILayer` 之前（拖尾要盖住碎片池底图，但盖不住 CTA）。

- **亮边**：`PieceGlow` 挂在碎片节点上（`PieceFactory` 建节点时加），自行建一个比碎片 quad 大一圈的 `Glow` 子节点，材质是运行时 `new Material()` + `initialize({ effectAsset, defines: { USE_TEXTURE: true } })`。effect 由 `PieceFactory.glowEffect`（`@property(EffectAsset)`）传进来。`uvScale` 把子节点的采样缩回碎片坐标系，保证光晕轮廓对齐；采样步长和放大倍率都按碎片尺寸在 CPU 算好塞进 uniform，所以**每块碎片一个材质实例**，不好共用。
- **拖尾**：挂在 `EffectLayer` 上的 `TrailEmitter`，按**位移**发射（每 22px 一颗），发射点沿上一颗到当前位置的连线补齐。白点贴图运行时用 `ImageAsset` 生成径向渐变，不用美术出图。
- ⚠️ **动态图集是开着的**：web 端 `macro.CLEANUP_IMAGE_CACHE` 默认 `false`，于是 `dynamicAtlasManager.enabled = true`，`maxFrameSize = 512`。碎片贴图（256×447 之类）会被打进图集重排，亮边 shader 往轮廓外采样就会读到隔壁图的像素。`PieceFactory.create()` 里 `frame.packable = false` 关掉了这条路。
- ⚠️ **`repeatForever()` 不能塞进 `then()`**：那样它只是 `Sequence` 里的一个普通区间，引擎对它调 `update` 会报 `[Action update]. override me`（`action-interval.ts:687`）。必须套在最外层。
- **还没验证**：自定义 effect + 运行时 Material 走 `tools/pack-playable.mjs` 单文件打包这条路（要跑一次 release 构建才知道）。§8.5 的体积门禁会把结果直接说出来。

**修复后的斜向扫光**

新增 `assets/effects/repair-sweep.effect`、`gameplay/RepairSweep.ts`，挂在 `EffectLayer` 上（和 `TrailEmitter` 并列，只拖一个 `sweepEffect` 资源，不给每个槽位单独配）。单块修复扫该槽位自己那道短的；`LEVEL_COMPLETE` 扫一道更长更宽的，横跨所有槽位的并集。

- **光带几何算在世界坐标里，不算在 uv 里**。Sprite 的 `a_position` 到顶点着色器时已经乘过 `node.worldMatrix`（引擎在 `simple.updateWorldVerts` 里预先乘好，`2d/assembler/sprite/simple.ts:68`），所以片元里直接 `world = a_position.xy` 投影，光带在屏幕上就是一条笔直的斜线；多个槽位共用同一条扫描轴和同一个进度值，对齐成一道横扫全场的波前。**顺带绕开了动态图集那条坑** —— 只有拿 `uv0` 当坐标系时才需要 `frame.packable = false`。`sweepAxis`（xy 方向 / z 起点投影 / w 1÷跨度）由 CPU 按世界包围盒算。改方向只改 `RepairSweep.ts` 里的 `AXIS_X/AXIS_Y`。
- 扫光节点是运行时建在「修复后的图」下面的子 Sprite：同尺寸 + 同 `spriteFrame`，assembler 算出的 quad 和父节点一模一样，不用算坐标。贴图 alpha 当裁剪，`blendSrc: src_alpha / blendDst: one` 加法混合，只输出光带，所以透明区不漏光。**取图要从父节点的 `Sprite` 上拿，别用 `RepairedSlot.frame`** —— 后者读的是 `onLoad` 里缓存的 `_view`，拿不到 frame 时子 Sprite 没贴图，引擎会静默跳过不画。
- ⚠️ **同 tick 双触发是 demo 必经路径**：最后一块露脸时 `PIECE_SHOWN` 和那一发的总修复扫光连着来，两道扫光落在同一个节点上。`RepairSweep` 用 `Map<Node, handle>` 记在飞的扫光顶掉前一道。（2026-10-09 之前这话写的是 `PIECE_REPAIRED`，见本节的扫光改挂 `PIECE_SHOWN` 那一条。）
- ⚠️ **`new Material()` 必须显式 `destroy()`**：引擎只销毁 `MaterialInstance`，shared material 没人管（`misc/renderer.ts` 的 `setSharedMaterial` 只碰实例）。`PieceGlow` 现在**没做**这步，属于已知泄漏（量有界，池复用）；`RepairSweep` 收摊时 `customMaterial = null` → `mat.destroy()` → `removeFromParent()` → `destroy()`。
- **进度用 linear tween + 手算 quadOut**（`onUpdate` 拿到的 ratio 是否已缓动过不确定，线性 tween 下它必然是线性进度）。光带从画面外扫到画面外，不做原地淡入淡出；整图补光走 `sin(ratio·π)`，和光带同一个进度。
- 编辑器**编辑模式不跑 `onEnable`**，所以 `execute_javascript` 里手动喂 `_data` 再调 `onRepaired/onComplete` 才能在场景里复现扫光；EventBus 那条线只能在预览里走。

**两层背景 + 缺口框以「修复前那张图」为准（2026-10-08 定案）**

- **背景分两层，纯场景**：`BackgroundLayer/Bg_Sprite` 是广告整体背景（铺满），`GameLayer/Scene_BG` 是拼图场景背景（四边 Widget 贴齐 GameLayer = 拼图目标范围）。代码里没有任何地方假设背景只有一层 —— 这件事**一行代码都没改**。
- **`Scene_BG` 是空图占位**（`_spriteFrame: null`、Sprite 尺寸模式 CUSTOM、四边 Widget 对齐值 0），把场景背景图拖上去就行。修复前的物品是它**上面**的一个个独立节点，不在这张图里。
- **缺口框改成读「修复前那张图」的世界包围盒**：`PieceSlot.width/height/worldCenter` 全走 `brokenView` 那个节点的世界矩形（`contentSize × worldScale` + `anchorPoint` + `worldPosition` 手算，**不是** `getBoundingBoxToWorld()`，原因见下面那条坑）；`PiecePool.carryScaleOf` 也从「槽位节点本地高 / 碎片本地高」改成两边都取世界尺寸 —— 缺口那边含它自己的缩放、碎片那边含 canvas 的缩放，同一个空间里比出来的倍数乘回本地尺寸才对得上屏幕。对 demo 是等价改动：实测 `Slot_01` 仍是 355×620、半径 88.75、中心 (379.93, 875.71)。
- **`GameLayer` 加了同尺寸的 RECT `Mask`**（2026-10-08）：给拼图区一个硬边界，`BrokenLayer` / `RepairedLayer` / `Scene_BG` 超出框的部分只显示框内那一截（demo 里 `Slot_01` 顶出 68px，现在会被切掉）。矩形取节点自己的 UITransform 尺寸，跟 Widget 撑出来的框永远一致，转屏自动跟随，**没有一行代码**。`DragRoot` / `EffectLayer` 是兄弟层，不被裁 —— 手上的碎片与拖尾照旧能盖过边缘。`Mask` 只改渲染不改坐标：`PieceSlot.box()` / `carryScaleOf` 读 UITransform，吸附与吸附落点仍按整个世界框算。
- **`LayoutController` + `GameConstants.ts` 已删**（理由见 §7.1 / §13.6）。Canvas 上的组件、`build-scene.js` 的挂载行、`verify-scene.js` 的检查项一起清掉。`ORIENTATION_CHANGED` 事件保留 —— DragController / PieceGlow / TrailEmitter 还在听它做「取消拖动、收亮边、收拖尾」。
- `verify-scene.js` 给 `PieceSlot` 加了 `brokenView` 非空检查（它现在是必填项，不只是画面来源，还是缺口框的来源）。
- ⚠️ **`UITransform.getBoundingBoxToWorld()` 会把「活着的子节点」并进结果**（实测：100×100 的父节点挂一个 300×300 的子节点 → 返回 300×300；把子节点 `active = false` 就不并了）。`GameLayer` 报 720×980 而不是 478×565 就是这个原因（并进了 `BrokenLayer`）。所以**量一个节点自己的框一律手算**：`contentSize × worldScale` + `anchorPoint` + `worldPosition`（`PieceSlot.box()` 与 `PiecePool.carryScaleOf` 都是这么写的）—— 否则哪天在「修复前那张图」下面挂个项目影，缺口框和拿起倍率就会悄悄跟着变大。唯一还在用这个 API 的是 `RepairSweep.axisOf`，它要的正好是「那片地方一共画了多大」，并集反而合适。

**无交互保活已整体删除（2026-10-08）**

- 按要求删掉了「一段时间没人操作就自动搬一块碎片去吸附」这条演示：`ui/IdleHandler.ts`（连同 `.meta`）、`GameEvent.IDLE_TIMEOUT`、`DragController.onIdle()` 与 `idleFlyTime`、`GuideController` 里那对监听一起清掉；`build-scene.js` 的挂载行、`verify-scene.js` 的检查项同步删除。场景里 `UILayer` 上的那个组件也摘了（走 MCP，不手改 .scene）。
- **连带删掉的两处死代码**：`SnapSystem.firstPending()` 和 `PiecePool.entryBySlot()` 只有 `onIdle` 在用，跟着一起删。`DragController` 的 `snap` 引用也一并去掉 —— 它同样只服务 `onIdle`，去掉之后这个类不再直接引用 `SnapSystem`，正好回到 §4 的「模块间只通过 EventBus 通信」。
- **`GuideController` 的手指不再有代码路径把它显示出来**：`showFinger()`（连带 `fingerBob` 参数和那圈上下浮动的 tween）只由 `IDLE_TIMEOUT` 触发，事件没了它就成了死代码，一并删除。`fingerGuide` 这个 `@property` 保留，`hideAll()` 照旧隐藏它 —— 现在唯一能让手指出现的方式是**在场景里让它默认 active**，由首次成功操作后的 `GUIDE_HIDE` 收掉。要恢复「引导手指上下浮动」的表现，得重新写这段 tween（别指望它自己回来）。
- ⚠️ **风险**：§8.1 第 6 条「无用户交互时不得超时」当时没有任何兜底 —— 玩家全程不碰屏幕的话画面是静止的。**2026-10-09 的空闲引导把这一条补上了**（不操作就一直在演拖副本），见下面「空闲引导」那节；但交审前仍要真人试一遍「全程不操作」这条路径。

**稻草人的序列帧循环（2026-10-08）**

`gameplay/FrameLoop.ts`（原名 `TapReveal.ts`），挂在 `Canvas/GameLayer/稻草人` 上：`onEnable` 起就把 `frames`（14 张 `assets/recourses/南瓜幽灵序列帧/matte_00001..14`，Inspector 里拖进去的）在同一个 Sprite 上按下标循环播，一直播。位置 / 缩放 / 透明度一概不碰。`SwayMotion` / `RiseReveal` 已被人工在 Inspector 里禁用（`enabled = false`），这条表现不负责管它们。

**原设计是「首次点击屏幕 → 从 0 用 `backOut` 放大回编辑器里的 Scale → 再开始循环」，2026-10-08 按要求整体撤掉，改成开场就循环。** 撤掉的原因是真人点击始终没反应，五条监听路全试过：

| 监听路 | 结果 |
|---|---|
| `input.on(TOUCH_START)` | 收不到被节点认领的触摸 —— 碎片池的 `content` 认领了整个条带（见上面那条） |
| Scene 根节点捕获阶段监听 | **会炸**：Scene 没有 `UITransform`，一进 `PointerEventDispatcher._pointerEventProcessorList`，`_sortPointerEventProcessorList` 就执行 `trans.cameraPriority`，`trans` 是 null，抛 `Cannot read properties of null (reading 'cameraPriority')`。而 `_sortByPriority` **有**这个判空、排序前那趟循环**没有** —— 引擎自己的疏漏。后果不是「收不到事件」，是**鼠标一移动就报错**，实测刷出 620 行 |
| Canvas 节点监听 | 收得全，但 Canvas 铺满全屏又有 `UITransform`，会认领所有没人认领的触摸 —— 挂全局 `input` 的 `AudioManager`「首次交互解锁音频」就永远收不到了 |
| canvas 的 DOM `pointerdown` | **编辑器 Game View 里根本不派发**：canvas 捕获 / canvas 冒泡 / document / window 四处全挂上，真人点击一次都没进 |
| canvas 的 DOM `mousedown` / `touchstart` | 换成这两个之后，日志里 `TAP fired` **一行都没有**。同一时期专门挂在 canvas 上的探针是收得到 `mousedown` / `touchstart` 的（`HIT engine-mousedown`）—— 两者对不上，**没查清**。也别排除「那一轮点的其实是编辑器场景面板、不是 Game View」，毕竟那一下不会进预览 |

⚠️ **别再从「换哪个监听」这条路上找原因了**。真人点击到底有没有进到预览文档，这件事本身就没验明白；MCP 也帮不上忙 —— `list_editor_windows` 里**根本没有 Game View 这个窗口**（只有主窗口和几个隐藏的辅助窗口），`simulate_mouse_click` / `simulate_preview_input` 的点击全落到隐藏的 "Blank" 窗口上。真要恢复点击触发，先解决「怎么在 Game View 里可靠地确认一次点击进来了」。

⚠️ **原实现的 `onLoad` 里有 `this.node.setScale(0, 0, z)`**，靠点击后的 tween 才放回来。点击路一断，节点就永远停在 0 —— 这就是「点了屏幕还是 0」的直接原因。撤掉放大后这行一并删了，节点保持编辑器里的 Scale。

**改名与场景引用**：`.scene` 里的脚本组件是按**脚本 uuid** 记 `__type__` 的（`.meta` 里的 `uuid`，压缩后是 `65c10zs/opNMYJuu3ARqR19`），**不是按类名**。所以 `TapReveal.ts(.meta)` → `FrameLoop.ts(.meta)` 只要两个文件一起改名、uuid 不变，场景引用自动跟着走，不用碰场景。2026-10-08 实测：改完跑 `refresh_assets`，`verify-scene.js` 直接报 `FrameLoop: ["稻草人"]`，`sprite` / `frames`（14 张）都还在。`verify-scene.js` 的检查项同步改成 `FrameLoop`。**场景文件里还留着旧组件的 `scaleTime` 键**（`save_current_scene` 返回 `result: false`，编辑器认为没有改动可存）—— 反序列化时类上没有这个属性，直接忽略，无害。

- ⚠️ **序列帧是 960×960、每帧 trim 后大小不一**（773×937 → 714×933 → 793×952，宽向差 11%）。Sprite 的 `sizeMode` 原先跟着图是 `TRIMMED`，`_applySpriteSize` 每换一帧就把节点 `contentSize` 改一次，**动画会自己一胀一缩**。2026-10-08 已改成 **`RAW`**（`contentSize` 960×960，14 帧框完全一致），节点 scale 0.281 → 屏上约 270px。注意**光改 `CUSTOM` 不够**：它只把框钉死，UV 仍取当前帧的 trim 矩形，换帧照样抖 —— 要稳只能 `RAW`，或把图重新导成不裁剪的。
  - ⚠️ **现在会露出来了**：节点在 `GameLayer` 左上（本地 124.6, 244.2），`GameLayer` 只有 478×565 且挂着 `Mask`，270px 的鬼**顶部会被切掉一截**。原先节点被压成 0（看不见），这个问题一直没显现；撤掉放大后它真的会露出。要调就把节点 Scale 往下压（0.2 上下）。
- ⚠️ **体积**：14 张共 1016KB，base64 后再涨 33% ≈ 1.35MB；现有产物 `build/playable.html` 已经 4.31MB，**加上去大概率顶穿 AppLovin 的 5MB**（§13.2）。要留这条表现就得压帧（960 → 480 展示尺寸下看不出差别，能省 ~4×）或减帧。
- ⚠️ **改完脚本必须 `refresh_assets`，否则预览跑的仍是旧包**：我（或任何外部工具）写 `.ts` 文件，编辑器**不会**自动重编。预览产物落在 `temp/programming/packer-driver/targets/preview/chunks/<xx>/<hash>.js`，`grep` 里面的字符串就能确认新代码到底进没进包。2026-10-08 实测：16:53 改完文件、16:53:18 重启预览，那个 chunk 的 mtime 还是 **16:44:38**、里面一行新代码都没有；跑一次 `refresh_assets` 后 mtime 才跳到 16:54:03。**「改了代码但预览里没变化」先查这个。**
- **`invoke_component_method` 跑在编辑器场景里，不是预览** —— 日志前缀是 `[Scene]`，预览是 `[PreviewInEditor]`。另外编辑器的场景进程里 `director.getSystem('TweenSystem')` 取不到东西，但这**不代表 tween 不跑** —— 别拿它下结论。
- **已跑通实测（2026-10-08）**：`refresh_assets` 后重开 Game View，日志拿到 `[PreviewInEditor] [FrameLoop] onEnable frames=14 scale=0.281 first=matte_00001` —— 组件从场景正常加载（改名后 uuid 链接没断）、14 帧都在、节点停在编辑器里的 0.281（不再被压成 0）、首帧已上。这行探针已删。
- ⚠️ **编辑模式看不到这条表现**：`onEnable` / `update` 在编辑器里都不跑，场景面板里的稻草人一直停在 `matte_00001` 不动。「怎么不播」如果是这么测的，那就是这个原因 —— 必须在预览（Game View）里看。

**进度条（2026-10-08）**

`UILayer/ProgressLayer` 下两个节点：`进度条框`（`进度条框.png` 500×55，sibling 0）和 `进度条`（`进度条.png` 493×48，sibling 1，3.5px 内缩）。**填充必须排在框后面** —— 框那张图整张不透明（实测中心与四角都是实色，没有透明内腔），填充盖在它上面才看得见；反过来会被框整个挡住。建节点脚本 `tools/js/add-progress-fill.js`（幂等）。

- `进度条` 是 **Sprite `FILLED` + `fillType HORIZONTAL`**，`fillStart 0` / `fillEnd 1` / `fillRange` 走 0→1。已核对引擎源码（`2d/assembler/sprite/bar-filled.ts` 的 `updateUVs` + `updateVertexData`）：FILLED **同时缩短 quad 和夹取 UV**，是真裁剪不是拉伸，所以两头是圆角的药丸图在过半时右端会是直切口，属正常。`fillRange = 0` 时 quad 退化到零宽，什么都不画。
- `ProgressController.onProgress(done, total)` 里 `fill.fillRange` 目标 = `done / total`，tween 用 `quadOut` 缓动，时长是 Inspector 上的 `fillTime`（默认 0.4s）。**换了块数不用改代码**：三块就每块 33%，四块就 25%。
- **判断该不该重新起 tween 不看目标值**：`fillTo()` 一律先 `stop()` 掉在飞的那条再从当前位置起步，所以连点几块不会跳变，只会顺滑接上。`onDisable` 里也停。
- ⚠️ **场景面板里进度条永远是空的**：编辑器编辑模式不跑 `onEnable`，`fillRange` 停在场景里存的值（0）。已实测 —— 直接在编辑场景里调 `ctrl.fillTo(0.25)` 后 `fillRange` 一路保持 0.000，因为编辑模式的 director 不 tick `TweenSystem`。**要看填充只能在预览（Game View）里看。**
- ⚠️ `label` 现在是 null：`ProgressLayer` 下没有进度文字节点（`verify-scene.js` 会一直报 `missing: ProgressController@UILayer`）。要显示 `1/3` 这种文字就自己加个 Label 拖进 `label` 口，脚本这边不用改。

**毛衣槽位：修好之后藏掉坏人、放出好人（2026-10-08，2026-10-09 改成换节点）**

`Slot_03`（毛衣）**修复本身和别的物品一模一样** —— 碎片照常吸附、`Broken` 隐藏。区别只在收尾那一下：把 `Canvas/GameLayer/坏人` **藏掉**、把 `Canvas/GameLayer/好人` **放出来**（好人自己挂 `FrameLoop` 循环它那套序列帧，被激活时 `onEnable` 从第 1 帧开始），**同时把修好的毛衣收掉** —— 最终画面和「毛衣一开始就消失」那版一样。

⚠️ **2026-10-09 之前这里走的是「给坏人的 `FrameLoop` 整体换一套序列帧」**（`FrameLoop.swap()`，还得在场景里存 7 个 SpriteFrame 引用）。现在改成换节点，`FrameLoop.swap()`、`swapTarget`、`swapFrames` 都已删除，场景里那两个老键也跟着那次存盘一起没了（类上没这两个属性，反序列化本来就会忽略）。

- **什么时候换**：开着「修复揭晓」就是**序列帧播完那一下**（见下面「修复揭晓」那条，毛衣全程不出场）；关了揭晓就退回老路 —— 先 `showRepaired()` 露出实物挨自己的扫光，过 `swapDelay`（0.45s，= `RepairSweep.repairTime`）再换。
- 实现方式仍是「换美术不改代码」（§6）：`PieceSlot` 上两个可选口 —— `swapHide` / `swapShow`（都是 `Node`，**两个都填了才生效**），加 `swapDelay` / `swapFadeTime`（秒）。`swapAfterSweep` 里三件事：放出 `swapShow`、收掉 `swapHide`、`repairedView.hide()`。谁都没配的槽位行为一个字没改。
- **换成交叉淡入淡出（2026-10-09）**：硬切那一下太生硬，`swapFadeTime`（默认 0.25s）里走 `UIOpacity` —— `swapShow` 从 0 淡到 255，`swapHide` 在同一段时间里淡到 0，淡完那个 `.call()` 才 `active = false`。**好人排在坏人后面（兄弟序 3 > 2）**，淡入时压在正在淡出的坏人上面，看着是「变了个身」而不是「先空一下再冒出来」；顺序反了 verify 会报。**两边都必须挂 `UIOpacity`**（不挂就是 `null.opacity` 直接抛），`swapFadeTime = 0` 退回硬切、不需要这两个组件。挂载与赋值走 `mount-node-swap.js`（幂等），`FeatureFlags.revealOnRepair` 关掉时换节点走 `swapDelay` 老路，**渐显照旧生效** —— 渐显是换的方式，不是揭晓的一部分。
- ⚠️ **`好人` 的初态由代码兜着**：`PieceSlot.onLoad` 里 `if (this.swapShow) this.swapShow.active = false;` —— 场景里 `好人` 现在是隐藏的，但你要在编辑器里看它、调它的位置缩放就得**先把它开起来**，忘了关回去也不会在开场同时画出两个角色（编辑模式不跑 `onLoad`，所以场景面板里照样看得见它）。`坏人` 不用管，一直开着。
- `RepairSystem` / `SnapSystem` / `RepairSweep` / `RepairedSlot` / `PiecePool` / `DragController` **全部没动**（`RepairSweep` 一度改过落点去扫 `坏人`，随「毛衣不再消失」一起撤回了，现在是原样）。这一格照旧计入 `done`，进度条与 `LEVEL_COMPLETE` 照旧。
- 场景侧接线走 `tools/js/mount-node-swap.js`（幂等，scene 上下文，跑完自动存盘）：`Slot_03.swapHide = GameLayer/坏人`、`swapShow = GameLayer/好人`。老的 `tools/js/mount-frame-swap.js` 已删（那是换帧方案的接线脚本）。`swapDelay` 没写进场景 JSON 的那次已经落盘了 0.45；在 Inspector 里一改就会重写。
- `verify-scene.js` 的**只读**检查改成「`swapHide` 与 `swapShow` 要么都填、要么都不填」；两个都填且 `swapFadeTime > 0` 时再加两条：两边都得有 `UIOpacity`，且 `swapShow` 的兄弟序必须在 `swapHide` 后面。这几项没进 `wanted` 的必填列表（它们本来就是可选的）。
  - ⚠️ 判断前必须先确认 `swapHide && swapShow` 都在：`swapFadeTime` 是**新加的 `@property`，默认 0.25 会落到每一个槽位身上**（只有 Slot_03 配了那两个节点），漏了这个判空就是 `null.getComponent` 当场抛，整个 verify 脚本中断、什么结果都看不到。
- ⚠️ **两个节点的 Sprite 都是 `TRIMMED`（`sizeMode` 1），框跟着每帧的裁边在变**：`坏人` 601×1201、`好人` 601×1275（各自那套帧内部也有 ±0.5% 的抖动）。换节点之后，两套帧之间原本 +6% 的那一下跳变没有了（各循环各的），但**每个角色自己循环时框仍在抖**。要抹平就把两个都改成 `RAW`（框钉死原画布尺寸，UV 仍按每帧裁边走，画面位置不变）。这条不动代码，只在 Inspector 里改。
- ⚠️ **两个节点各自摆位、各自缩放**（坏人本地 -116.1, -47.2 缩放 0.3；好人 -111.7, -69.5 缩放 0.35，z 缩放还写着 0.3 —— 2D 用不到 z，但看着不一致），换来换去会不会跳一下，得在预览里眼过一遍。
- ⚠️ **`Canvas/GameLayer/好人` 是 2026-10-09 新加的节点**（Sprite + `FrameLoop`，7 张 `好人序列帧`），`GameLayer` 里它的兄弟序排在 `坏人` 后面、`BrokenLayer` 前面。
- 已实测（编辑场景里手动喂状态，跑完还原）：`repair(2)` 之后 `Broken` 隐藏、**修复图 / 好人还都是隐藏、坏人还开着**（证明换节点没提前发生、实物也没出场），`RevealFrames` 建起来了、`showItem = false`；手动补一次「序列帧播完」（`swapAndShown()`）→ **坏人关、好人开、修复图仍隐藏**；`swapDelay` 读到 0.45。⚠️ 编辑模式不 tick 调度器，所以 `scheduleOnce` 那条路**只能手动调**来验证，到点自动触发的结果只能在预览里看。⚠️ 顺带：编辑模式也不跑 `onLoad`，探针要先手动补 `repairedView.hide()` + `swapShow.active = false` 才能模拟预览里「已加载」的初态。
- **渐显实测**（手动调 `swapAfterSweep`，探针跑完已删）：`swapFadeTime = 0.25` 时读到 **`好人` 开、`坏人` 仍开着（等淡完）、`好人` 透明度被置 0、`坏人` 仍是 255、修复图隐藏** —— 正是「tween 建好但编辑模式不 tick」该有的样子，两边都没有抛错（`tween().start()` 在编辑模式能建起来，只是永不推进）；`swapFadeTime = 0` 时 `坏人` 当场 `active = false`、两边透明度都没碰。跑完把透明度 / active / `swapFadeTime` / 修复图全还原了。**淡入淡出的观感只能在 Game View 里看。**

**Slot_04（胶带那格）：既没有破损图，拿在手上的也不是修复后的图（2026-10-09）**

这一格需要第三条路 —— 「池里显示哪张图」。改了三处：

- `PieceSlot` 新增 **`poolSprite`（碎片池用图）**，`pieceFrame` 的优先级变成 `poolSprite` > `repairedSprite` > `repairedView.frame`。**没配的槽位行为一字未变**（其余三格都留空）。Slot_04 配的是 `胶带.png`（468×391 → 池里 **180×150**，`PieceFactory.pieceHeight` 现在是 150）。
- 新增 `level/TapeReveal.ts` + `PieceSlot.tapeReveal`（可选口，同 `swapHide`/`swapShow` 那套思路）：配了它的槽位在 `repair()` 里**先 `repairedView.hide()`**，再 `play(this.showRepaired)` 让胶带依次刷出来；全刷完 `finish()` 收掉胶带、隐藏 `hideOnDone`（稻草人），回调才显示修复图。
- 「从左到右逐渐显现」= Sprite `type = FILLED` + `fillType = HORIZONTAL`，tween `fillRange` 0→1（进度条那套，真裁剪不是拉伸，不用遮罩不用序列帧）。`TapeReveal.onLoad` 把三条 `fillRange` 归 0；**场景里存的是 1** —— 编辑模式不跑 `onLoad`，场景面板里得整条可见才好摆位。
- 时间轴：`startDelay` 0.45 → 每条 `revealTime` 0.25、相邻 `gap` 0.12、末尾停顿 `endHold` 0.15。三条全走完约 **1.36s**（从吸附那一刻起算）。

`tools/js/mount-tape-reveal.js`（幂等，scene 上下文，跑完自动存盘）负责接线：`poolSprite` 的 SpriteFrame uuid 现算（`胶带.png` 的 image uuid + `@f9941`）、三条胶带的 Sprite 属性、`tapes` / `hideOnDone` / `tapeReveal` 三个引用，并顺带把四个槽位的 `pieceId` 从 `1/2/2/2` 拉开成 **`1/2/3/4`** —— 原来 02/03/04 并列，只是靠 `Array.sort` 的稳定性兜着（退化成场景里的子节点顺序），改成不并列才没有隐患，池里的顺序肉眼无变化。

`verify-scene.js` 加了两条：`TapeReveal: ['tapes']` 必填；以及「每条胶带必须是 FILLED/HORIZONTAL」—— 配错就是整条不出现。当前跑下来 `TapeReveal: ["Slot_04"]`，无告警；那三条老 `missing`（`GuideController` / `ProgressController.label` / `CtaController.ctaButton`）是本来就有的，见上一节。

- ⚠️ **只实测到「`repair()` 走了 tapeReveal 分支」**：编辑场景里手动调 `slot.repair(3)`（2026-10-09 起带 slotIndex），读到 `true` / `Broken` 隐藏 / **`Repaired` 隐藏**（延迟显示生效）/ 三条 `fillRange` 归 0（证明 `play()` 起来了），跑完手动还原。**渐显进度与到点的 `finish()`（收胶带 + 藏稻草人 + 显示修复图）编辑模式验不了**（调度器不 tick），只能在 Game View 预览里眼过一遍。
- ~~这一格的扫光是无效的~~ **已解决（2026-10-09）**：`Repaired` 挂上了 `窗户.png`，扫光也改成跟着「修复图露面」走 —— 见下一节。
- **缺口框的锚点仍是那个空的 `Broken` 节点**（`brokenView` 必填，`verify-scene` 会报 null）：虽然没图，UITransform 还是 CUSTOM 323×276、槽位 scale 0.87 → 世界框 **281×240**、中心 **(471.3, 1099.2)**、半径 **60.0**。所谓「拖到指定位置」，那个位置就是把空节点摆在哪。
- **没进 `FeatureFlags`**：胶带揭晓是这一格的修复反馈本身，不是可选表现，没给开关。要能一键关掉说一声。

**扫光改挂「修复图露面」，不挂「吸附成功」（2026-10-09）**

Slot_04 的 `Repaired` 要等胶带序列播完（约 1.36s）才露脸，而扫光原来挂在 `PIECE_REPAIRED`（吸附那一 tick）上 —— 扫在藏着的节点上，什么都看不见。根因不是「Slot_04 特殊」，是**触发点选错了**：扫光该跟着画面走。

- 新增事件 **`PIECE_SHOWN`**（载荷 `slotIndex`），由 `PieceSlot.showRepaired()` 在 `repairedView.show()` **之后**抛。普通槽位在 `repair()` 里同步走到，胶带那格等序列播完才走到。
- `PieceSlot.repair()` 的签名变成 **`repair(slotIndex)`**（调用方只有 `RepairSystem.onSnap` 一处），把 index 存进 `_index` 供事件用 —— 别再拿 `pieceId` 顶替，`SlotData.index` 是**排序后**的位置。
- `RepairSweep` 的单块扫光从 `PIECE_REPAIRED` 改听 `PIECE_SHOWN`。**`PIECE_REPAIRED` 现在没有任何监听方**（`RepairSystem` 照旧抛，见 §15「事件与发射方一律不动」）。
- **总修复扫光会等最后一格露脸**：`RepairSweep` 拿 `_shown` 数「已露面的槽位数」，`LEVEL_COMPLETE` 时若 `_shown < total` 就挂起（`_completeDue`），等那一下 `PIECE_SHOWN` 补齐再扫。不加这条的话 demo 默认路径就会露馅 —— Slot_04 是 `pieceId=4`，**它本来就是最后一个**，`LEVEL_COMPLETE` 必然在胶带序列中途抛出来，全场那道扫光会扫过一块还空着的区域。
- 已实测（编辑场景里手动 `sweep.onEnable()` 注册监听 + 假数据 `repairedView: null` 挡掉真建材质，跑完 `onDisable` + 还原）：普通槽位 `repair(0)` 后 `_shown` 立刻 1；Slot_04 `repair(3)` 后**仍是 1**（证明没同步抛），手动补一次 `showRepaired()` 才变 2；`_shown=2/4` 时 `onComplete()` 把 `_completeDue` 挂起，补到 4 才清掉并真扫；全同步关卡（`_shown` 到齐再 `onComplete`）当场扫，不进队列。TS 零报错，`verify-scene` 无新告警。
- ⚠️ **预览里才会看到真实观感**：`PIECE_SHOWN` 到点那一下的合成效果（胶带收掉 + 稻草人藏起 + 修复图亮起 + 一道扫光同时压上来）只能在 Game View 里眼过一遍 —— 编辑模式不 tick 调度器，这段链路手动调只能验「谁在什么时候抛」。
- ⚠️ **`Repaired` 没贴图时扫光是静默无效的**：`RepairSweep.run()` 照抄父节点那个 Sprite 的 `spriteFrame` 当 alpha 蒙版，frame 为 null 引擎直接跳过不画 —— 不报错、不警告。Slot_04 的 `Repaired` 现在挂上了 `窗户.png`（≈243×239，节点框 CUSTOM 581×551、scale 0.52 → 世界约 302×286，横向被拉约 4%），扫光从这一刻起才真的画得出来。

**碎片池进场停在最左（2026-10-09）**

`PiecePool.onLevelBuilt` 建完碎片后加一句 `scrollView.scrollToLeft()`（一次性跳位，无动画）。原因：**一行碎片比视区宽时，引擎会把内容贴右** —— `ScrollView._calculateBoundary` → `_moveContentToTopLeft` 只在「内容比视区窄」时走左对齐分支，宽的时候不动，接着 `_adjustContentOutOfBoundary` 只保证内容盖住视区，于是位置被拉到「右边缘对齐」。一进场看到的就是行尾。

- demo 的实数：4 块碎片 `pieceHeight` 150、四张图都不裁边（`.meta` 里 `trimX/trimY` 全 0），宽 **133.9 + 175.5 + 178.4 + 179.5 = 667.4**，加间距 3×24 与左右边距 2×24 → 行宽 **787.4px**；`view`（挂 Mask 的那层）只有 **583.9px**。所以第四块以后必然有一块露不出来。
- **贴右时**：第 1 块（柜子，占 24–157.9）整块在框外，看到的是 摇椅(切掉左边一截) + 毛衣 + 胶带 —— 就是「从最后边显示」。
- **改成左对齐后**：第 1 块可见，第 4 块（胶带，起于 583.8）正好卡在右边缘外。**这是有意接受的状态** —— 吸附成功时 `PiecePool.consume()` 把节点从 `content` 摘掉，Layout 当帧（AFTER_UPDATE）重排，后面的碎片整体左移补位，放上第一块之后剩下三块就都进可视区了。**拖回原位不补位**：拿起期间原位留着同尺寸的 `Spacer` 顶住（见 §14 上面那条）。
- 左对齐不会被后续重排冲掉：内容仍宽于视区、且仍盖住视区时，`_adjustContentOutOfBoundary` 两个分支都不成立；行缩到比视区窄之后，`_moveContentToTopLeft` 自己就会左对齐。所以那句 `scrollToLeft()` 只是一次性的起手。
- 想改成「4 块一眼全见」：调 `PieceFactory.pieceHeight` 即可 —— 150 → 100 时行宽约 565px < 583.9px，内容比视区**窄**，引擎自己就左对齐了，`scrollToStart()` 那句可以一并去掉（纯 Inspector 改动，不用碰代码）。

**修复揭晓：序列帧 + 从小到大放大（2026-10-09）**

新增 `assets/scripts/gameplay/RepairReveal.ts`，挂在 `EffectLayer` 上（和 `RepairSweep` / `TrailEmitter` 并列，全局一个实例，四格共用）。`PieceSlot` 加了可选口 `revealAnim`，开关是 `FeatureFlags.revealOnRepair`。

- 时序：`repair()`（Broken 隐藏、Repaired 照旧藏着）→ [槽位自己的揭晓，Slot_04 是胶带] → `showRepaired()` → `revealAnim.play()` 在缺口中心建一个 `RevealFrames` 节点、播一遍 7 张 `蝙蝠序列帧`（时长 = `frameInterval` × 7，**场景里现在填 0.1 → 0.7s**；`@property` 默认 0.06）→ 播完销毁它、把 `Repaired` 放出来、scale 从 0 用 `backOut` 放大回编辑器里的尺寸（`revealTime`，默认 0.35s）→ 放大跑完才回调 `PieceSlot.shown()` 抛 `PIECE_SHOWN`。
- **「蝙蝠后播」是接在 `showRepaired` 里实现的**，所以胶带那格天然是「胶带 → 蝙蝠 → 放大」，普通槽位没有前一段、就是「蝙蝠 → 放大」。`TapeReveal` / `RepairSweep` / `RepairSystem` 一行没改；`PieceSlot.repair()` 只为下面「毛衣那格」加了一个分支。
- ⚠️ **`PIECE_SHOWN` 挪到了放大跑完之后**，不是「一露脸」：`RepairSweep.axisOf()` 按节点 `getBoundingBoxToWorld()` 算扫描轴再取 `1/跨度`，节点缩到 0 时包围盒退化、算出 `Infinity`，那一道扫光会画成垃圾。等它长回原尺寸再抛，扫光行为一字不差，只是整体晚「序列帧 + 放大」（场景里现在约 1.05s）。连带影响：最后一格抛 `LEVEL_COMPLETE` 之后，「总修复扫光」也要多等这一段（`_completeDue` 照旧攒着）。
- ⚠️ **RAW 只解决一半，还得把 Sprite 的 `trim` 关掉**：`sizeMode = RAW` 只是把 `contentSize` 钉在「原始画布」尺寸上（7 帧都是 960×960），而 `trim`（默认 true）走的是「把裁出来那一块拉伸填满整框」—— 这几帧 trim 从 742×830 到 960×960，不关 trim 每帧的大小和形变都不一样。**RAW + `trim = false`** 才是「按原画布坐标画裁出来那一块」，四角对齐、动作轨迹原样。前面稻草人那条「要稳只能 RAW」按这句补全。
- **序列帧节点挂 `EffectLayer`（组件自己那个节点），不挂槽位下面**：`GameLayer` 的 RECT Mask 会把出框的部分裁掉，而特效层是刻意留在 Mask 外面「可以盖过边界」的（§3 / 上面 Mask 那条）。挂槽位下面的话，Slot_04 那格的蝙蝠头顶会被切掉约 30px（缺口中心 y=1099，蝙蝠按 `sizeRatio=1` 铺 281px → 顶端 1240，Mask 顶边 1210）。代价是蝙蝠盖得住拖拽中的碎片（DragRoot 排在 EffectLayer 前面），但盖不住 CTA（UILayer 在后面）。
- 实测（编辑场景里手动 `showRepaired()`，跑完销毁节点 + 还原）：Slot_01 缺口宽 131.27 → 世界 **131.27**、Slot_04 缺口宽 281.01 → **281.01**（场景里 `sizeRatio` 现在是 1，即「铺满缺口宽」），两格的世界位置与 `slot.worldCenter` **完全相等**，父节点都是 `EffectLayer`。`contentSize` 960×960、`sizeMode` 2(RAW)、`trim` false、首帧 `xulie_00000`，`_live` 句柄的 host / node 都指对。编辑模式不 tick `update` / tween，所以「播帧」和「放大」这两步只能在 Game View 里看。
- **毛衣那格（配了 `swapHide` + `swapShow` 的槽位）不吃「放大」这一步**：`repair()` 认出这种槽位就走 `revealAnim.play(this, this.swapAndShown, false)` —— 第三参 `showItem = false` 让 `RepairReveal` 只播一遍序列帧、修复图一个字都不碰（不 `show()`、不缩 0、不起 tween），播完直接换节点（`swapAfterSweep`：藏坏人、放好人），换完才抛 `PIECE_SHOWN`（露面的是换成好人的那个，所以算它这一格露脸）。**毛衣从头到尾没出场**，最终画面和「一开始就消失」那版一样。`RevealHandle.showItem` 就是这个开关，`RepairReveal.reveal()` 拿它决定要不要走放大的那几步。
- ⚠️ **`Slot_03.swapDelay` 改回了 0.45**（先 0.45 → 1.25 → 又回到 0.45）：它现在**只在这格没走揭晓时生效** —— 开关关了或没配 `revealAnim`，就退回老路「先 `showRepaired()` 露出实物挨自己的扫光，过 `swapDelay` 再换节点并把它收掉」，那句 tooltip 说的正是这件事（= `RepairSweep.repairTime`）。**揭晓开着的时候这个数完全不起作用**（换节点跟着序列帧走），所以上一版算出来的「序列帧 + 放大 = 1.25」那套已经作废。
- ⚠️ `Slot_04.tapeReveal.startDelay` 还是 0.45（原意「对齐扫光时长」；扫光现在在整段之后，这 0.45 就是白等）。没动 —— 那是节奏偏好，想收掉说一声，收掉后那一格整段约 2.13s。
- 场景里 `FeatureFlags.sweepOnRepair` 本来就是**关**的，所以单块那道扫光现在不跑；揭晓接管后单块的反馈就是「蝙蝠 + 放大」。
- ⚠️ **写场景探针时别把「读回来的资源数组」原样塞回一个吃 `SpriteFrame[]` 的 setter**（当时的落点是 `FrameLoop.swap()`，这个方法已随换节点方案删掉，但坑照旧）：`refresh_assets` 之后那一小会儿，场景里 `@property` 的 SpriteFrame 引用可能先读到 `null`/半解析状态（实测当场读到 7 个 null，过一会儿重读又是好的 —— 不是数据坏了）。第一版探针把「映射成名字的数组」当还原值传了进去，字符串被当 SpriteFrame 赋给 `spriteFrame`，`Sprite._applySpriteSize` 当场抛 `Cannot read properties of undefined (reading 'width')`，而 `frames` 里已经留下了 7 个字符串 —— 于是那一格在编辑器内存里悄悄坏掉，`--no-save` 也救不了内存。**还原要用对象数组（`.slice()` 存引用），校验要打 `uuid`**（两套序列帧都叫 `matte_00001..07`，看名字分辨不出换没换）。落盘的 `assets/scene.scene` 一直是好的，按里面的 uuid 重新 `loadAny` 赋回去就修回来了。
- 接线走 `tools/js/mount-repair-reveal.js`（幂等，scene 上下文，跑完自动存盘）：挂组件、7 张序列帧 uuid 现算、四个 `PieceSlot.revealAnim` 指过去。`verify-scene.js` 加了 `RepairReveal: ['frames']`。

**全部修完：完成背景从中心圆形羽化扩散（2026-10-09）**

新增 `level/SceneBgSwap.ts`（挂 `Canvas/GameLayer/Scene_BG`）+ `assets/effects/bg-reveal.effect`。全部修完之后，
`Scene_BG` 下一个同尺寸子节点 `完成背景`（贴图 `完成背景.png`，545×724）**从拼图区中心长出一个圆、
边缘羽化，向外扩散盖住底图**；扩散跑完把它自己的贴图挪到 `Scene_BG` 上、自己被收掉 —— 最终画面
还是一个节点、一张不透明的完成背景。

```
Scene_BG                 Sprite = 底图（全程不换）
└── 完成背景              Sprite = 完成背景.png，四边 Widget 贴住 Scene_BG，sizeMode = CUSTOM
                          平时 active（编辑期看得见好摆位），onLoad 时 SceneBgSwap 把它收掉
```

- **扩散的几何算在世界坐标里，不是 uv 里**：节点 580×748.56 不是正方形，在 uv 里算半径会变成椭圆。Sprite 的 `a_position` 进顶点着色器时已经乘过 `node.worldMatrix`（引擎在 `2d/assembler/sprite/simple.ts:68` 的 `updateWorldVerts` 里预先乘好，且 `USE_LOCAL` 只对 graphics / spine / particle-2d 开），所以片元里直接 `length(world - 圆心)` 就是屏幕上的正圆。**和 `RepairSweep` 同一套路数，顺带绕开动态图集那条坑。**
- `revealParams` = `xy 圆心（世界坐标）/ z 进度半径 / w 1÷跨度`，`revealEdge.x` = 羽化半宽（相对跨度，默认 0.35）。圆心和跨度在 `reveal()` 里按扩散节点自己的 `contentSize × worldScale` + anchor + `worldPosition` 手算（不用 `getBoundingBoxToWorld()`，见 §14 那条）。实测手算结果与 `getBoundingBoxToWorld()` **完全相等**：**(360, 835.7205)**，跨度 473.48（= 半对角线）。圆心 y 是 835.7 不是 640 —— `GameLayer` 被 Widget 顶到 Canvas 中心上方 195.72，拼图区本来就不在屏幕正中。
- **进度推到 `1 + feather` 才算完**：走到 1 只够实心部分盖住四角，软边那一段还得再走一个羽化宽度，否则收尾时四个角会各留一点没铺满的渐隐。所以 `finish()` 换贴图 + 收节点的那一下是**无缝**的。
- **时机不是 `LEVEL_COMPLETE`，是「最后一格也露脸」**：最后一格吸上那一刻总修复就抛了，而 Slot_04 还要等胶带刷完 + 蝙蝠播完才露脸（demo 里两秒多）—— 背景先扩散就是「完成背景配一块还没出现的缺口」。所以和总修复扫光同一套判断：`_shown` 数到 `_total`（`LEVEL_BUILT` 给的 `data.length`）才起。**因此只听 `LEVEL_BUILT` + `PIECE_SHOWN`**，不用听 `LEVEL_COMPLETE` —— 全部露脸必然蕴含全部吸附完。
- 两个 `@property` 口：`revealEffect`（EffectAsset）+ `revealView`（那个子节点的 Sprite）。**留空就什么都不扩散**，没进开关表（这是这条需求本身，不是可选表现，§15）。**图只配一处** —— 拖到 `完成背景` 节点的 Sprite 上，`finish()` 直接读它的 `spriteFrame` 挪过去，没有第二份 SpriteFrame 引用要同步。
- ⚠️ 新图 545×724 的比例是 0.7528，节点框 580×748.56 是 0.7748，**横向被压约 3%**（CUSTOM 不保比例）。要正就调 `GameLayer` 的框或给图补一圈边，纯场景改动。
- ⚠️ **`完成背景` 的 Widget 用 `ON_WINDOW_RESIZE`（2），不是猜出来的**：`cc.Widget.AlignMode` 的枚举顺序是 `ONCE=0, ALWAYS=1, ON_WINDOW_RESIZE=2`（**不是** 文档注释里那个顺序），场景里另外 9 个 Widget 也全是 2。
- 接线走 `tools/js/mount-scene-bg.js`（幂等，scene 上下文，跑完自动存盘）：建节点 / 挂 Sprite + 四边 Widget / `sizeMode = CUSTOM`、挂 `SceneBgSwap` 并把两个口指过去。`verify-scene.js` 改成 `SceneBgSwap: ['revealEffect', 'revealView']`，跑下来 `SceneBgSwap: ["Scene_BG"]`，无新告警。
- 实测（编辑场景里手动 `comp.onEnable()` → 喂 4 个假槽位的 `LEVEL_BUILT` → 逐个抛 `PIECE_SHOWN`，跑完 `onDisable()` + 还原）：注册前后 `EventBus._map` 恰好是 `['LEVEL_BUILT','PIECE_SHOWN']` → 空，**没有任何别的监听方被这轮探针牵连**（编辑模式不跑 `onEnable`，那一刻整条总线是空的）；抛到第 3 个节点仍隐藏、没材质，第 4 个才亮出 `bg-reveal` 材质、`revealParams = (360, 835.7205, 0, 0.0021120…)`；手动推到 `p = 1.35` 再 `finish()` → 节点收掉、材质清空、`Scene_BG.spriteFrame` 变成 `31334d7a-…@f9941`。effect 编译产物在 `library/45/45692ecc-….json`，里面有 `BgReveal` 块和 `smoothstep`，导入没报错。
- ⚠️ **观感（羽化宽度、0.9s 的节奏）只能在 Game View 里眼过一遍**：编辑模式不 tick tween，`paint()` 只能手动喂值。另外**改完脚本必须重开预览**（预览 chunk 是启动时编的），新节点也要预览才会被 `onLoad` 收掉。
- ⚠️ 想探针 EventBus 得先拿到模块：scene 上下文里游戏脚本是 `pack:///chunks/<xx>/<hash>.js` 这种散列名，`System.entries()` 里认不出来。当前装 EventBus 的那个 chunk 是 **`pack:///chunks/38/387743dcc42a934a75dab512495c23f6a212e837.js`**，`System.import()` 它就能拿到 `EventBus`。**改过脚本 / `refresh_assets` 之后这个 hash 会变**，得重新遍历 `System.entries()` 找哪个 chunk 导出了 `EventBus`（`EventBus._map` 同理可读，TS 的 `private` 只是编译期）。

**碎片补位动画：往前滑 + 撞一下弹回（2026-10-09）**

一块碎片被吸走后，剩下的碎片原来是**瞬移**到新位置的，现在改成滑过去。全在 `PiecePool.consume()` 里，没有新脚本、没有新 `@property` 之外的场景接线。

- **`updateLayout(true)` 是同步的，而且把 ScrollView 那半也一起带完了**：`Layout` 的 `_doLayout` 对 HORIZONTAL 直接重算 `content` 宽度（`_getHorizontalBaseWidth` 是拿子节点自己加出来的，不看当前尺寸），`setContentSize` 又同步触发 ScrollView 注册在 `content.SIZE_CHANGED` 上的 `_calculateBoundary` → `_moveContentToTopLeft` + `_adjustContentOutOfBoundary`。所以这一句返回时，**碎片的世界位置、`content` 的位置都已经终态**。据此的写法是：先记下旧的世界位置 → 排一次 → 读出新的世界位置当 tween 目标 → 把碎片放回旧位置 → tween 过去。
- **必须用世界位置，不能用本地位置**：这一下 `content` 自己也会挪 —— demo 实测 `content.x` 463.43 → 384.48（−78.95，保持左贴边），同时碎片的本地位置 −78.95，**屏幕上的净位移是 −157.9 = 被拿掉那块的宽 + 间距**。拿本地位置做目标就会少动一半。
- **不被拿掉那块左边的碎片不动**：布局的 `startPos` 会因为 `content` 变窄而整体右移半个身位，正好和 `content` 自己的左移抵消，净位移 0。所以只有缺口后面的碎片往前补，正是要的效果。
- **tween 写 position 不会招来 Layout**：`Layout._transformDirty` 只在 `type` 同时带 `SCALE` 和 `POSITION` 两个位、且 `affectedByScale` 为真时才置脏（`layout.ts:1146`）。中途被别的重排盖掉也是暂时的（下一帧 tween 继续），不写场景。
- **`takeOut()` 里加了一句 `Tween.stopAllByTarget`**：正在滑的碎片被玩家捡起来时，那条补位 tween 会一直把世界位置往回拽。同理 `consume()` 的循环里也停一次（同时吸走两块才会碰到）。
- 缓动用 `backOut`（过冲 10% 再回来 —— demo 里 157.9px 的行程 ≈ 16px 的回弹），时长是新加的 `PiecePool.reflowTime`（默认 0.3，§16）。填 0 就是老行为（`ActionInterval.step` 把时长夹到 FLT_EPSILON，第一帧停在原地、第二帧跳到位）。
- 实测（编辑场景里造 4 个 133.9/175.5/178.4/179.5 × 150 的临时节点冒充碎片，手动把 ScrollView 那条 `SIZE_CHANGED` 监听挂上模拟运行期，跑完还原子节点 / `content` 位置 / `pool._entries`，`--no-save`）：`consume()` 不抛；`entries` 4→3；三块碎片停在 `[339.43, 540.38, 743.33]`（= 消耗前的后三个世界 x，证明是「放回旧位置交给 tween」而不是留在排好的新位置上）；再强制排一次读出来的目标 `[181.53, 382.48, 585.43]`，位移全是 **−157.9**，与早先独立测的那轮数字完全一致。`verify-scene.js` 无新告警。
- ⚠️ **编辑模式不 tick tween**，所以「滑过去 + 弹回」的观感只能在 Game View 里看。另外**转屏落在补位那 0.3s 里**的话，tween 的目标是转屏前的旧坐标，会停错位置 —— 窗口只有 0.3s，没为此加监听。

**空闲引导：手指拖着半透明副本走一遍（2026-10-09）**

`ui/GuideController.ts` 整体重写。原来只管显隐 `TextGuide` / `FingerGuide` 两个节点（那两个节点你早删了，属性一直是 null），现在自己演一遍完整的拖动：

```
Canvas/UILayer/GuideLayer
└── GuideRoot            容器，位移 tween 打的是它
    ├── GuideGhost       Sprite + UIOpacity —— 半透明副本（碎片幽灵）
    └── GuideFinger      Sprite（手指图标.png，scale 0.5）
```

一遍的时序：**手指在池里那块碎片上点一下**（下沉 `tapDepth` 再回来，`tapTime`）→ 副本淡入到 `ghostOpacity` → **副本 + 手指一起**从碎片的世界位置拖到它自己那个缺口的 `worldCenter`（`moveTime`，`sineInOut`），同时副本从碎片大小长到缺口大小 → 副本淡出 → 隔 `loopGap` 再来一遍。

- **全程只是画面**：不碰碎片池、不调 `DragController` / `SnapSystem`，一个事件都不抛。副本是 `GuideLayer` 下的独立 Sprite，池里那块真碎片原样躺着。
- **起点终点都是现读的**：起点 `_entries[0].piece.worldPosition`（实时），终点 `data[slotIndex].slot.worldCenter`（实时 getter，不是建关卡时存的 `SlotData.worldPos`）。所以滚动 / 转屏 / 换关卡都不用改这里，也**永远教的是池里当前最前面那块**（`_entries` 是池里那个数组本身，消耗时它自己 `splice`）。
- **长到缺口那么大**用的是 `PiecePool.carryScaleOf` 同一个算法（两边都换世界高度再比），只是这边自己算了一遍 —— 跨模块不互相引用。demo 实数：Slot_01 缺口世界高 147.098 ÷ 碎片世界高 150 = **0.9807**。
- **「玩家碰没碰屏幕」要走两条路才收得全**：碎片池上的触摸被 `content` 认领（全局 `input` 收不到，见上面那条），由 `DragController` 的 `PIECE_PICK` 顶替；屏幕空白处的触摸没人认领，走全局 `input.on(TOUCH_START)`。**两条路都只是「算有人操作」，不吃掉玩家这一下** —— 玩家照样能立刻去拖那块碎片。
  - 漏网的一种：手指按在碎片池条带的空白处横向滚动。ScrollView 认领了触摸，`content` 那边没命中碎片所以不抛 `PIECE_PICK`，全局 `input` 又收不到 —— 这一下不会把引导收掉。没为它加耦合。
- **一碰就收，再空闲又回来**：`onTouch` = `hide()` + 重新起 `idleDelay` 计时。**通关前一直有效**（`LEVEL_COMPLETE` 才永久停），不是「成功一次就不再教」—— 这是按「用户无操作一定时间后重新显示引导」那句写的。顺带把 §8.1 第 6 条「无用户交互时不得超时」补上了：放着不动，画面一直在演。
- ⚠️ **必须把 `FeatureFlags.guide` 勾上**，否则 `onEnable` 第一件事就 `hide()` 然后 return，连监听都不注册 —— 表现就是「什么都看不到」。这个开关在场景里**本来是关的**，2026-10-09 已勾上（`assets/scene.scene` 里 `"guide": true`）。改完记得**重开 Game View**：开关是场景数据，跑着的预览不会热更新。
- 节奏 / 外观全是 `@property`（§16）。**手指的贴图朝向没做处理**（没识别过那张图），默认 `fingerOffset = (46, -52)`、节点 scale 0.5 —— 图标指尖对没对准副本中心，**要在 Game View 里眼过一遍再调数值**。另外**入场后 3 秒内别碰屏幕**（碰一下就重新计时），否则会以为没引导。
- 接线走 `tools/js/mount-guide.js`（幂等，scene 上下文，跑完自动存盘）。`verify-scene.js` 的必填项从 `['textGuide','fingerGuide']` 换成 `['root','ghost','finger']`，另加一条「副本节点必须挂 `UIOpacity`」（代码里取不到它就直接不显示，见下面的坑）。
- **实测**（编辑场景里手动 `onEnable()` → 喂 `LevelFactory.build()` 的真数据和一块临时造的碎片 → `show()`，跑完 `onDisable()` + 还原，`--no-save`）：`onEnable` 后 `GuideRoot` 收起；`show()` 后 `_showing=true`、`GuideRoot` 的世界坐标 **完全等于碎片的世界坐标**、副本贴图/尺寸都取到了池里那块碎片、副本透明度归 0（等淡入）、手指停在 `(46,-52)`；`onTouch()` 之后 `_showing=false`、`GuideRoot` 收起。把 `scheduleOnce` 临时换成同步执行、让整条链（点击 → 拖动 → 淡出）一口气建出来，**四个 tween 全部无异常**。
- ⚠️ **点击 / 拖动 / 淡入的观感只能在 Game View 里看**：编辑模式不 tick tween 也不 tick 调度器，上面验的是「建起来了、位置对、能收能回」，不是「看着顺」。
- ⚠️ **写这类探针时别把临时换掉的方法留在实例上**：第一版探针把 `g.scheduleOnce` 换成同步桩，结果 `play()` 当场抛错、**没走到还原那一行**，脏属性就留在编辑器内存里那个组件实例上 —— 下一轮探针读到的 `scheduleOnce` 已经是桩，`armIdle()` 因此同步触发了 `show()`。`--no-save` 救不了内存（和 §14「别把读回来的资源数组塞回 setter」是同一类坑）。探针里的替换一律包 `try / finally`（或至少两处都 `delete`），跑完确认 `hasOwnProperty` 是 false。这次确认过：脏属性**没有进 `assets/scene.scene`**（序列化走类的 `__props__`，不认这种散装属性），删掉即恢复。

**音频：配置列表 + 常驻音（2026-10-09）**

`audio/AudioManager.ts` 整体重写。原来四个写死的 `@property`（`pickClip` / `snapClip` / `failClip` / `completeClip`）+ 一个 `source`，现在是一张**配置列表**，一条一个音效：

| Inspector 里的名字 | 字段 | 意思 |
|---|---|---|
| 激活事件（下拉） | `event` | 哪个事件响。**选 `NONE` = 常驻**：不绑事件，首次点击屏幕后一直循环 |
| 音效 | `clip` | AudioClip；留空这一条静默不响 |
| 音量 | `volume` | 与该组件上的「总音量」相乘，最终值被引擎夹在 0–1 |
| 渐入时长（秒） | `fadeIn` | 起播时音量从 0 涨上来，`0` = 直接满音量 |
| 渐出时长（秒） | `fadeOut` | 停止时先降到 0 再真停，`0` = 当场停 |
| 结束事件（下拉） | `stopEvent` | 哪个事件停。**`NONE` = 不主动停**：一次性音效播完即止，常驻的一直循环 |

- **BGM 与常驻背景音就是「激活事件 = NONE」的条目**，没有单独的 BGM 字段。场景里现在配了两条：`NONE / bgm.mp3 / 0.6 / NONE`（BGM）与 `LEVEL_COMPLETE / 修复成功.mp3 / 1 / NONE`。剩下的（拿起 / 吸附 / 失败…）在 Inspector 里加条目拖资源即可，**不用改代码**。
- 下拉框的选项是 `AudioEvent`（`AudioManager.ts` 里导出）—— 除 `NONE` 外，值就是 `GameEvent` 的名字本身，直接丢给 `EventBus`。**`GameEvent` 加了新事件、想拿它当音频触发点，要在 `AudioEvent` 里补一条**（两处枚举是手工对齐的，没做自动同步）。
- **`TAPE_REVEAL`（2026-10-09 加）**：撕胶带那一下的专属事件。`TapeReveal.play(onDone, slotIndex)` 在 `startDelay` 到点、第一条胶带真开始刷的那一瞬间抛（**不是吸附那一刻**，吸附比它早 0.45s；`RepairSystem` 那三条事件全在吸附 tick 上）。`TapeReveal` 是槽位节点上的组件、只 `Slot_04` 配了，所以**只有胶带那格会抛**。接线走 `tools/js/mount-tape-audio.js`（幂等，往 `mgr.cues` 里追加一条 `TAPE_REVEAL / 撕胶带.mp3 / 1`，已有就跳过，其余条目一个字不碰）。`verify-scene.js` 不用改。实测：手动把 `scheduleOnce` 换成同步执行逼出那次 emit，读到 `fired = [3]`（载荷是 slotIndex）、跑完无脏属性、三条胶带还原成 `active / fillRange = true / 1`。
- **`WINDOW_REPAIRED`（2026-10-09 加）**：窗户修好之后那一下的专属事件，`鬼叫.mp3` 的「结束事件」用的就是它。**它和 `PIECE_SHOWN` 在同一句里抛、紧挨着**（`PieceSlot.shown()`），区别只在多了一个 `if (this.tapeReveal)` 的判断 —— 「配了胶带揭晓的那格就是窗户」，所以只有 `Slot_04` 会抛，其余三格修好时只抛 `PIECE_SHOWN`。**时机是整段揭晓跑完之后**（胶带 1.36s → 序列帧 0.7s → 放大 0.35s），不是胶带刷完那一刻；想改成「胶带刷完就停」得把它挪到 `TapeReveal.finish()` 里。场景里 `鬼叫` 那条从 `stopEvent = GAME_INIT` 改成了 `WINDOW_REPAIRED`（`GAME_INIT` 早在解锁之前就抛完了，等于没停过）。⚠️ 它是**常驻条**（`event = NONE`），第一次碰屏幕起播、一直循环，到窗户修好才停；`fadeOut` 是 0，停得比较硬，要淡出就把那一格填上。
- **一条配置一个 `AudioSource`**，都建在运行时的 `Canvas/AudioChannels` 节点下（一次性建齐，`playOnAwake = false`，**不预加载**：clip 到第一次真要响时才赋上去）。共用一份 `AudioSource` 就停不掉单条，「结束事件」和跳转停全部都做不到 —— 引擎的 `playOneShot` 不返回句柄，`audioManager`（能一把全停的那个）**也没有从 `cc` 导出**，所以只能自己拿着 `AudioSource`。
- **闸门（§8.4 第 1 条）是 `_unlocked`**：没解锁时任何 `start()` 直接 return，谁都放不出来。解锁走两条路 —— 全局 `input.on(TOUCH_START)`（游戏区空白处）与 `PIECE_PICK`（碎片池上的触摸被 `content` 认领，全局 input 收不到，见上面那条）。解锁那一刻把所有常驻条目起播。
  - ⚠️ **`onEnable` 里注册顺序是有意的**：解锁那两条排在 `build()` 前面。第一次拖碎片时 `PIECE_PICK` 得**先**把闸门打开，配置里那条 `PIECE_PICK` 音效才放得出来（`EventBus` 按注册顺序派发）。实测同一次 `PIECE_PICK` 里，`_map` 的顺序就是 `['unlock', 'cue']`。
- **渐入渐出（2026-10-09 补）**：每条自己的 `fadeIn` / `fadeOut`，秒，`0` 就是老行为（当场满音量 / 当场停）。BGM 那格场景里填的是 **0.3 / 0.3**。
  - 音量不直接写 `source.volume`，而是过一个 0–1 的系数 `ch.gain.v`（`{ v }` 这种 plain object 才能被 tween 推），`applyGain()` 再乘上条目音量与总音量。**中途改总音量会在下一次渐变时生效**，已经在放的那一条不会立刻跟着变。
  - ⚠️ **`fade()` 的 `from` 必须显式给**：`tween().to()` 是从**当前值**起步的，渐入时当前值还是上一次留下的满音量 —— 第一版没写死 0，结果「从 1 涨到 1」，一声都不渐（实测 `gain` 停在 1、`volume` 停在 1）。现在渐入是 `fade(ch, 0, 1, fadeIn)`，渐出是 `fade(ch, ch.gain.v, 0, fadeOut, () => source.stop())` —— 渐出从当前值接着往下走，渐入没做完就被停也不会跳一下。
  - **真停是 tween 末尾的 `.call()` 里做的**，`ch.live` 当场就置 false。同一条被重新触发时 `playCue` 会先 `Tween.stopAllByTarget`，那条 pending 的 `stop()` 就不会再打过来，不会把刚起播的声音掐掉。
- **跳转停全部**：听 `CTA_CLICK`（`CtaController` 在 `mraid.open()` 之前抛）→ 每条 `stopChannel()`（配了渐出就先渐出再停），并置 `_closed = true`，之后任何事件都不再起新的音。
- **切后台**：`AUDIO_MUTE`（`MraidBridge` 的 `stateChange`）→ 常驻音 `pause()`；取消静音 → 接着 `play()`。**只有常驻音会被恢复**，被打断的一次性音效不补 —— 引擎自己的 `INTERRUPTION_BEGIN/END` 是「全部 pause / 全部 play」，跟这一条不冲突（`AudioSource.pause()` 对已经停的 player 是空操作）。
- **结束界面自己要响的音绑 `END_DROP`，别绑 `END_SHOW`（2026-10-09）**：`END_SHOW` 就是 `onEnd → stopAll()` 的触发点，而 `onEnable` 里那两条注册排在 `build()` 前面 —— 绑在它上面的条目要么被 `playCue` 第一行的 `_closed` 拦掉，要么刚起就被 `stopChannel` 停掉，**结构上不可能出声**。`CTA_SHOW` 也不行（它是在 `CtaController.show()` 里抛的，那次 emit 就嵌在 `END_SHOW` 的派发里，前后都躲不开 `stopAll`）。所以新增事件 **`END_DROP`**（`GameEvent` / `AudioEvent` 两处枚举手工各补一条），由 `CtaController.show()` 里 `scheduleOnce(bgFadeTime)` 到点抛 —— 那一刻 logo 刚开始下落（按钮再晚 `stagger`），也已经在 `stopAll` 之后了。`playCue` 给这条开了唯一一个口子：`_closed` 只拦 `event !== AudioEvent.END_DROP` 的条目。`onDisable` 里补了 `unscheduleAllCallbacks()`。
  - 场景里那条 cue 的「激活事件」已从 `END_SHOW` 改成 `END_DROP`（`scene.scene` 里落盘的就是 `"event": "END_DROP"`）。
  - 实测（编辑场景手动 `onEnable()` → `unlock()` → `onEnd()`，再分别打两条的 `onStart`，跑完 `onDisable()` + 还原，`--no-save`）：`onEnd()` 后 `live` 空、`_closed = true`；`PIECE_SHOWN` 那条仍是空（对照，照旧被拦）；`END_DROP` 那条起播（`结束` / gain 1 / volume 1 / loop false）。把 `cta.scheduleOnce` 临时换成同步桩再跑一次 `show()`，那条 cue 又亮起来（证明 `show()` 确实抛了 `END_DROP`）—— 编辑模式不 tick 调度器，真实的「晚 0.25s 出声」只能在 Game View 里听。
- 接线走 `tools/js/mount-audio.js`（幂等，scene 上下文，跑完自动存盘）：**已经有配置就原样保留**，不覆盖 Inspector 里改过的值。`verify-scene.js` 加了两条：配置里没拖音效、以及激活 / 结束事件选成同一个（放了就停）。
- **实测**（编辑场景里手动 `onEnable()`，跑完 `onDisable()` + 清掉临时节点，`--no-save`）：注册后总线是 `['AUDIO_MUTE','CTA_CLICK','PIECE_PICK', …配置里绑的那个]`（常驻那条不注册任何监听）；**锁着的时候抛事件两条都还是 null**（闸门生效）；解锁后常驻那条 `clip=bgm / loop=true` 起播；事件那条要等自己的事件抛出来才拿到音效；抛 `CTA_CLICK` 后 `_closed=true`、全灭；`AUDIO_MUTE` 两个方向都对；`onDisable()` 后总线回到空，**监听完全对称**。
- **渐入渐出实测**（同一套手动探针）：`fadeIn=0.3` 的常驻条 `playCue` 之后 `gain=0 / volume=0`（从静音起步）；渐入没走完就 `stopChannel` → `gain=0.5 / volume=0.3`（**从当前值接着渐出，没有跳回满音量**）；`fadeIn=0` 的那条仍是 `gain=1 / volume=1` 当场满音量、当场停。
- ⚠️ **渐变过程本身只能在 Game View / 真机里听**：编辑模式不 tick `TweenSystem`（`cc.TweenSystem.instance` 取得到、手动 `update()` 也推不动那条 action），上面验的是「起点、接续点、`0` 的退化行为」，不是「听着顺不顺」。引擎的 web 音频播放器在 `EDITOR_NOT_IN_PREVIEW` 下 `play()` 直接 return，所以「有没有声音」这件事编辑模式一概验不了。
- ⚠️ **`.mp3` 走的是 `XMLHttpRequest`**（`AudioPlayerWeb.loadNative`），不是 `HTMLAudioElement` —— 单文件产物那条链靠打包器拦 XHR。**没跑过 release 构建**，音频能不能在 `build/playable.html` 里正常解码要实测一次（§8.5 的体积门禁也会顺便把新增的音频体积说出来）。

**竖屏撑满屏幕（2026-10-09）**

黑边的根因不是「背景没铺满」，是**画布本身只有设计稿那么大**：项目设置里 `fitHeight + fitWidth` 都开 = SHOW_ALL，`view.getVisibleSize()` 恒等于 720×1280，Canvas 节点恒为 720×1280 —— 屏幕比它高的那截**没有任何节点去画**。背景层当时还没有 Widget，只是尺寸刚好等于 720×1280 才看着铺满。

- 新增 `assets/scripts/ui/ScreenAdapter.ts`（**无 `@ccclass`、纯模块、没有组件实例**，所以场景里挂不上也不该挂），导出 `applyScreenPolicy()`：按 `view.getFrameSize()` 的真实比例换策略 —— **比设计稿瘦**（手机竖屏，比例 < 720/1280）走 `FIXED_WIDTH`（补高度）、**比设计稿胖**（iPad 竖屏 / 横屏 / 宽扁窗口）走 `FIXED_HEIGHT`（补宽度）。返回「策略有没有变」给调用方。
  - ⚠️ 上面这条映射 2026-10-09 之前在本节里是**写反的**（写成「瘦 → `FIXED_HEIGHT`」），以 §7.1 为准，别照抄本节旧版。
  - **横竖屏走同一句、没有方向判断**（2026-10-09 补）：横屏比例恒大于 720/1280，自然落到「补宽度」。此前那个 `if (frame.height >= frame.width)` 让横屏直接返回 `SHOW_ALL`，横屏那两条黑边就是它留下的。
  - 转屏判方向**不能读 `getVisibleSize()`** —— 撑满之后它跟着策略走，方形窗口会被判成竖屏。用 `frame.height >= frame.width`（`GameEntry.isPortrait()`）。
- `GameEntry.onLoad` 里**第一句**就 `applyScreenPolicy()`（赶在第一帧 Widget 对齐之前，不然会闪一下），`onResize` 里重算：策略变了**或**方向变了才抛 `ORIENTATION_CHANGED` —— 撑满本身不该触发「取消拖动 / 收亮边」，方向变了才该。
- 场景侧三处接线走 `tools/js/mount-adapt.js`（幂等，scene 上下文，跑完自动存盘）：
  1. `BackgroundLayer/Bg_Sprite`：补四边 Widget + `sizeMode = CUSTOM`（不然 Sprite 会拿贴图尺寸把自己缩回 720×1280）+ **`type = SLICED`**。
  2. `GameLayer`：`isAlignTop/Left/Right = false`，改 `isAlignHorizontalCenter`，宽 **580**、高 **748.559** 都钉死，`bottom = 461.441`（这三个数是场景里摆好的值，不是算的）。
  3. `UILayer/ProgressLayer`：`bottom = 354.579`（它离池子上沿的距离）+ 水平居中。
- **背景九宫格**：`背景图.jpg.meta` 的 `subMetas.f9941.userData` 里 `borderTop/Bottom/Left/Right = 160`（原来是全 0）。
  - 「补长边」在两种窗口形状下都会让画布比设计稿多一条边：瘦（手机竖屏）多高 → 只纵向拉；胖（iPad 竖屏 / 矮胖的窗口）多宽 → 只横向拉。四边都留 inset，两种拉伸都只作用在中间那段。
  - 画布正好 720 宽时（手机竖屏、以及 SHOW_ALL 下的横屏）左右这两条是**空操作** —— 节点宽 = 图宽，中段 1:1，渲染和 SIMPLE 逐像素一致。
  - 图是 720×1280，四边 160 合法（160+160 < 720）。
  - ⚠️ **横屏现在也吃这几条 inset 了**（画布变宽 → 横向拉伸只作用在中间那段，左右各 160 原样）。但竖版底图整体要拉到 2.46× 宽（中被拉 3.6×），观感仍会糊 —— 等一张横版背景。
  - ⚠️ **inset 全 0 时 SLICED 渲染与 SIMPLE 完全一样**（等于没改）。判断有没有生效看 `spriteFrame.insetTop`，不是看 `type`。
  - `packable: true` 不用动 —— 720×1280 远超动态图集的 `maxFrameSize`(512)，进不了图集。
- **顺带修掉一个被这次改动激活的隐患**：`SnapSystem` 的吸附目标原来用建关卡时快照的 `SlotData.worldPos`，画布尺寸一变（撑满 / 转屏）就过期 —— 吸附会吸到旧坐标上去。改成现读 `d.slot.worldCenter`（live getter），`SlotData.worldPos` 字段连同 `LevelFactory` 里赋值那行一起删（`LevelTypes.ts` 的 `Vec3` import 也跟着去掉）。
- ⚠️ **编辑器场景面板里看不出这个变化**：编辑模式恒按 `getDesignResolutionSize()` 算，画布永远 720×1280。**撑满只发生在运行时**（Game View / 产物），要看只能开预览。
- ⚠️ **拆 `isAlignTop` 那一瞬间 Widget 会把节点放回「场景里存的 `contentSize`」**（`GameLayer` 存的是 980，不是四边撑出来的 748.56）并把中心留住，于是高度和底边距会一起变 —— 必须显式 `setContentSize` + 重设 `bottom` 再 `updateAlignment()`。另外 WidgetManager 的整树重排要等下一次 `AFTER_UPDATE`，编辑模式不一定跑得到，所以脚本末尾自上而下 `updateAlignment()` 刷了一遍，否则存进场景的是中间态（`Scene_BG` 一度停在 980）。
- **画布变高之后的样子（竖屏手机，19.5:9 时画布 720×1558）**：设计稿 720×1280 **居中**，上下各多出 139px —— 构图和 SHOW_ALL 时**逐像素一样**，只是原来空着的上下两条被真实背景铺上了。这就是「玩法内容三处一条边都不贴」的原因：**贴哪条边，多出来的高度就全跑到对面去**。
  - ⚠️ 12:18 之前这里写的是「锚在画布底边」—— 那版长屏上整块内容会往下挪半个多出来的高度（19.5:9 上是 139px），看着就是「整体偏下、顶上空的」。锚边这个做法在「画布 == 设计稿」时是空操作，所以场景里原本那套 `bottom` 值看着没问题，是撑满之后才显形的。
  - 想改成「碎片池贴屏幕底边、拼图区居中」这类偏置构图，就把 `mount-adapt.js` 的 `unanchor` 换成对应边对齐即可 —— 纯场景改动，代码一行不动。代价是设计稿内部的间距会变（池子和进度条本来就跟拼图区咬在一起）。
  - `DragRoot` / `EffectLayer` / `GuideLayer` 是四边对齐的**空容器**，跟着画布中心走 —— 画布中心就是设计稿原点（FIXED_WIDTH/FIXED_HEIGHT 都让设计稿居中），所以它们的世界坐标语义没变，运行时挂上去的碎片 / 特效 / 引导副本按世界坐标摆照旧对。
- **`UILayer/CtaLayer/CtaRoot/End` 已按「形态一：整屏铺满」接线（2026-10-09）**：四边 Widget 补到 `End/bg` 为止，屏幕变高变宽它都跟着铺满，不再只盖中间那 1280。详见 §14「结束界面」。
- **已做**：`verify-scene.js` 无新增告警（只剩 3 条既有 missing：`ProgressController@UILayer`（`label` 空）/ `CtaController@CtaLayer`（`ctaButton` 空）/ `AudioManager` 第 5 条没拖音效）；`run_script_diagnostics` 零报错。落盘读数（`Canvas` 720×1280 下）：`Bg_Sprite` 720×1280 `SLICED` inset 160×4 四边对齐；`GameLayer` `[0, 195.72]` 580×748.559、`PiecePoolLayer` `[0, -433.813]` 720×300、`ProgressLayer` `[0, -240.421]` 460×90 —— 三处 `_alignFlags` 全是 **0**（一条边都不贴），位置就是设计稿里的位置。
  - 核对时读的是 `assets/scene.scene` 里的 `_alignFlags` 位掩码，不是内存里的组件（见下面「自动存盘可能静默失败」那条）。12:18 那次存盘 `save-scene` 返回了场景 uuid，是真落盘了。
- `verify-scene.js` 加了 `checkAdapt` 一段（只读）：底图四边对齐 + `SLICED` + inset 四边都非 0；`GameLayer` / `PiecePoolLayer` / `ProgressLayer` **一条边都不许贴**。跑下来无告警。
- ⚠️ **`tools/exec.mjs` 末尾那次自动存盘可能静默失败**：它返回 `⚠️ 场景没存上（save-scene 返回 false）`，而**再调一次 `node tools/exec.mjs editor tools/js/save.js` 就成功**（成功时 `save-scene` 返回场景 uuid）。`query-dirty` 也读得到。所以改完场景**别只看那行警告，要核对文件**（本仓库用 `assets/scene.scene` 的 mtime，或直接读 JSON 里的 `_alignFlags`）。11:49 那次就是这么补上的 —— 内存里明明改好了、`GameLayer` 的 `_alignFlags` 还是旧的 44（`BOT|LEFT|RIGHT`）。
  - ⚠️ **`Widget` 的 `isAlignXxx` 不是序列化字段**，落盘的是位掩码 `_alignFlags`（`TOP=1 VC=2 BOT=4 LEFT=8 HC=16 RIGHT=32`）。想核对场景文件就得解这个掩码，读 `_isAlignLeft` 一律是 `undefined`。
- ⚠️ **运行时还没实测**：这轮 MCP 的 `run_project_preview` 在 `full` profile 里，起不了预览（`get_runtime_state` 一直是 `running: false`），得人工在编辑器里开 Game View。`GameEntry.start()` 里**暂时留了一段探针**（`scheduleOnce(this.probe, 0.5)`，打印 frame / visible / canvas / layer / bg / type / inset / game / sceneBg / pool / progressY），核对完就删 —— 见 §14 末尾「待你确认」。
- **横屏（2026-10-09）**：`ScreenAdapter` 里那个方向判断去掉了，横屏改走「补宽度」（画布 1770×1280 这类宽幅），黑边归零。玩法内容三处本来就不贴边、尺寸钉死，`ScreenAdapter` 一个节点坐标都没碰；横屏的构图交给新增的 `ui/LandscapeLayout.ts`（挂在 Canvas 上，接线走 `tools/js/mount-landscape.js`，六个口：`gameLayer` / `progressLayer` / `poolLayer` / `poolBg` / `scrollView` / `cta`）。
  - 横屏**没有**任何方向分支，`applyScreenPolicy` 只看「窗口比设计稿胖还是瘦」。转屏 `onResize` 照旧重算，策略变了才抛 `ORIENTATION_CHANGED`。`LandscapeLayout` 听的是后面这条。
  - **两栏的算法**（全是设计单位，画布节点锚在中心，所以本地 0 就是屏幕中心）：`s = scale`；拼图列宽 = `max(GameLayer.w, 进度.w) * s`、列高 = `(GameLayer.h + 进度.h) * s + columnGap`；栏宽 = 最宽碎片 + 左右 padding、栏高 = `min(内容高, maxRailHeight)`；`总宽 = 列宽 + railGap + 栏宽`。拼图列与竖栏整体横向居中（列中心 `= (列宽 − 总宽)/2`，栏中心 `= (总宽 − 栏宽)/2`），列与栏都纵向居中。demo 实数（4 块碎片、`scale=1.4`）：拼图区 `(-163.75, 83)` 缩放 1.4、进度条 `(-163.75, -543.99)`、竖栏 `(456, 0)` **227.5×720**。
  - **量栏尺寸的时机**：碎片是 `LEVEL_BUILT` 时建的，所以横屏那次重排要在 `POOL_BUILT` 之后再量一次（开局即横屏时第一次量到的是空池子）。`toLandscape()` 是幂等的，量两次没有副作用。
  - **转屏后碎片「斜」的真根因是 `Layout` 的交叉轴（2026-10-09 找到并修掉）**：`PoolBG` 没转、`view` 有 1.5px 偏移这两条**都是真的、也都修了**，但它们不是「四块碎片连成一条斜线」的原因 —— 那条是引擎的 `Layout` 只写主轴：`cocos/ui/layout.ts` 的 `fnPositionY` / `fnPositionX` 是 `this._isAlign ? Vec3.ZERO : child.position`，不勾对齐就**原样沿用子节点上一次的坐标**。于是切横屏时 `VERTICAL` 只重写 y，x 还是竖屏那一行的值（实测 `-302.7, -124, 76.95, 279.9`），四块 x 每块差约 180px、y 往下走 174px —— 正好一条斜线；切回竖屏同理（y 保留横屏那列的值）。修法是 `LandscapeLayout` 在动 `layout.type` 的同一处把交叉轴压平（`onLoad` 里 `alignHorizontal = true`、`toLandscape()` 里 `alignVertical = true`、`restorePortrait()` 里再 `alignHorizontal = true`）—— 详见 §7.1。
    - ⚠️ **上一次的探针为什么没抓到**：那版探针新造的临时节点 x 本来就是 0、也没先跑一轮竖屏排列，切横屏时「沿用旧 x」沿用到的就是 0 —— 于是读出一列整齐的 `816`，把 bug 盖住了。**要复现这类「沿用上次坐标」的问题，必须先走一遍真实顺序**（先横排、再切竖排），而且别再假设新节点的坐标是干净的。
    - ⚠️ **这个勾存不进场景**：`alignHorizontal` / `alignVertical` 是 get/set（不是 `@property`，虽然底层 `_isAlign` 带 `@serializable`），在 exec 脚本里赋值**不会让编辑器认为场景改过** —— `save-scene` 直接返回 `false`、文件 mtime 不变。试过 `Scene` 侧勾选 + `tools/js/save.js` 强存，失败，所以最终写在代码里。两个 setter 各自带**类型守卫**（`alignHorizontal` 只在 HORIZONTAL 时生效、`alignVertical` 只在 VERTICAL 时生效），而 `_isAlign` 是一个共享字段、两种方向共读。
  - **`PoolBG` 转 90° + 等比放大（2026-10-09，用户提的「底图应该转过来 + 改缩放」）**：`toLandscape()` 里按 `poolBgRotate`（90）旋转、按 `max(栏宽 ÷ 底图高, 栏高 ÷ 底图宽) × poolBgScale` 覆盖式等比放大（不拉伸，多出来的往两边伸）；`sv.view.node` / `sv.node` 一起归零，让 `view` 上的 RECT Mask 与竖栏严丝合缝。`restorePortrait()` 把 `PoolBG` 的位置 / 旋转 / 缩放、`view` 的位置一并还回去（都是 `onLoad` 快照里的新字段）。详见 §7.1。
  - ⚠️ **`sv.view` 是 `UITransform`（`ScrollView` 的 getter 从 `content.parent` 上取），不是节点**：位置要写 `sv.view.node.setPosition()`，尺寸才是 `sv.view.setContentSize()`。写成 `sv.view.setPosition()` 运行期直接抛，`sv.view.position` 读到的是 `undefined`。这轮 `onLoad` 里就踩过一次（探针报 `Cannot read properties of undefined (reading 'x')`），已改。
  - 已实测（编辑场景里造 4 块 `133.9/175.5/178.4/179.5 × 150` 的临时节点冒充碎片，`--no-save`）：**先跑一轮竖屏排列再切横屏**，`_isAlign` 为 false 时横屏局部 x 是 `-302.7, -124, 76.95, 279.9`（= 竖屏那一行的 x，斜线）；`alignVertical = true` 之后立刻变成 `0, 0, 0, 0`，世界 x 全 `816`，y 依次 `261 / 87 / -87 / -261`；切回竖屏 y 全 `0`、x 回到那一行。几何读数：**池层 227.5×720 @ (456,0)、`PoolBG` euler z=90 / scale 1.068 / footprint 397.389×720、`sv.node` 与 `view` 都是 (0,0) 且都是 227.5×720、Layout `[VERTICAL, 0, 24, 24/24/24/24]`、`sv[false,true]`**，与预测逐位相等。`restorePortrait()` 之后除 `content` 的位置（`ScrollView` 运行期自己管，空池子下差 8.5px）之外**逐项还原**。
  - **转回竖屏**：`onLoad` 把竖屏的节点位置 / 缩放 / 尺寸 / `Widget.enabled` / Layout 的 `type`+间距+padding 全存下来，还原时逐项写回 + `updateLayout(true)` + `scrollToLeft()`。**内容节点的位置与尺寸也存了**：`Layout` 每个方向只写一条边（HORIZONTAL 只写 `width`、VERTICAL 只写 `height`），只还一条的话另一条会永远停在横屏算出来的值上（竖栏的高 720 会跟回竖屏）。
  - 开局的第一次竖屏广播是**空操作**（`_landscape` 还是 false 就直接 return）—— 竖屏那套是已经验过的状态，别去碰它。
  - **横屏底图已接上（2026-10-09）**：横屏用 `assets/recourses/UI及背景/横屏背景.jpg`（2226×1668），由 `ui/BackgroundSwap.ts` 挂在 `BackgroundLayer` 上、听 `ORIENTATION_CHANGED` 换 `Bg_Sprite.spriteFrame`；接线走 `tools/js/mount-bg-swap.js`（幂等），`verify-scene.js` 加 `BackgroundSwap: ['bg', 'landscapeFrame']`。实际读数：竖屏 `背景图 | 024e6312-…@f9941` → 横屏 `横屏背景 | 35ce0428-…@f9941` → 转回来仍是 `024e6312-…`；`onEnable` / `onDisable` 前后 `EventBus._map` 的 `ORIENTATION_CHANGED` 监听数 **1 → 0**（注册对称）。**游戏内不会再看到竖版底图被拉成 2.46× 宽那副样子了。**
    - ⚠️ **横屏这张仍是拉伸铺满**（`sizeMode = CUSTOM` + 四边 Widget + `SLICED`，而它 `.meta` 的 inset 全 0 = 等于 `SIMPLE`）。2226×1668 是 4:3，铺到 16:9 的横屏画布上横向拉 1.33×。要护住边上的构图元素就改那张图的 `.meta`（`borderTop/Bottom/Left/Right`），改完重新导入看 Game View —— **别按枚举顺序猜 `Sprite.SizeMode`**：`CUSTOM = 0`、`TRIMMED = 1`、`RAW = 2`。
  - ⚠️ **观感只在 Game View 里看得见**：编辑模式不跑生命周期、不 tick 调度器，`LandscapeLayout` 的两条路都是事件触发的，场景面板里一个都跑不到。已用手动调 `toLandscape()` / `restorePortrait()` 的探针核对过几何（编辑场景里造 4 块临时碎片冒充池内容，跑完还原、`--no-save`）：横屏读数与上面那串预测**逐位相等**，`restorePortrait()` 之后除 `content` 的（引擎运行期自己管的）位置与宽度外**逐项还原**。**真机上「手感 + 观感」还没跑过。**

**结束界面（2026-10-09）**

`Canvas/UILayer/CtaLayer` 下挂着整个结束界面：

```
CtaRoot                          BackgroundSwap —— 横屏把 bg 换成 横屏背景.jpg
└── End                          四边 Widget（CtaLayer / CtaRoot 也是），起播前 active = false
    ├── bg                       竖版结束背景.jpg，四边 Widget + CUSTOM + SLICED + UIOpacity
    ├── logo                     512×512 @ (0, 288.739)
    └── btn                      692×209 @ (0, -250.495)，挂 Button（Transition.SCALE，zoomScale 0.9）
        └── Img                  Sprite 在这儿 —— 见下面那条「不能缩 btn 自己」
```

- **「结束事件」是 `END_SHOW`，由 `SceneBgSwap.finish()` 抛** —— 底图**真的换完**那一瞬间，不是 `LEVEL_COMPLETE`（那个在最后一格吸上时就抛了，而 Slot_04 还要等胶带 + 蝙蝠 + 放大两秒多）。`revealView` / `revealEffect` 没配时 `reveal()` 直接抛这个事件，免得整条广告永远不出 CTA。
- `CtaController` 收到它才做三件事：`End.active = true` → `bg` 用 `UIOpacity` 淡入（`bgFadeTime`）→ logo / btn 从屏幕上方落下。**没亮出来之前整棵子树是 `active = false`** —— AppLovin QA 专门查「看不见却能点到」，`CtaController.onLoad` 里按住它。
- **下落 + 弹跳全在一个 `drop()` 里**，只写 `position.y` 和 `scale`，x / z 一概不动。落点就是编辑器里摆的位置（`node.position.y`），出发高度按**本节点（`CtaLayer`，运行时被 Widget 撑成画布）的高度现算**：`height/2 + dropMargin`，所以长屏 / 横屏都是从框外进来的，不用另配数。时间轴：下落（`quadIn`）→ 压扁 → 回弹，然后 `bounces` 次「弹起（`quadOut`）→ 落下（`quadIn`）→ 压扁 → 回弹」，每一下的高度 ×`bounceDecay`、时长 ×`√bounceDecay`（自由落体的缩放关系）。位置和压扁共用一条 tween 推一个 `{ y, squash }` 状态对象（和 `SceneBgSwap` / `AudioManager` 同一套路数）。
  - `squash` 是**形变量**：`scale = base × (1 + squash, 1 - squash)`，即落地横向拉宽、纵向压扁。
  - `btn` 比 logo 晚 `stagger` 秒出发，所以是「logo 先落、按钮跟着落」。
- ⚠️ **`btn` 的 Button 缩的必须是子节点 `Img`，不能缩 `btn` 自己**。引擎的 `_handleTouchEnd`（`cocos/scene-graph/node-event-processor.ts:671`）会拿**当前缩放后**的矩形做 hitTest，缩到 0.9 之后贴着边按下再松手会被判成 `TOUCH_CANCEL`，`Button` 收不到 TOUCH_END 就不发 `CLICK` —— **CTA 点击会丢**（引擎自己在 `button.ts` 的 `zoomScale` 注释里也写了这条）。缩 `Img` 则 `btn` 的命中框一动不动，怎么按都收得到。顺带把「下落动画写 `btn` 的 scale」和「按下反馈写 `Img` 的 scale」也隔开了。`verify-scene.js` 会拦「`target === node`」和「缩放目标上没有 Sprite」两种配错。
- **关音效不在 `CtaController` 里**：`AudioManager` 自己也听 `END_SHOW`，走 `stopAll()`（`_closed = true` + 逐条 `stopChannel`，配了 `fadeOut` 的先渐出），之后任何事件都不再起新的（**结束界面自己要响的那条例外，它绑 `END_DROP`，见上面「音频」那节**）。两个模块各听各的，不用互相持有引用（§4）。
- **横屏底图靠复用 `BackgroundSwap`**（挂在 `CtaRoot` 上），和 `BackgroundLayer` 上那个是同一个组件的两个实例，互不干扰。竖屏那张不另配口 —— `onLoad` 读的就是 `bg` 上挂着的 `竖版结束背景.jpg`。
  - ⚠️ 横屏现在换的是**游戏内那张 `横屏背景.jpg`**，不是结束界面专属的。美术出了「横版结束背景」之后，把 `CtaRoot` 上 `BackgroundSwap.landscapeFrame` 重新指一下即可（走 `mount-end-card.js` 里那个常量，或直接在 Inspector 里拖）。
- 接线走 `tools/js/mount-end-card.js`（幂等，scene 上下文，跑完自动存盘）：补四边 Widget、`bg` 改 `SLICED`/`CUSTOM` + 挂 `UIOpacity`、`CtaRoot` 挂 `BackgroundSwap`、`btn` 拆出 `Img` 并配 `Button`、五个口全部指过去。
- ⚠️ **五个口里断一个，整场下落就没了，而且不报错到画面上**（2026-10-09 踩过：美术换图时重建了 `End/logo` 节点，`ctrl.logo` 变成 `null`）。`show()` 里第一句 `drop(this.logo, …)` 当场抛 `Cannot read properties of null (reading 'position')` —— 此时 `End.active` 已经置 true、`bg` 的淡入 tween 也起了，所以**看到的是「结束界面直接出现在最终位置、什么都不动」**；`drop(this.ctaButton.node, …)` 在那句后面，**按钮也不落**。更糟的是这个异常从 tween 的 `.call()` 里穿出去，同一次 `EventBus.emit(END_SHOW)` 后面的监听者收不到（`AudioManager.onEnd` 现在只是恰好排在前面才没被连累）。**改完 `End` 子树就跑一次 `verify-scene.js`** —— `CtaController` 的五个口都在必填列表里，断了会报 `CtaController@CtaLayer !!NULL`。修法就是重跑 `mount-end-card.js`（或那个临时脚本按名字重新指一下），不用改代码。
- 已实测（编辑场景里手动 `onEnable()` → 抛 `END_SHOW`，跑完 `onDisable()` + 还原，`--no-save`）：
  - 注册后总线是 `['END_SHOW' ×2, 'CTA_CLICK' ×1]`（`CtaController` + `AudioManager` / `AudioManager`）；`onDisable()` 后回到空。
  - `End.active` 由 false 变 true，`bg` 透明度被置 0（淡入起步），logo / btn 的世界纵坐标都停在 **780 = 1280/2 + 140**（画布顶边 640 之上，确实在框外）。
  - 手动把两条 tween 推到终点：两者**精确回到编辑器里的 288.739 / -250.495**，scale 回 (1, 1)；中途把 `squash` 喂成 0.16 时读到的 scale 是 **(1.16, 0.84)**。
  - 按钮：`transition = 3`(SCALE) / `zoomScale = 0.9` / `target = Img`，`btn` 的矩形 **692×209 没变**（`Img` 也是 692×209），`btn` 身上已经**没有 Sprite**。
  - 音频：解锁后常驻两条（`bgm` / `鬼叫`）起播，再抛 `PIECE_SNAP_SUCCESS` 多一条 `蝙蝠`；抛 `END_SHOW` 之后 **`live = 0` 且 `_closed = true`**，再抛一次 `PIECE_SNAP_SUCCESS` 仍然是 0。
  - `SceneBgSwap.finish()`（给 `_mat` 补了桩，编辑模式没跑过 `reveal()`）确实抛出了 `END_SHOW`，贴图换成 `完成背景`、扩散节点收掉。
- ⚠️ **观感只能在 Game View 里看**：编辑模式不 tick tween 也不 tick 调度器，上面验的是「建起来了、数对、能收能回」，不是「落得顺不顺、弹得自不自然」。真机上还要过一遍「**点按钮一定跳得出去**」（缩的是 `Img`，命中框是 `btn`，这条是按引擎源码推的，没在真机上试过）。
- ⚠️ **`End/bg` 的贴图换过一次**：原来是 `背景图.jpg`（和游戏内底图同一张），现在是美术新给的 `竖版结束背景.jpg`。`BackgroundSwap._portraitFrame` 读的是「`onLoad` 那一刻 `bg` 上的那张」，所以换图之后不用改任何代码。

**游戏中常驻的下载按钮（2026-10-09）**

新增 `assets/scripts/platform/GameCta.ts` + `Canvas/GameCta`（`mount-game-cta.js` 接线，幂等）。玩法过程中屏幕上一直有一个下载按钮：**竖屏贴画布下沿居中、横屏落在左边空位的中点**，一直呼吸；`END_SHOW` 一到就收掉（那一屏有自己的大按钮，两个一起摆着像坏了）。

- **竖屏那条边交给节点上的 Widget**（`bottom = 6` + 水平居中，`alignMode = ON_WINDOW_RESIZE`），画布多高它自己跟。**`GameCta` 自己一行定位都不写** —— 位置由「谁在那个方向管事」决定：竖屏是 Widget、横屏是 `LandscapeLayout`，两边互相让开（见下面那条）。
- **横屏落在「左边空位」的正中**：`LandscapeLayout` 新增第六个口 `cta`，`toLandscape()` 里先 `cta.getComponent(Widget).enabled = false`（不关掉的话竖屏那个底部 Widget 会把 y 又拽回去），再 `x = -(画布宽 ÷ 2 + totalW ÷ 2) ÷ 2`。空位是「画布左沿 → 拼图列左沿（`-totalW/2`）」，半宽取两头的平均；`totalW = colW + railGap + railW` 只有 `LandscapeLayout` 量得到（拼图列宽要乘 `scale`、栏宽要数碎片的宽），**画布宽从 `view.getVisibleSize().width` 现读** —— 画布节点自己的 `UITransform` 要等下一次 Widget 重排才更新，这一刻读到的还是竖屏那一版。demo 实数（4 块碎片、`scale = 1.4`、横屏画布 1770×1280）：`totalW = 812 + 100 + 227.5 = 1139.5`，空位 `[-885, -569.75]`（315.25 宽），**按钮中心 −727.375**，144 宽的按钮占 `[-799.4, -655.4]`，两边各留约 85px。
- `restorePortrait()` 把 `ctaPos` / `ctaWidget` 还回去（`onLoad` 快照新增这两项），交回 Widget 时顺手 `updateAlignment()` 一次，来回转屏不会越转越偏。
- ⚠️ **`mount-game-cta.js` 里不能调 `widget.updateAlignment()`**：编辑模式下它会把 `_bottom` 按节点当前矩形**回写**一遍，而画布子节点的本地坐标和它算的内缩量对不上，写回来是错的（实测 `6 → 16.367`，节点被顶高 21.84px，而且**这个错值会存进场景**）。只写内缩量 + 手动塞一版坐标就够了 —— 编辑器下一拍自己会把节点摆正（实测从任意位置滚回 −610），运行期更是照 `_bottom` 现算。
  - ⚠️ 场景里 `GameCta` 的 `_lscale` 一度是 **1.91**（来路不明，没有任何脚本写过它）—— `mount-game-cta.js` 现在每次跑都把 scale 压回 1（呼吸 tween 拿编辑器里的 scale 当基准，基准得是 1）。
- ⚠️ **必须是 `Canvas` 的子节点、且排在 `PiecePoolLayer` 后面**：碎片池底图 `PoolBG`（674×372）一直铺到画布下沿**之下**（设计 y 到 −619.81），排在池子前面会被它整个盖住。排在最后的代价是它压在 `UILayer`（进度条 / 引导 / 结束界面）上面 —— 所以 `END_SHOW` 必须收掉它。
- ⚠️ **尺寸 144×48 是被「碎片池的可点区」卡出来的，不是随便定的**：`ScrollView` 的矩形（实测 576.13×250.5，世界 y 56.19–306.69，即**设计 y −583.81 ~ −333.31**）上挂着触摸监听，**落在里面的触摸一律被它认领**（`_sortByPriority` 按兄弟序把池子排在前面）——压上去的那一段按下去没反应。画布正好 720×1280（16:9 竖屏）时，池子下沿到画布下沿只有 **56.19px**，`bottom = 6` 剩 50px，取 48 是「不压进池子」的最大 3:1 按钮（顶边 −586，离 −583.81 还有 2.19px）。手机屏越高余量越大（19.5:9 是 195px），想做大的话得先接受「上半截点不到」，或者把它挪到池子上面去。
  - ⚠️ 竖屏窗口比 16:9 更矮（桌面拉窄的窗口，比例 < 9/16）时画布不足 1280 高，顶边就会顶进池子矩形 —— 手机上不会出现。
  - 按钮贴的是**当前画布**的下沿，所以长屏上它比池子低一截（那是设计稿居中留出来的空带），不是偏了。横屏那边同理，贴的是画布左沿往里的那块空位。
- **跳转走新加的 `MraidBridge.openStore()`**（`isAndroid()` 分支原来在 `CtaController.onClick` 里写了一份，现在两边共用一句）。`CtaController` 的行为一字未变：还是先 `openStore()` 再抛 `CTA_CLICK`（顺序的理由见上面那条）。
- 呼吸：`repeatForever()` 套在最外层（`union()` 之后），scale 从编辑器里摆的值到 ×1.06、`sineInOut`，单程 `breathTime`（0.9s）；`onDisable` / `hide()` 都先 `Tween.stopAllByTarget(this.node)` 并还原 scale。`breathScale = 0` 就不呼吸。
- `Button` 照旧 `SCALE` / `zoomScale 0.9`，**缩放目标是子节点 `Img`**（缩自己没有按边就丢点击，同结束界面那条，`verify-scene.js` 现在两个按钮一起查）。
- 接线：`tools/js/mount-game-cta.js`。⚠️ **赋 `spriteFrame` 会按当前尺寸模式立刻改写节点框**（默认 TRIMMED → 实测被写成 692×209，也就是那张图裁边后的大小），所以顺序必须是「先 `sizeMode = CUSTOM` → 再赋图 → 最后 `setContentSize`」。
- `verify-scene.js` 加了 `GameCta: ['bridge']`，外加三条只读检查：排在 `PiecePoolLayer` 后面、按钮配置、**顶边不许压进 `ScrollView` 的矩形**；原来的按钮检查抽成了 `checkButton(path, name)` 共用。
- 已实测（编辑场景里手动 `onLoad/onEnable`、跑完全部还原、`--no-save`）：注册前后总线 `[] → ['END_SHOW','ORIENTATION_CHANGED'] → []`；`hide()` 后 `active = false` 且 scale 还原；`onClick()` 打出 `[MraidBridge] 本地调试不跳转：https://apps.apple.com/...`（编辑期没有 mraid，走的是 UA 分支，说明 `openStore()` 通）。
  - 落盘读数：`_lpos (0, −610)`、`_lscale (1,1,1)`、Widget `_alignFlags 20`（BOT|HC）、`_bottom 6`、`_alignMode 2`。
  - Widget 侧那三组实测：只写 `bottom = 6` 不调 `updateAlignment()` → 内缩量保持 6，编辑器下一拍把节点摆到世界 y 30（本地 −610）✓；调了 `updateAlignment()` → 立刻被回写成 16.367（`--no-save` 下反复复现）；把节点故意挪到 −642.207 再等一拍 → 又滚回 −610 ✓（也就是「错值只从 `updateAlignment()` 那条路来」）。
  - `toLandscape()` / `restorePortrait()` 的探针（编辑场景里手动调，空池子 → `railW = 48`、`totalW = 960`、编辑期 `visibleW` 恒为 720）：`landscape` 读数 `x = −420`（= `expectX`）、`y = 0`、**Widget 已被关掉**；`restorePortrait()` 之后回到 `x = 0 / y = −610 / widget = true / scale = 1` —— 与进 `toLandscape()` 前逐位相等。⚠️ 这批数字里的画布宽是编辑模式的 720（真机横屏约 1770，按公式落在 −727 那一带），探针验的是**公式与开关的往返**，不是真机上的构图。
  - `verify-scene.js` 只剩那两条既有告警（`ProgressController.label` 为空、`AudioManager` 第 5 条没拖音效）；新增的 `LandscapeLayout.cta` 与 GameCta 那几条只读检查全过（144×48 的顶边离池子可点区下沿还有 2.19px）。
- ⚠️ **观感只能看 Game View / 真机**：编辑模式不 tick tween、也不跑 `start()`。要眼过一遍的是「呼吸的幅度与节奏」和「144×48 下那张 720×240 的按钮图糊不糊、字认不认得出」（那张图缩到 0.2，可能得换成小一号的 CTA 图）。另外**真机上点一下必须能跳**（走的是和结束界面同一个 `openStore()`，但这条 CTA 从开局就在，是「没通关也点了」这条新路径）。

**CTA 点了不跳：容器给的 mraid 没有 `getDeviceInfo`（2026-10-09）**

浏览器里点 CTA 的报错：`Uncaught TypeError: e.getDeviceInfo is not a function`，栈是 `r.isAndroid → r.openStore → r.onClick`。

- **`mraid` 对象是在的**（所以 `api` 不为 null，走了 `getDeviceInfo` 那条分支），只是容器没实现这个方法。`MraidBridge.isAndroid()` 原来裸调 `m.getDeviceInfo().os`，抛在点击回调里 —— `mraid.open` **一次都没执行到**；外层又没有 try/catch，控制台里就只剩这一条 TypeError。
- 修法：`typeof m.getDeviceInfo === 'function'` 才调，否则回退 UA（§8.3 本来写的就是「取不到时回退 UA」，代码没照做）；`open()` 同样先查 `typeof m.open === 'function'`，并且**真跳之前打一行 `[MraidBridge] mraid.open(<url>)`** —— 之前有 mraid 时整条跳转路径一个字都不打，这就是上一轮没有控制台证据可看的原因。
- 实测（编辑场景里给 `globalThis.mraid` 塞假对象，跑完 `delete`，`--no-save`）：修前 `isAndroid()` 抛 `m.getDeviceInfo is not a function`（与线上报错逐字一致）；修后 `{ open }`（没有 `getDeviceInfo`）→ `isAndroid() = false`、`openStore()` 不抛、假 `open` 收到 iOS 链接；`{}`（连 `open` 都没有）→ 不抛、只打日志；没有 mraid → 不抛。探针没在 `globalThis` 上留下 `mraid`（`hasOwnProperty` false）。
- ⚠️ **改完 `.ts` 必须重建产物**：那条报错来自 `build/playable.html`（旧产物，编辑器里重跑一次 web-mobile 构建才会带上新代码）。
- ⚠️ 同一个容器里 `getState` / `addEventListener` 是有的（`onLoad` 没报错才走得到点击），所以只修了这两个方法，没有顺手给整条 MRAID 生命周期加判空。

**圆形扩散揭晓：把「结束背景」那套换图手法搬到每个物品上（2026-10-09）**

新增 `assets/scripts/gameplay/CircleReveal.ts`（挂在 `EffectLayer` 上，和 `RepairSweep` / `RepairReveal` 并列，全局一个实例），
每格的可选口是 `PieceSlot.circleReveal`，总开关是 `FeatureFlags.circleReveal`（场景里现在是**开**）。修好一格的观感变成：
**破损图留着垫在底下，修复图从缺口中心长出一个圆、边缘羽化扩出来盖掉它** —— 和结束背景同一套换图手法。

- **用的就是结束背景那一份 `bg-reveal.effect`**，区别是直接把材质挂在这一格「修复后的图」的 Sprite 上 ——
  要盖住的东西就是它自己，不用像 `SceneBgSwap` 那样另建一层子节点、扩散完再把贴图交接给父节点。
  圆心 / 跨度同样按节点的世界矩形手算（`contentSize × worldScale` + anchor + worldPosition，§14 那条），
  跨度取半对角线（进度 1 正好够到四角），走到 `1 + feather` 才算完，然后 `customMaterial = null` + `destroy()`。
- **破损图留着垫在底下**：`PieceSlot.repair()` 对配了本组件的槽位**不立刻**收 `brokenView`，等扩散铺满由
  `circleShown()` 收掉再抛 `PIECE_SHOWN`。所以是「新图盖着旧图长出来」，不是「先空一块再冒出来」。
- **这一格整格接管**：`repair()` 里它是第一个分支，配了它的槽位**胶带 / 序列帧 / 换节点都不会发生**。
  所以 `revealAnim` 还挂在 Slot_01/02 上却走不到 —— 不用去清，关掉开关它自己就回来了。
- ⚠️ 圆心取的是**修复图自己的**矩形中心，不是 `slot.worldCenter`（那是破损图那个框的中心）：实测两者差
  **7.94px**（512.73, 785.90 vs 512.73, 793.84）—— 材质算的是「到本节点自己四角的距离」，用另一个框的中心会偏心。
- ⚠️ `revealParams` 是**每个句柄一份 Vec4**（不像 `SceneBgSwap` / `RepairSweep` 那样共用一个）：两块碎片前后脚
  吸上时两道扩散会同时在飞，共用一份就是后一个把前一个的圆心 / 跨度踩掉。
- 接线走 `tools/js/mount-circle-reveal.js`（幂等，scene 上下文，跑完自动存盘）：**只接了 Slot_01 / Slot_02** ——
  `Slot_03`（毛衣换节点）/ `Slot_04`（胶带）就是「整格接管」的直接牺牲者，指过去会把它们各自那套顶掉。
  要让那两格也走圆形扩散（等于放弃胶带 / 毛衣），把它们的 `circleReveal` 也指过来即可。
  `verify-scene.js` 加了 `CircleReveal: ['revealEffect']`。
- **想整条关掉**：`FeatureFlags.circleReveal` 取消勾选 —— Slot_01/02 立刻退回「序列帧 + 放大」那套，接线不用动。
- 已实测（编辑场景里 `slot.repair(0)`，跑完还原，`--no-save`）：`handles()` 为 true、`repair()` 返回 true，
  `Broken` **仍 active**、`Repaired` 亮起、材质 `bg-reveal` 挂上，
  `revealParams = (512.73, 785.90, 0, 0.0101443)`（w = 1÷98.577 = 1÷半对角线）、`revealEdge = (0.35, 0, 0, 0)`；
  手动 `stop(node, true)`（编辑模式不 tick tween，只能这么收）→ **破损图收起、`customMaterial` 清空**。
  `FeatureFlags` 面板里 `circleReveal: true` 已落盘，两格 Slot 的引用、`EffectLayer` 上那个组件（`revealTime 0.6` /
  `feather 0.35` / `revealEffect = 45692ecc…`）都在 `assets/scene.scene` 里。
- ⚠️ **扩散的观感（0.6s、羽化宽度、和扫光的叠加）只能在 Game View 里眼过一遍**：编辑模式不 tick tween。

**待你确认**

- ⚠️ **撑满屏幕那段临时探针还留在 `GameEntry.ts` 里**（`start()` 的 `scheduleOnce(this.probe, 0.5)`、`probe()` 方法、`Sprite` / `UITransform` 两个 import）。**要在 Game View 里跑一次预览**（MCP 的 `run_project_preview` 在 `full` profile 里，起不了），读 `get_recent_logs` 那行 `[Probe]`，对三条：
  1. `visible` 比 `canvas` / `layer` / `bg` **三者相等且都比 1280 高**（= 画布撑满了，尾数由窗口比例定）；
  2. `type=1`（SLICED）、`insetT=160`；
  3. `game=748.559`、`sceneBg=748.559`、`pool=300`（钉住的都没跟着画布长）。
  同时**手动拖一块碎片吸附一次**（`SnapSystem` 那条改成现读 `worldCenter`，吸附点得跟着拼图区一起下移）。核对完删掉探针 —— 删之前不影响构建与预览。
  - 顺便看的是观感：竖屏下构图应该和 SHOW_ALL 时**一模一样**，多出来的高度上下各一半（见上面「画布变高之后的样子」）；底图九宫格纵向拉伸后中段有没有明显失真。
  - **这次还要转一次横屏**（2026-10-09）：横屏是「补宽度」，`visible` ≈ `canvas` ≈ `layer` ≈ `bg` 且**都比 720 宽**（不再比 1280 高），四边看不到黑边、两侧是背景；`game=748.559` / `pool=300` / `progressY` 三个读数**与竖屏完全一致**（只是换了居中位置）。再拖一次碎片吸附，确认横屏下吸附点没跑偏。

- ~~**`GuideLayer` 现在是空的**~~ **已结（2026-10-09）**：`TextGuide` / `FingerGuide` 两个节点 + `GuideController.textGuide` / `fingerGuide` 两个属性一起删了，`GuideLayer` 换成 `GuideRoot / GuideGhost / GuideFinger` 三个节点（见上面「空闲引导」那条）。`build-scene.js` 里建那两个节点、接那两个属性的一段也去掉了（那个脚本本来也已经停用，见 §16 末尾）。**要文字引导得重新加一个节点 + 重新写这条属性**，别指望 `textGuide` 还在。
- 素材配对：槽位提示框用的是 `[厨房危机]白色边缘线/柜子_透明底_外轮廓白线_白线.png`（946×1400，宽高比 0.676），拖入的碎片是 `916厨房危机压缩版/[完成]柜子.png`（256×447，比例 0.573）。两者不是一套。真正 1:1 的对应图应该是 `柜子_同款白边投影_透明底.png`（402×692，比例 0.581）。demo 按你指定的两张搭了：槽位矩形取碎片的比例（355×620），碎片永不变形，代价是白线框被压扁约 18%。
- §13.2 那条仍然是最大的风险：美术总量按 2MB 上下卡，base64 还要再涨 33%。

## 15. 功能开关（`config/FeatureFlags.ts`）

`assets/scripts/config/FeatureFlags.ts` 是**唯一的开关面板**：一个布尔字段关掉一整项可选表现。它是个组件，**挂在 Canvas 上**，值在 Inspector 里勾。改完**存场景 + 重开预览** —— 面板是场景数据，跑着的那个预览不会热更新。

| 开关 | 关掉以后 | 落点 |
|---|---|---|
| `pieceGlow` | 碎片不再生成 Glow 子节点与材质 | `gameplay/PieceFactory.ts` |
| `trail` | 不生成白点贴图、不建拖尾节点 | `gameplay/TrailEmitter.ts` |
| `revealOnRepair` | 修好时不再播序列帧、也不放大，修复图照旧瞬间出现（毛衣那格也退回「先露出实物、过 `swapDelay` 再换节点」） | `gameplay/RepairReveal.ts` |
| `circleReveal` | 配了「圆形扩散揭晓」的槽位（现在是 Slot_01/02）退回原来的揭晓 —— 序列帧 + 放大 | `gameplay/CircleReveal.ts` |
| `sweepOnRepair` | 单块吸附成功不再扫光 | `gameplay/RepairSweep.ts` |
| `sweepOnComplete` | 全部修完不再扫光 | `gameplay/RepairSweep.ts` |
| `guide` | 空闲引导整棵 `GuideRoot` 藏起来，也不注册任何监听（含全局 `input` 那条） | `ui/GuideController.ts` |
| `progress` | 进度层整层隐藏 | `ui/ProgressController.ts` |
| `audio` | 不注册任何音频监听（含首次触摸解锁那条全局 `input` 监听） | `audio/AudioManager.ts` |

**读侧与组件顺序无关**：消费方照旧写 `FeatureFlags.audio`（静态 getter），getter 每次现扫场景找那个面板实例。这不是绕远路：同节点的组件 `onLoad` / `onEnable` 按数组顺序走，而 `AudioManager` 就挂在 Canvas 上、在 `onEnable` 里读开关 —— 面板要是刚好排在它后面，玩家开播时读到的是默认值，Inspector 里勾的「关」就白勾了。全程只读十几次，不做缓存（缓存就得管生命周期）。**把面板挪到别的节点上也不会坏。**

面板不在场时（编辑器编辑模式不跑生命周期；面板被误删）getter 退回 `DEFAULTS`（全开）—— 删掉面板不会让玩法残缺，但会**静默忽略勾选**，这就是 `verify-scene.js` 里那条 `FeatureFlags` 存在性检查的意义。挂载走 `tools/js/mount-flags.js`（幂等，已有就原样保留值，不会复位）；`tools/js/build-scene.js` 里那一行带存在性判断，同理。**Scene 根节点挂不了组件**（引擎直接报 `Cannot add any component to the scene`），所以别想着往那儿挪。

**落点规则**：gate 放在「会建节点 / 生成贴图 / 起 tween / 改 active」的那一句前面，`onEnable` 与 `onDisable` 的对称性一律不动（`EventBus.off` 对没注册过的回调是安全的，`core/EventBus.ts` 只是遍历列表）。

- 整个组件只干这一件事（`TrailEmitter` / `AudioManager`）：`onLoad` / `onEnable` 首行 early return。
- 关掉后要顺带藏起自己那棵「作者可见」节点的（`GuideController` / `ProgressController`）：在 `onEnable` 里先 `hideAll()` / `root.active = false` 再 return —— 这两棵在场景里一开始就显示（引导文字、进度写着 `0/1`），不藏就等于没关。
- 一个组件管两个开关（`RepairSweep`）：gate 在两个 handler 首行，不 gate 监听注册。
- 挂在别人身上的（`PieceGlow`）：由 `PieceFactory` 两处一起决定（池工厂里不 `addComponent` + `create()` 里不调 `apply`），少任一处就是空引用或白建节点。
- 事件与发射方一律不动：`RepairSystem` / `SnapSystem` / `DragController` 照旧抛 `PIECE_REPAIRED` / `REPAIR_PROGRESS` / `LEVEL_COMPLETE` / `PIECE_SNAP_FAIL`，只是可能没人听。开关表里不出现事件名。

⚠️ **运行期开关省不下字节**：web-mobile 产物是 SystemJS `System.register` 模块、`mangleProperties: false`，跨模块没有死代码消除 —— 被关掉的代码、以及它引用的 `.effect` 资源照旧进包。省下的只有运行期开销。要把这部分字节也拿回来，得让 `build-scene.js` 读同一份开关、关掉时不挂组件 / 不赋 `EffectAsset`（两个 `.effect` 各几 KB + 场景里的两条引用）；还没做，等真要腾体积时再说。**开关之外真正能省体积的只有 §9 的引擎裁剪。**

**合规项不进开关表**：转屏重排、MRAID 生命周期、CTA —— 关掉就是不合规，不给开关，免得手滑关掉交出去。（「无交互保活」原本也在这条里，2026-10-08 按要求整体删除，见 §14。）

## 16. Inspector 里的调参表

**能调的数全在 Inspector 里，代码里一个常量都不留**（`GameConstants.ts` 已删：最后剩的两个布局高度随 `LayoutController` 一起退场 —— 布局现在由 Widget 撑）。可调参数一律挂在各自使用者的组件上，带中文 `displayName`，Inspector 里改完存场景即生效。

| Inspector 里的名字 | 字段 | 挂在 |
|---|---|---|
| 池内碎片高度 | `pieceHeight` | `PieceFactory` @ `Canvas/PiecePoolLayer/ScrollView` |
| 亮边参数（淡入 / 淡出 / 呼吸一次 / 光晕外扩比 / 光边宽度比） | `glowParams`（`GlowConfig`，折叠分组） | 同上 |
| 发射步长 / 光点存活时长 / 光点尺寸 / 单帧最多补几颗 | `step` / `life` / `dotSize` / `maxPerFrame` | `TrailEmitter` @ `EffectLayer` |
| 单块·总修复各三项（时长 / 光带半宽比 / 补光强度） | `repairTime` … `completeFlash` | `RepairSweep` @ `EffectLayer` |
| 序列帧 / 每帧时长 / 序列帧尺寸（相对缺口宽度）/ 修复图放大时长 | `frames` / `frameInterval` / `sizeRatio` / `revealTime` | `RepairReveal` @ `EffectLayer` |
| 圆形扩散：扩散时长 / 羽化半宽 / 扩散材质 | `revealTime` / `feather` / `revealEffect` | `CircleReveal` @ `EffectLayer`（见 §14；每格在 `PieceSlot.circleReveal` 上选） |
| 拿起放大时长 | `pickScaleTime` | `DragController` @ `GameLayer` |
| 弹回原位时长 | `returnTime` | `PiecePool` @ `PiecePoolLayer` |
| 补位滑动时长 | `reflowTime` | 同上（填 0 退回瞬移，见 §14） |
| 吸附半径 / 吸附半径比 | `snapRadius` / `snapRadiusRatio` | `PieceSlot` @ `Slot_01` |
| 换节点延迟 | `swapDelay` | `PieceSlot` @ `Slot_03`（毛衣；**只在关了「修复揭晓」时生效**，现在是 0.45，见 §14） |
| 换节点渐显时长 | `swapFadeTime` | 同上（毛衣；默认 0.25，填 0 退回硬切，两边都得挂 `UIOpacity`，见 §14） |
| 进度条填充缓动时长 | `fillTime` | `ProgressController` @ `UILayer` |
| 结束界面入场（背景淡入 / 下落时长 / 出发高度 / 按钮间隔 / 弹跳次数 / 首跳高度 / 衰减 / 首跳时长 / 压扁幅度 / 压扁时长） | `bgFadeTime` / `dropTime` / `dropMargin` / `stagger` / `bounces` / `bounceHeight` / `bounceDecay` / `bounceTime` / `squash` / `squashTime` | `CtaController` @ `CtaLayer`（见 §14） |
| 引导节奏 + 副本 / 手指外观（空闲延迟 / 循环间隔 / 点击提示 / 点击下沉 / 拖动时长 / 淡入淡出 / 副本透明度 / 手指偏移） | `idleDelay` / `loopGap` / `tapTime` / `tapDepth` / `moveTime` / `fadeTime` / `ghostOpacity` / `fingerOffset` | `GuideController` @ `UILayer` |
| 完成背景扩散时长 / 羽化半宽 | `revealTime` / `feather` | `SceneBgSwap` @ `GameLayer/Scene_BG` |
| 音频配置列表（激活事件 / 音效 / 音量 / 渐入 / 渐出 / 结束事件）+ 总音量 | `cues` / `volume` | `AudioManager` @ `Canvas`（见 §14） |
| 横屏放大倍率 / 拼图区与进度条间距 / 两栏间距 / 竖栏最大高度 | `scale` / `columnGap` / `railGap` / `maxRailHeight` | `LandscapeLayout` @ `Canvas`（见 §7.1） |
| 横屏底图旋转（度）/ 缩放系数 | `poolBgRotate` / `poolBgScale` | 同上（见 §7.1；`poolBgScale = 1` 即等比盖住竖栏） |
| 常驻按钮：呼吸放大比 / 呼吸单程时长 | `breathScale` / `breathTime` | `GameCta` @ `Canvas/GameCta`（见 §14）。**位置不在这儿**：竖屏是同一节点上的 Widget（`bottom = 6`），横屏是 `LandscapeLayout` 的 `cta` 口；尺寸在节点自己的 `UITransform` 上，改之前先看那条 56px 的限制 |

三条踩过的坑：

- **亮边的 5 个参数挂在 `PieceFactory` 上，不在 `PieceGlow` 上**：碎片是运行时建的节点，场景里没有实例，参数没地方存。`GlowConfig` 是个 `@ccclass` 数据类，Inspector 里显示成可折叠分组，`PieceFactory.create()` 把它传给 `PieceGlow.apply()`。
- **池内碎片间距也不在这里**：落点就是 `Canvas/PiecePoolLayer/ScrollView/view/content` 上那个 `Layout` 组件自己的 `spacingX`（还有四边的 padding）。以前 `LayoutController` 转屏时会按 0.6 倍写回它，现在**没有任何代码碰它**，你在 Inspector 里改的就是最终值。
- **新增 `@property` 后编辑器要刷一次资源库**（MCP `refresh_assets`）才会出现在已有组件实例的 Inspector 上：新字段进来了，但场景里那些老实例的属性表还是旧的。不用重启编辑器、不用重开场景。这次是靠 `query-node` 返回的数据模型（字段 + `displayName` + `value` + `default`）逐项核对确认的，比截图可靠。
  - ⚠️ **`refresh_assets` 在 `core` profile 里（本仓库的默认配置，`funplay-cocos-mcp.config.json`）不可用**，`run_project_preview` 也一样。绕法：`tools/js/refresh.js` 走 scene/editor 侧的 `Editor.Message.request('asset-db', 'refresh-asset', <dbUrl>)`（就是那个工具的实现）。**改完 `.ts` 不刷，编辑器内存里跑的还是旧类** —— 探针调 `comp.toLandscape()` 会调到旧实现，白测一轮。

⚠️ **`tools/js/build-scene.js` 现在是危险动作，别再跑了**：它把 Canvas 下所有层 `removeFromParent` + `destroy` 再重建 —— 换来的不只是上表这些值被复位，而是你手摆的整棵层级（`GameLayer` 是四边 Widget 撑出来的一块、池条带抬了 62px、`Slot_01` 的位置和缩放、`Scene_BG` 底下那张图）**一起没了**。它只在「从零拉一个 demo 场景」时才有用，文件头也写了这句。日常改动走 `tools/js/verify-scene.js`（只读）就够了。
