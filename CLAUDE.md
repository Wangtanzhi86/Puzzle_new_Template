# 拼图修复 · 试玩广告 项目开发规范

> 本文档是**规范**，也是每次迭代的实现 Prompt。**开工前先读这一份**，所有改动必须遵守本文约定。

## 文档地图

| 文件 | 什么时候读 |
|---|---|
| **本文件** | 每次开工前。约定、规范、调参表、事件清单 —— 「该怎么做」 |
| [docs/WORKLOG.md](docs/WORKLOG.md) | 想知道「这处为什么写得这么绕 / 这功能当时怎么验的 / 之前试过什么方案 / 现在什么状态」时。**踩坑档案与实测记录**，按需查，不用通读 |
| [docs/ANALYTICS.md](docs/ANALYTICS.md) | 接 / 改 / 查试玩埋点（§17）。**§1–§6 是可移植的接入规范**（官方事件全表 + 参考实现 + 映射规则），**换项目可以直接拿走**；§7 才是本项目的接线 |

文中「§N」一律指**本文件**的对应小节。WORKLOG 里的「§N」也指本文件。
ANALYTICS.md 自成一个文件，它内部的「§N」指它自己，写明 `CLAUDE.md §N` 的才指本文件。

**本文件的分区**：§0–§13 是规范与约定 · **现状速查**（下方，结论性状态）· §15–§17 是开关表 / 调参表 / 埋点。

---

## 现状速查

> 这一节是**结论**，不是历史 —— 详细来龙去脉在 [docs/WORKLOG.md](docs/WORKLOG.md)。
> ⚠️ 这里的数字会随换美术 / 改关卡而变，动手前先现读一遍。

### 当前场景（2026-10-12 核实）

| 项 | 值 |
|---|---|
| 槽位 | **6 个**：`Slot_01` … `Slot_06`；`pieceId` = 0 / 1 / 2 / 3 / 4 / 5（唯一，不并列） |
| 碎片池 | `batchSize = 3`（一屏 3 块，这一批用光才补下一批）、`batchFadeTime = 0.5`、`reflow = true`（自动补位开着） |
| 终局 | `EndgameCta.winCount = 4` —— 修满 4 格自动跳商店；**第 4 格吸附成功那一刻就跳**，不等它的揭晓动画 |
| 每格揭晓 | 6 格**全部**走「贴纸贴平」（`stickerApply`），推完还带一下**收尾脉冲**（缩小淡出 → 放大淡入）；`circleReveal` 全为 null；`revealAnim` 都配着但走不到 |
| 每格揭角 | 6 格都勾了「本格单独配揭角」（`peelOverride = true`） |
| 失败路 | **走不到**：6 格的 `altView` / `requires` 全空 ⇒ `REPAIR_FAILED` 永不抛 |
| 结束界面 | **走不到**：`winCount = 4 < 6` ⇒ `END_SHOW` 到不了（`CtaController` 整套代码与场景都还在） |
| MCP 端口 | **每轮都可能变**，本轮是 `24148`（`tools/exec.mjs` 默认 20168，要 `MCP_PORT=24148` 覆盖） |

**已经退场的表现（代码还在、场景里一个都没配）**——动手做「表现」之前先认一下，
别照 [docs/WORKLOG.md](docs/WORKLOG.md) 里那些历史小节以为它还在跑：

| 表现 | 现状 |
|---|---|
| 收尾动作「通马桶 / 扫地 / 喷瓶」 | `FlushAction` / `BroomSweep` / `SprayAction` 组件在代码里，**场景里一个实例都没有**；它们依赖的 `气体大` / `气体小` / `马桶隐藏节点` / `扫把隐藏节点` 等节点也**已经不存在** |
| 地上脏水 | `GroundWater` 组件与 `地上脏水` 节点都不在场景里 |
| 换节点（`swapHide` + `swapShow`） | 6 格全为 null（那个机制本身还在代码里） |
| 两种状态（`altView` + `requires`） | 6 格全空，见上表「失败路」 |
| 胶带揭晓 / 稻草人序列帧 | `TapeReveal.ts`、`FrameLoop.ts` **已从代码里删除**，`TAPE_REVEAL` / `WINDOW_REPAIRED` 两个事件也已不在 `GameEvent` |
| 待机动作 `IdleMotion` | 组件在代码里，场景里没有实例（没有可挂的节点了） |
| 圆形扩散 / 序列帧揭晓 / 扫光 | 组件都还挂在 `EffectLayer` 上，但**开关全关**且 6 格都没配 ⇒ 不演（见上表开关） |

### 功能开关当前状态（§15）

| 开关 | 值 | 影响 |
|---|---|---|
| `stickerPeel` | 开 | 拿起碎片时揭角 |
| `stickerApply` | 开 | 修好时贴平 —— **这是现在唯一的单块揭晓** |
| `progress` / `audio` | 开 | |
| `pieceGlow` | **关** | 拖起来没有白边发光 |
| `trail` | **关** | 没有拖尾光点 |
| `revealOnRepair` | **关** | 修好时不播序列帧、不放大 |
| `circleReveal` | **关** | 圆形扩散整条停用 |
| `sweepOnRepair` / `sweepOnComplete` | **关** | 单块 / 总修复都不扫光 |
| `guide` | **关** | ⚠️ 空闲引导不显示、不注册监听 —— 见下面第 2 条风险 |

### ⚠️ 三条待确认（都不是代码问题，是配置决策）

1. **观感只剩「揭角 → 贴平」**：上面连着的 6 个开关是关的（glow / trail / revealOnRepair / circleReveal / sweep×2），
   修好时既不扫光也不播序列帧。**是有意收敛还是一轮轮改下来忘了开**，需要确认。
2. **`FeatureFlags.guide = false` 让 §8.1 第 6 条没有兜底**：空闲引导是「无用户交互时不得超时」目前**唯一**的兜底
   （见 §8.1 对照表第 6 行）。关着就回到「玩家全程不碰屏幕 → 画面完全静止」。交审前必须确认。
3. **`EndgameCta.winCount = 4`，而总共 6 个槽位**：玩家永远修不满整张图，第 4 格**吸附上就跳商店**。
   进度条停在 4/6。是有意控时长还是漏改，需要确认。

### 美术现状与空壳（2026-10-12 核实）

**六个槽位的图是齐的**（`Broken` / `Repaired` 都有贴图）：`女人线/女人`、`男人线/男人完整`、`伞线/伞`、
`花线/花`、`猫线/猫`、`高跟鞋线/高跟鞋`。`Scene_BG` 也有图（`拼图` 569×840）。

**还没配图 / 配错的**：

| 位 | 现状 | 要修的话 |
|---|---|---|
| `Bg_Sprite`（整体背景） | 挂的是 **`纯白` 4×4** —— 拼图区以外整屏是白的 | 换美术给的底图。⚠️ 换完再配 inset（见下） |
| `End/bg`（结束界面底） | 同样是 **`纯白` 4×4** | 同上 |
| `PoolBG`（碎片池底图） | **没贴图**（`spriteFrame = null`） | 拖一张进去 |
| `完成背景` | **没贴图** —— `SceneBgSwap.finish()` 是把它那张挪到 `Scene_BG` 上，空的就等于把底图抹掉 | 拖一张进去（该功能当前也走不到，见上表） |
| `ProgressController@UILayer` | `label` 为空 —— `ProgressLayer` 下没有进度文字节点 | 加个 Label 拖进那个口，代码不用改 |
| `BackgroundSwap@CtaRoot` | `landscapeFrame` 为空 —— 结束界面横屏没有专属底图 | 出「横版结束背景」之后指过去 |
| `Slot_05` / `Slot_06` 的 `Broken`（还有 `Slot_06` 的 `Repaired`） | Sprite 尺寸模式是 **`TRIMMED`**，而 §6 要求 `CUSTOM` —— 缺口框会跟着贴图的裁剪走，和节点矩形对不上 | 在 Inspector 里把这几张改成 `CUSTOM` |

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

## 0. 项目基线

| 项 | 值 |
|---|---|
| 引擎 | Cocos Creator **3.8.8**，TypeScript |
| 项目路径 | `d:\cocos\Puzzle_261012\Puzzle_new_Template` |
| 设计分辨率 | **720 × 1280**，fitHeight + fitWidth（**运行期会被 `ScreenAdapter` 改掉**，见 §7.1） |
| 方向 | 竖屏为主，**必须同时支持横屏**（§7.1） |
| 类型 | 拼图修复类试玩广告（Playable Ad） |
| 投放平台 | **AppLovin**（主）；Moloco / Google 同一份源码出另外两份产物（§8.6） |
| 体积红线 | 单 HTML **< 5MB**（§9） |
| 编辑器操作 | 通过 MCP（HTTP，端口每轮可能变 —— 见现状速查） |

**前置条件**：Cocos Creator 编辑器必须打开本项目且 `funplay-cocos-mcp` 扩展已加载（端口在监听），MCP 工具才可用。
场景 / 节点 / 预制体 / 组件挂载操作**优先走 MCP**，不手写 `.scene`、`.prefab` JSON。

驱动脚本：

```
node tools/exec.mjs <scene|editor> <脚本.js> [argsJson] [--no-save]
node tools/mcp.mjs <工具名> [argsJson]
```

`scene` 上下文默认自动存场景（`--no-save` 关掉）。**改完 `.ts` 要先刷资源库**（`tools/js/refresh.js`），
否则编辑器内存里跑的还是旧类（§16 末尾）。

## 1. 玩法定义

1. 屏幕下方是**碎片池**，玩家从中拖动碎片。
2. 拖动碎片靠近目标缺口，**进入吸附半径即自动吸附**（不需要松手，也不需要精确对位）。
3. 未进入任何正确缺口范围就放开（或拖到错误位置）→ 碎片 **tween 弹回碎片池原位**。
4. 每次成功吸附触发**单块修复事件**：该缺口位置由「修复前」切换到「修复后」，播放局部反馈。
5. **修满 `winCount` 格**（不是全部）→ 触发**终局**：抛 `GAME_OVER` 冻结玩法并跳商店。
   **跳转就在这一格吸附成功的那一下**，不等它的揭晓动画（细节见 [docs/WORKLOG.md](docs/WORKLOG.md) 的「终局跳转」）。
   若 `winCount = 0` 则退回老路：全部修完 → 总修复事件 + 进度满 + 结束界面。
6. 碎片数量 = 缺口数量，**不打乱顺序**（固定排列，按 `pieceId` 排序，方便调试与美术预览）。
7. 有**空闲引导**：玩家一段时间不操作，就演一遍「手指拖着半透明副本，把池里最前面那块碎片送到它的缺口」。
   碰一下屏幕立刻收掉，再空闲又演一遍，通关才停。见 WORKLOG「空闲引导」。
   ⚠️ 当前 `FeatureFlags.guide` 是**关**的，所以这条实际不生效（见现状速查风险 2）。

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

```
Canvas                          Widget 全屏
├── BackgroundLayer             Widget 全屏，挂 BackgroundSwap（横竖屏各一张底图）
│   └── Bg_Sprite               Sprite —— 广告整体背景，四边 Widget + CUSTOM + SLICED
├── GameLayer                   Widget 撑出来的「拼图目标范围」，比整体背景小
│                               ⚠️ 挂了 RECT Mask（同尺寸），出框的图会被裁掉
│   ├── Scene_BG                Sprite —— 拼图场景背景（空图占位，美术自己拖）；贴齐
│   │                           GameLayer 四边，所以它就是拼图区的大小，排在最底层
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

单一职责，**每个脚本 ≤ 1000 行**，模块间**只通过 EventBus 通信**，禁止跨模块直接持有引用。

```
assets/scripts/
├── core/
│   ├── EventBus.ts          事件总线（on / off / emit / offTarget / offAll）
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
│   ├── RepairedSlot.ts      修复后节点组件：可配显隐时机
│   ├── FlushAction.ts       收尾动作「通马桶」（当前无槽位配，见下）
│   ├── GroundWater.ts       地上脏水：修错时从上到下刷出来（当前无槽位配）
│   ├── BroomSweep.ts        收尾动作「扫地」（当前无槽位配）
│   ├── SprayAction.ts       收尾动作「喷瓶」（当前无槽位配）
│   └── SceneBgSwap.ts       全部修完：完成背景从中心圆形羽化扩散（抛 END_SHOW）
├── gameplay/
│   ├── PieceFactory.ts      碎片视图工厂（创建 / 回收 / 复位）
│   ├── PiecePool.ts         碎片池（Layout 内横向排列，对象池复用，分批上场）
│   ├── DragController.ts    拖拽输入（触摸事件 → 位置更新）
│   ├── SnapSystem.ts        吸附判定（距离 < snapRadius → 吸附）
│   ├── RepairSystem.ts      修复流程：单块修复 + 进度 + 总修复
│   ├── PieceGlow.ts         拖动亮边
│   ├── TrailEmitter.ts      拖动拖尾
│   ├── RepairSweep.ts       修复扫光（单块 / 总修复）
│   ├── RepairReveal.ts      修复揭晓：序列帧 + 从小到大放大
│   ├── CircleReveal.ts      圆形扩散揭晓（bg-reveal 材质）
│   ├── StickerPeel.ts       贴纸揭角：拿起碎片时一角折起来露出背面。导出 `peelLine()` 与 StickerApply 共用
│   ├── StickerApply.ts      贴纸贴平：修好时修复图整张出现、一角翘着，再推向对边按平；推完还带一下收尾脉冲（缩小淡出 → 放大淡入）
│   └── IdleMotion.ts        通用循环待机动作（以编辑器里摆的位置为基准走正弦）
├── ui/
│   ├── GuideController.ts   空闲引导：手指 + 半透明副本演一遍拖动（纯画面，不碰玩法）
│   ├── ProgressController.ts 进度显示
│   ├── ScreenAdapter.ts     屏幕策略：按窗口比例换 ResolutionPolicy 把画布撑满（§7.1）
│   ├── LandscapeLayout.ts   横屏两栏布局（§7.1）
│   └── BackgroundSwap.ts    横竖屏各一张底图，转屏换 spriteFrame（§7.1）
├── platform/
│   ├── MraidBridge.ts       MRAID 生命周期、ready 时序、平台判定、静音通知（openStore() 是唯一跳转入口）
│   ├── CtaController.ts     结束界面：背景淡入 + logo / 按钮下落弹跳
│   ├── EndgameCta.ts        终局跳转：修满 winCount 个 / 修错 → 跳商店，之后点哪都跳
│   ├── GameCta.ts           游戏中常驻的下载按钮
│   └── PlayableAnalytics.ts AppLovin 试玩埋点，见 §17
├── audio/
│   └── AudioManager.ts      音频总控：配置列表（激活事件 / 音效 / 音量 / 渐入渐出 / 结束事件）
└── bootstrap/
    └── GameEntry.ts         唯一入口，负责初始化与模块装配
```

新增 / 改名脚本，`.scene` 里的组件引用不会断（按**脚本 uuid** 记 `__type__`，不是类名），
只要 `.ts` 和 `.ts.meta` 一起改、uuid 不变。

⚠️ **「代码里有」不等于「当前场景在用」**：`FlushAction` / `BroomSweep` / `SprayAction` / `GroundWater`
四个收尾动作、`IdleMotion` 待机动作、`PieceSlot` 的 `swapHide`+`swapShow`（换节点）
与 `altView`+`requires`（两种状态）、`poolSprite` —— **脚本都还在、都没坏，但场景里连组件实例都没有
（它们要挂的那些节点也已经不存在了）**；`RepairReveal` / `CircleReveal` / `RepairSweep` 三个特效组件
倒还挂在 `EffectLayer` 上，但**总开关是关的、槽位也没配**。改「表现」之前先确认那一格到底走的是哪条路 ——
清单在**现状速查**里。写代码时**不要**按这些"还能用"的前提去改动它们（会白改）。

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
| `PIECE_SHOWN` | PieceSlot | `slotIndex` | RepairSweep, EndgameCta（**只剩失败路**）, SceneBgSwap |
| `REPAIR_PROGRESS` | RepairSystem | `current, total` | ProgressController, **PlayableAnalytics** |
| `LEVEL_COMPLETE` | RepairSystem | — | RepairSweep, ProgressController, GuideController, AudioManager |
| `END_SHOW` | SceneBgSwap（底图**换完**那一刻） | — | CtaController, AudioManager（停全部音） |
| `END_DROP` | CtaController（logo **开始下落**那一刻，比 `END_SHOW` 晚一个 `bgFadeTime`） | — | AudioManager |
| `GAME_OVER` | EndgameCta（终局那一跳发出去之前） | — | DragController, PiecePool, GuideController, GameCta, **PlayableAnalytics** |
| `GUIDE_HIDE` | DragController | — | GuideController |
| `GUIDE_HOLD` / `GUIDE_RESUME` | PieceSlot（`repair()` 开头 / `spotDone()` 末尾，**一格一段**） | — | GuideController |
| `CTA_SHOW` / `CTA_CLICK` | CtaController / EndgameCta / GameCta | — | 平台回调, AudioManager（`CTA_CLICK` 停全部音）, **PlayableAnalytics** |
| `ORIENTATION_CHANGED` | GameEntry | `isPortrait` | DragController, PieceGlow, TrailEmitter, LandscapeLayout, BackgroundSwap, PiecePool, GameCta |
| `AUDIO_MUTE` | MraidBridge | `muted` | AudioManager |

**事件与发射方一律不动**：接埋点（§17）、加音效（规则见 [docs/WORKLOG.md](docs/WORKLOG.md) 的「音频：配置列表 + 常驻音」）、加表现，都只在**监听侧**加，
不改发射方，也不新增事件名到业务代码里。§15 的开关表里不出现事件名。

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

### 7.1 双方向支持（硬性要求）

广告**必须同时支持横屏与竖屏全屏**，且中途转屏不能中断玩法。禁止锁定方向，禁止提示用户旋转屏幕。

- **撑满屏幕**：`ui/ScreenAdapter.ts` 在 `GameEntry.onLoad` 里按窗口真实比例换策略：比设计稿**瘦**
  （手机竖屏，比例 < 720/1280）走 `FIXED_WIDTH`（补高度），比设计稿**胖**（iPad 竖屏、横屏、宽扁窗口）
  走 `FIXED_HEIGHT`（补宽度）。横竖屏走的是**同一句**「补长边」，没有任何方向分支。
  两条都是**补长边** —— 画布撑满屏幕，设计稿内部一个像素不裁、比例不变，多出来的那条边是真实画布，
  四边拉满的层自己就铺过去了。转屏 / 改窗口尺寸走 `screen.on('window-resize')` 重算。
- **横屏两栏**（`ui/LandscapeLayout.ts`，挂在 Canvas 上）：拼图区与进度条等比放大到 `scale`
  （默认 1.4，约吃满屏幕高度）后**居中偏左**，碎片池竖过来当**右边那栏**；两栏整体在画布上居中。
  - **竖栏就是碎片池自己**：`Layout.type` HORIZONTAL→VERTICAL、间距换成 `spacingY`、四边 padding 对称、
    `ScrollView` 改成只上下滚、`view`（Mask 那层）与池层改成栏的尺寸。栏高 = 所有碎片高之和 + 间距 + 上下边距，
    **栏宽得自己量**（`Layout._doLayout` 的 VERTICAL 分支只写 `height`）。
  - ⚠️ **交叉轴必须压平，否则转屏后碎片连成一条斜线**：引擎的 `Layout` **只写主轴**，
    另一条轴走 `fnPositionY` / `fnPositionX`，而它们是 `this._isAlign ? Vec3.ZERO : child.position` ——
    不勾对齐就**原样沿用子节点上一次的坐标**。修法是在动 `layout.type` 的同一处把交叉轴压平：
    `onLoad` 写 `layout.alignHorizontal = true`、`toLandscape()` 里设成 VERTICAL 之后写 `layout.alignVertical = true`、
    `restorePortrait()` 里还原成 HORIZONTAL 之后写 `layout.alignHorizontal = true`。
    - 两个 setter **各带类型守卫**（类型不匹配就直接 return），而它们读写的是**同一个** `_isAlign` 字段 ——
      所以「在哪个方向就写哪一个」是唯一稳妥的写法。
    - ⚠️ **这个勾存不进场景**（setter 不是 `@property`，赋值不会让编辑器认为场景改过，`save-scene` 返回 `false`），
      所以它写在代码里，`verify-scene.js` 也查不了。**别去场景里勾那个「对齐」，勾了也会丢。**
  - **碎片池底图要转 90° 并等比放大**：`PoolBG` 是照横向条带画的，竖栏里不转就是一根横杠。
    `toLandscape()` 里按 `poolBgRotate`（默认 90）转过来，再按**覆盖式等比**放大：
    `k = max(栏宽 ÷ 底图高, 栏高 ÷ 底图宽) × poolBgScale`（**取 max 是「盖住、不拉伸」**，多出来的往两边伸）。
    - ⚠️ 伸出去的那截**别撞上拼图列**：改 `poolBgScale`、`railGap`、`scale`、碎片尺寸中任何一个都会动这条边距，
      `poolBgScale > 1` 时先心算一遍。`poolBgScale = 1` 是「刚好盖住」；填 0 或负数会把底图翻没。
  - **裁剪框（`view` 上的 RECT Mask）与 ScrollView 节点一起归零**，让 Mask 窗口和栏严丝合缝。
    ⚠️ **`sv.view` 是 `UITransform` 不是节点**（`ScrollView` 的 getter 取的是 `content.parent` 的 UITransform），
    位置要走 `sv.view.node` —— 直接 `sv.view.setPosition()` 会抛，`sv.view.position` 读到的是 `undefined`。
  - **碎片不跟着放大**：池里那个尺寸横竖屏同一个值，拿起来时才按 `carryScaleOf` 长到缺口那么大。
    间隔同理：`PiecePool.fitSpacing` 只在竖屏那一条（`Layout.type == HORIZONTAL`）算。
  - **玩法逻辑一行没碰**：缺口框 / 吸附半径 / 拿起倍率全按世界坐标现算，放大对吸附是透明的。
  - **安全区**：`maxRailHeight` 压到 880，竖栏居中后顶端最高 +440，正好不伸进右上角关闭按钮那个
    200×200（设计单位）安全区。
  - **转回竖屏原样还回去**：`onLoad` 存下竖屏的节点位置 / 缩放 / 尺寸 / 挂件开关 / Layout 参数，
    转回来逐项还原 + `scrollToLeft()`。来回转屏不会越转越偏。
  - 横屏这一套**只能写代码** —— Widget 没有「横竖屏两套配置」。它是「重排全交给 Widget」的**唯一例外**
    （`ScreenAdapter` 不算，它改的是画布策略、一个节点坐标都不碰）。
- **横屏另有一张底图**（`ui/BackgroundSwap.ts` 挂在 `BackgroundLayer` 上）：竖屏用 `背景图.jpg`、
  横屏换 `横屏背景.jpg`，转屏时换 `Bg_Sprite` 的 `spriteFrame`。竖屏那张不另配口 —— `onLoad` 读的就是
  `Bg_Sprite` 上挂着的那张，转回来原样还回去（**图只配一处**）。两个口：`bg` / `landscapeFrame`。
  - 铺满方式**不变**：靠 `Bg_Sprite` 自己的四边 Widget + `sizeMode = CUSTOM` + `type = SLICED`。
    ⚠️ 横屏那张的 `.meta` inset 现在是全 0 = 纯拉伸；觉得糊/变形就改它的 `.meta` insets → 重新导入。
- **画布变高之后，三处必须跟着改**（`tools/js/mount-adapt.js` 幂等接线）：
  1. `BackgroundLayer/Bg_Sprite` —— 补四边 Widget + `sizeMode = CUSTOM` + **`type = SLICED`**。
     九宫格四边各 160（写在 `背景图.jpg.meta` 的 `borderTop/Bottom/Left/Right`）。
     **inset 是可调项**：改 `.meta` → 重新导入 → 看 Game View。
     ⚠️ 当前 inset 是全 0（见现状速查「三处空壳」），等于没切。
  2. `GameLayer` / `PiecePoolLayer` / `UILayer/ProgressLayer` —— 三处**一条边都不贴**，尺寸钉死
     （580×748.559 / 720×300 / 460×90）。
  - ⚠️ 每拆掉一条对齐边，Widget 都会把节点放回**场景里存的 `contentSize`** 并把中心留住 ——
    尺寸必须显式再钉一次。
  - 三处的 `Widget` 组件**留着**，只是勾全空 —— 这是「故意不对齐」的记号，别当成没用的组件删掉或者重新勾上
    （勾回去就是长屏偏下）。`verify-scene.js` 的 `checkAdapt` 会拦住。
  - ⚠️ WidgetManager 的整树重排要等下一次 `AFTER_UPDATE`，编辑模式不一定跑得到，所以接线脚本末尾
    自上而下 `updateAlignment()` 刷一遍，否则存进场景的 `UITransform` 会停在中间态。
- 画布尺寸会随转屏 / 撑满而变，**世界坐标一律现读，不存快照**：`SnapSystem` 的吸附目标读的是
  `slot.worldCenter`（live getter），不是建关卡时快照的 `worldPos`。
- **重排全部交给 Widget，代码基本不参与**。`GameEntry` 照旧抛 `ORIENTATION_CHANGED`，横屏那一套由
  `LandscapeLayout` 听它来做，竖屏一律回落到 Widget 摆出来的位置。
- 想让某层横竖屏各一套尺寸，加 Widget 边已经不够了，得写代码。当前玩法内容三处
  （`GameLayer` / `PiecePoolLayer` / `ProgressLayer`）**一条边都不贴**、尺寸钉死、停在设计稿位置 ——
  横竖屏都靠这个「设计稿居中在画布上」的行为，**别给它们加对齐边**。
- 转屏时若碎片正在被拖动，取消拖动并弹回原位（复用 `PIECE_SNAP_FAIL` 流程）。
- ⚠️ **编辑器场景面板看不出撑满的效果**：编辑模式恒按 `getDesignResolutionSize()` 算，画布永远 720×1280。
  撑满只发生在运行时（Game View / 产物）。

### 7.2 安全区与 SDK 占用区

- AppLovin SDK **自动在右上角绘制关闭按钮（X）**，广告内**禁止自建任何关闭按钮**。
- 右上角预留不可交互安全区（建议 ≥ 120×120），进度条、CTA、引导文案均不得压在其上。
- 游戏中那个常驻下载按钮（`GameCta`）贴在**下沿**（横屏在左侧空位的中点），和这块安全区不冲突；
  它从开局就可见，所以必须响应触摸（§7.3 查的是「看不见却能点到」，反过来同样成立）。

### 7.3 适配与接口边界

- 所有全屏或贴边节点必须挂 **Widget**：背景与各 Layer 四边对齐；碎片池贴边、尺寸自适应；
  CTA 与进度按设计稿对齐。禁止硬编码坐标做适配。
- **UI 界面由项目负责人自建预制体**（引导文案、进度、EndCard、CTA 按钮、手指指引）。脚本方只负责：
  1. 用 `@property` 暴露对应预制体 / 节点的引用口；
  2. 抛出并监听 §5 的事件；
  3. 提供 `show()` / `hide()` 方法。
- **CTA 防误触**（AppLovin QA 明确检查项）：按钮未显示时必须完全不响应触摸，绝不允许"不可见却能点到"。
  - 同理**按钮的按下缩放必须作用在子节点上，不能缩按钮自己**：引擎的 `_handleTouchEnd` 拿**当前缩放后**
    的矩形做 hitTest，缩到 0.9 之后贴着边按下再松手会被判成 `TOUCH_CANCEL`，`CLICK` 就丢了。
    `verify-scene.js` 会拦「`target === node`」和「缩放目标上没有 Sprite」两种配错。

## 8. AppLovin / MRAID 接入规范

### 8.1 核心要求对照表

| # | AppLovin 要求 | 本项目落地方式 |
|---|---|---|
| 1 | 总文件大小 < 5MB | 见 §9 体积预算 |
| 2 | 支持 MRAID v2.0 | 用 SDK 注入的全局 `mraid`，**不引入 mraid.js**（引用或内联都不行） |
| 3 | 广告为单个内联 HTML | 构建后处理脚本合并，见 8.2 |
| 4 | 不引用任何外部托管文件 | 图片 / 音频 / 字体全部 base64 内联（Google 的 exitapi 是唯一例外，§8.6） |
| 5 | 横竖屏全屏双支持 | 见 §7.1 |
| 6 | 无用户交互时不得超时 | 靠空闲引导：玩家不操作时画面一直在演（手指拖副本）。⚠️ **当前 `guide` 开关是关的，这条没有兜底** —— 见现状速查风险 2 |
| 7 | CTA 用 `mraid.open()` 跳商店 | 见 8.3 |
| 8 | CTA 不得跳转其他链接 | 地址白名单，只允许商店 URL |
| 9 | 不自建关闭按钮 | 见 §7.2 |
| 10 | JS / DOM 操作必须在 mraid ready 之后 | 见 8.2 启动时序 |
| 11 | 音频不自动播放、关闭后静音 | 见 8.4 |
| 12 | WebGL 检测失败需周期性重试 | 见 8.2 |

### 8.2 启动时序与构建管线

- 定制 `build-templates/web-mobile/index.html`：**不要立即启动引擎**。先等 `mraid` ready
  （`mraid.addEventListener('ready', ...)`；`mraid` 不存在时降级为直接启动，便于浏览器调试），
  ready 后再加载 Cocos 构建产物。
- WebGL 能力检测失败时按固定间隔重试，不得直接白屏。
- 构建后处理：写独立的 **Node 脚本放在 `tools/`**（**绝不能放 `assets/`**，否则会被 Cocos 当资源导入），
  把 `build/web-mobile/` 的 `index.html` + 引擎 JS + `assets/**` + `src/**` + 所有 JSON/图片，合并为单个自包含 HTML。
- 该脚本需支持 **base64 内联所有二进制资源**，并把外链 CSS / JS 内联。

### 8.3 CTA 逻辑

```
if (isAndroid) mraid.open(ANDROID_STORE_URL);
else           mraid.open(IOS_STORE_URL);
```

- 平台判定从 `mraid.getDeviceInfo()` 取（取不到时回退 UA）。**两个方法都要先查 `typeof ... === 'function'`** ——
  实测有些容器只实现了 `open`，没有 `getDeviceInfo`，裸调会在点击回调里抛，`mraid.open` 一次都执行不到。
- 商店地址集中写在 `config/PlayableConfig.ts`（打包器的占位符闸门扫的是它，见 §8.5）。
- **只允许 `mraid.open()`**，禁止 `window.open` / `location.href`。
- 点击回调抛 `CTA_CLICK` 事件用于埋点。**跳转排在埋点前面** —— `EventBus.emit` 不兜异常，
  任何监听方抛一下后面那句就永远不执行。
- 游戏侧只剩一句：`MraidBridge.openStore()` 调打包期注入的 `window.__ccCta(url)`，返回 false
  （没注入 / 容器还没给 API）就退回 `mraid.open` 那条老路。**游戏代码里没有平台分支**，§8.6。

### 8.4 音频策略

- **禁止自动播放**：任何音效（含常驻的 BGM）必须在首次用户交互之后才允许播放。
  解锁走两条路：全局 `input.on(TOUCH_START)`（游戏区空白处）与 `PIECE_PICK`（碎片池上的触摸被
  `content` 认领，全局 input 收不到）—— **两条都要留**。
- 监听 `mraid.addEventListener('stateChange', ...)`，当 `mraid.getState() === 'hidden'` 时全局静音并停止所有音效；
  恢复时按需取消静音（只有常驻音会被恢复，被打断的一次性音效不补）。
- 点了 CTA 跳商店之后停掉全部音效，也不再起新的（`CTA_CLICK`）。
- 无音频资源或资源未就绪时 `AudioManager` 静默跳过，不报错、不阻塞流程。

细则（配置列表怎么填、常驻音怎么配、渐入渐出的坑）见 WORKLOG「音频」。

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
            └─ 写 build/playable.html → 验产物 → 体积门禁
```

- **产物**：`build/playable.html`（默认，可用 `--out` 改）。
- **手动跑**：`npm run pack`（完整打包）或 `npm run pack:report`（只看体积明细，不写文件）。
- **失败即中断构建**：`throwError = true`。体积超 5MB、或产物校验不过（闸门缺失、出现 mraid 外链、
  有外部托管引用）时构建直接失败 —— 不给「构建成功但交不出去」的假象。
- **MCP 起不了构建**：builder 包只注册了 `open` / `query-worker-ready` / `query-task`，没有触发构建的消息。
  构建必须由人在编辑器里点，没法脚本化。
- **内联原理**：不改引擎、不改构建配置、不改素材，构建产物原样保留，只在浏览器里拦五个入口喂字节 ——
  SystemJS 取模块源码 / XMLHttpRequest / `HTMLImageElement.src` / `HTMLScriptElement.src` / 裸 `fetch`。
  没命中的一律回落原生实现，所以同一份产物传服务器上也照常跑。
- **不要**把启动闸门写进 `build-templates/web-mobile/index.html`：打包器只保留产物自身的 DOM 骨架，
  写在模板里的启动逻辑会被丢弃。
- **商店链接占位符闸门**已实现：`pack-playable.mjs` 扫**构建目录里编译后的 JS/JSON**（不是扫打包后的 HTML ——
  产物已经 gzip + base85 编码，链接在 HTML 里根本找不到），命中 `XXXX` / `example` / `id000000+` 就报。
  `hooks.js` 把它分两档：`debug` 构建只警告，release 构建直接失败。开发期真要放行用 `--allow-placeholder`。
- 本地自测：产物双击即可打开，地址后加 `#debug` 打开启动日志。没有 mraid 时会走降级路径并在控制台说明。
- ⚠️ 改 `hooks.js` 要**重启编辑器或重载扩展**（扩展是启动时加载的，worker 里 `require` 有缓存）。
  ⚠️ `hooks.js` 里不能依赖 `Editor` 全局（跑在 builder 的 worker 进程里）。
  这两个坑的来龙去脉见 WORKLOG「构建钩子那三个坑」。

### 8.6 多平台（AppLovin / Moloco / Google）一键出三份

同一份源码、同一份构建产物，**打包期出三份产物**，游戏代码不分平台：

```
build/playable.html         AppLovin  单文件 HTML，CTA 走 mraid.open(url)
build/playable.moloco.html  Moloco    单文件 HTML，CTA 走 FbPlayableAd.onCTAClick()
build/playable.google.zip   Google    同一个 HTML 套个 zip 壳，CTA 走 ExitApi.exit()
```

三家的要求对照（只有三处真冲突，且全在外壳层）：

| | AppLovin | Moloco | Google（应用广告） |
|---|---|---|---|
| 交付格式 | 单文件内联 HTML | 单文件 HTML | **`.zip`** ≤5MB、≤512 文件、UTF-8 |
| CTA | `mraid.open(url)` | **`FbPlayableAd.onCTAClick()`（无参）** | **`ExitApi.exit()`** |
| 禁项 | `mraid.js`、外部托管引用 | **`XMLHttpRequest` 字面量**、`mraid.js`、外链、JS 跳转、`.zip` | 外链（Google 托管的库除外）、localStorage |
| 方向 | 横竖屏 | 横竖屏 | 横竖屏 + **`<meta name="ad.orientation">`** |

玩法层的三条（横竖屏全屏、音频首次交互后才响、endcard + 明确 CTA）三家一致，早已满足。

- **通道表在 `tools/lib/channels.mjs`**，一条一个通道：产物名 / 要不要 zip / CTA 明文 API /
  注入 `<head>` 的额外标记 / 外链白名单 / 禁项。加第四个平台只加一条，打包器一行不动。
- **CTA 走「打包期注入的适配器」，不是游戏代码里的平台分支**。`buildHtml` 往 `<head>` 里塞一段明文脚本：
  `window.__CC_CHANNEL='<id>'` + `window.__ccCta = function(){…}`。
- ⚠️ **适配器必须是明文，不能只活在游戏代码里**：Moloco 的素材检查是对 HTML 做**字符串匹配**，
  而游戏代码在 gzip + base85 的载荷里，它看不见。所以 `FbPlayableAd.onCTAClick()` / `ExitApi.exit()`
  这几个字必须原样出现在 `<head>`。
- **`openStore()` 在 Google / Moloco 上算出来的 url 是白算的** —— 两家的 CTA 都无参，
  跳哪个商店由平台按设备定。`PlayableConfig.ts` 那两条链接只在 AppLovin 那条路上有用；
  打包器的商店链接闸门仍然全局卡（它是「别带着 XXXX 交出去」的保险，与哪家无关）。
- **Google 的三件额外事**：① 同目录的 `index.html` 套进 `.zip`（`tools/lib/zip.mjs`，store 不压缩）；
  ② `<head>` 里加 `<meta name="ad.orientation" content="portrait,landscape">`；
  ③ 加 `<script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js">` ——
  **这是 Google 明确允许的唯一外链**，写在通道表的 `allowExternal` 白名单里，另外两家一份外链都不许有。
- **`verify()` 按通道分别校验**：CTA 明文 API 在不在、`__CC_CHANNEL` 对不对、外链有没有跑出白名单、
  Google 的 `ad.orientation` 在不在、各家的禁项有几处。哪家不过就是哪家失败。
- **CLI**：不给参数 = 三份都出；`--channel <id>` 只出一份；`--out <文件>` 隐含「只出 AppLovin 那一份」。
  `--report` 列出三份的体积。⚠️ **产物格式由通道定，不看后缀**（`--channel google --out x.html` 出来的仍是 zip）。

**⚠️ 两条未结的交付风险：**

1. **Moloco 的 `XMLHttpRequest` 字面量还没改造**，那份产物**先别上传**。功能上早就拦掉了
   （引擎的请求全被 `playable-runtime.js` 喂字节），要过的只是**字面量**：runtime 侧改成
   `window['XML'+'HttpRequest'] = Shim`，再对引擎 JS 做一遍同样的 token 改名。它现在挂在通道表的
   `softForbid` 上，**只计数告警、不拦构建**。
2. **Moloco / Google 都还没真机或官方校验器验过**：① Moloco 的检查究竟是不是纯字符串扫描（不是的话方案要重做）；
   ② 用 Google 的 H5 Validator 跑一遍 zip，顺便确认 WebP 那条（Google 列的受支持格式里没有 WebP，
   而管线默认 PNG→WebP —— 资源在 base85 块里理论上扫不到，但真跑一次比推断可靠；实在担心就 `--no-webp`）。

### 8.7 把整套链路发给别人（`dist/playable-pack.zip`）

- `tools/make-dist.mjs`（`npm run dist`）把**可分发的那部分**收进 `dist/playable-pack/`，同时压成
  `dist/playable-pack.zip`。发出去的是这个 zip，对方并到自己项目根目录即可。
- 内容 = `make-dist.mjs` 里那张 `SHIP` 表（`tools/pack-playable.mjs` + `tools/lib/*.mjs` + `tools/runtime/*.js`
  + `extensions/playable-builder/*`）**加上** `tools/dist-template/` 整个目录。路径两边对称，所以是合并不是改路径。
- **`tools/dist-template/` 是仅供分发的两件影子的源**：`README.md`（写给对方开发者看的，不是写给本项目的）
  与 `integration/StoreCta.ts`（游戏侧 CTA 桥，不 import 任何东西，两条链接走参数）。
  - 它和本仓库 [MraidBridge.ts](assets/scripts/platform/MraidBridge.ts) 的 `openStore()` 是同一段逻辑的
    **两份拷贝**，有意为之。**改了一边记得看另一边。**
- ⚠️ **文档里的商店链接示例用本项目的真实链接**，别编 `com.example.demo` 这种假值。
- ⚠️ **改完 `tools/` 或 `extensions/playable-builder/` 要重跑一次 `npm run dist`**，否则发出去的 zip 还是旧的。
  `tools/`、`extensions/` 都不参与任何构建/导入，加文件不会影响编辑器。

## 9. 引擎模块裁剪

**目的**：AppLovin 要求单 HTML < 5MB，且资源 base64 后体积膨胀约 33%。引擎体积是最大的可控项。

体积预算（目标）：引擎 ≤ 1.2MB、全部美术资源 ≤ 2.5MB（base64 编码前）、脚本 + 配置 + 其余 ≤ 0.5MB。

在 `设置 → 功能裁剪` 中关闭以下模块：

**必关**：`spine-3.8`、`spine-4.2`、`dragon-bones`、`tiled-map`、`video`、`webview`、`physics-2d`
（含 box2d 系列）、`profiler`、`geometry-renderer`、`terrain`、`light-probe`、`xr`、`intersection-2d`
（吸附用简单距离计算，不需要碰撞检测）。

**必留**：`mask` + `graphics` —— 场景里有两处硬依赖（`GameLayer` 的拼图区边界、`PiecePoolLayer/ScrollView/view`
的池裁剪），RECT 类型内部就建 `cc.Graphics`。两个都关掉就是整块拼图区不再裁剪，且 `Mask` 组件在运行期报错。

**按需**：
- `particle-2d` — 修复特效若用粒子则保留，若纯 tween + 序列帧则关闭。
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
- **优先 MCP**：编辑器内的场景搭建、节点创建、组件挂载、预制体操作全部走 `funplay_cocos` MCP。
- **零冗余代码**：不写解释性注释（除非逻辑非直观）、不写防御性判空、不写用不到的分支与兜底、
  不预留"以后可能用到"的接口。
- **不生成无关文件**，不擅自改动职责范围外的脚本。临时探针跑完就删（且收尾一律 `try / finally`）。
- 每次只实现一个模块并自检，不一次性铺开全部代码。
- **改完 `.ts` 要 `refresh_assets`**，否则预览跑的仍是旧包（预览 chunk 是启动时编的）。
- **改完场景要跑 `verify-scene.js`**（只读）。**`tools/js/build-scene.js` 是危险动作，别再跑了** ——
  它把 Canvas 下所有层 destroy 再重建，你手摆的整棵层级会一起没。
- 场景改完**别只看自动存盘那行**：`exec.mjs` 末尾那次存盘可能静默失败（返回 `⚠️ 场景没存上`），
  再调一次 `node tools/exec.mjs editor tools/js/save.js` 就成功。核对要读文件，不是读内存。

## 11. 实现顺序

以下顺序是**从零重建**时该走的（当前 39 个脚本 + 场景都已完成，这一节留作参考）：

0. **前置验证**：构建管线（§8.5），已用真实产物验证通过。
1. `core/`：EventBus、GameEvent、PoolManager
2. `data/LevelTypes.ts`：数据结构定型
3. `level/`：PieceSlot、RepairedSlot、LevelFactory
4. `gameplay/`：PieceFactory、PiecePool（Layout + 对象池）
5. `gameplay/`：DragController、SnapSystem
6. `gameplay/RepairSystem.ts`：单块修复 + 进度 + 总修复
7. `ui/` + `audio/`：对外接口与事件对接
8. `bootstrap/GameEntry.ts`：装配
9. `platform/`：MRAID / CTA / 埋点（§17）
10. 引擎模块裁剪与整体回归（§9）

## 12. 待确认假设

以下为设计推导，若与实际不符请指出：

1. 单块修复的表现定义为「该槽位 `brokenSprite` 隐藏、`repairedSprite` 显示」，遮挡层按 `overlayMode` 决定时机。
2. 碎片池为底部横向 ScrollView + 水平 Layout，碎片为 `PieceFactory` 从对象池取出后挂到 Layout 下。
3. 吸附半径优先级：槽位自身 `snapRadius`（px，非 0 时生效）> `snapRadiusRatio` × **缺口短边**
   （「修复前那张图」包围盒的短边，不是 `Slot_XX` 节点的短边）。两个都在 `PieceSlot` 上，见 §16。
4. 碎片池中不放干扰碎片，每块碎片有唯一正确缺口。

## 13. 主动建议与风险（需决策）

1. ~~构建管线验证~~ **已完成**：Cocos 3.8.8 的 web-mobile 产物是 **SystemJS + import-map**，
  模块名显式注册，所以内联可行。已用真实产物跑通，在 5MB 内 —— **但余量不宽裕，美术资源总量要卡住**。
2. **图片预算是硬约束**：5MB 减去引擎约 2.5–3MB，真正留给美术的只有 2MB 上下，且 base64 还要涨 33%。
   **美术定稿前先估一版资源体积**，超了再返工成本很高（降分辨率、改用 JPEG、拆关卡都来得及，但重画来不及）。
3. **碎片池顺序**：当前定为"不打乱"（按 `pieceId`）。碎片顺序与缺口一一对应时玩家无需思考，
   试玩时长会偏短。试玩广告通常要在 15–30 秒内制造"想继续玩"的缺口感 —— 可考虑保留 `shuffle` 开关。
4. **吸附半径建议取碎片短边的 20%–30%**：半径过大时手指掠过就吸附，玩家无法"拖着看看"；
   过小则手感发涩。现在是 `PieceSlot.snapRadiusRatio`，默认 0.25，Inspector 里直接调。
5. **对象池 + Layout 的排序坑**：从池中取出的碎片挂回 Layout 时必须 `setParent(content)` 且
   `setSiblingIndex(i)`；回收时不要 `destroy()`，用 `removeFromParent()` 保留实例。
6. ~~横屏布局需要额外的美术决策~~ **已决**：横竖屏共用同一套设计尺寸，重排全交给 Widget + `LandscapeLayout`，
   碎片图不旋转也不压缩。
7. **引擎裁剪放在最后执行**（已写入 §9），裁剪会削弱编辑器调试能力，开发期保留更省事。

## 14. 已实现的功能与踩坑索引

**本节的正文已移到 [docs/WORKLOG.md](docs/WORKLOG.md)**（原 §14「实现现状与偏差」共 1100 行，
是踩坑档案而不是规范）。那里按功能分节，含实测读数、被否掉的方案、以及每条末尾「还没验的部分」。

要在里面找东西，先看它的**索引**（文件开头），常见的入口：

| 想查 | 去 WORKLOG 找 |
|---|---|
| 某格的表现是怎么接的（揭晓 / 收尾动作 / 换节点） | 「场景现在的揭晓接线」「Slot_0N …」 |
| 拖动相关（亮边 / 拖尾 / 点击收不到） | 「点击碎片没反应」「拖动特效」 |
| 进度条 / 音频 / 空闲引导 | 同名小节 |
| 横竖屏 / 撑满 / 结束界面 / 常驻按钮 | 「竖屏撑满屏幕」「结束界面」「游戏中常驻的下载按钮」 |
| 贴纸揭角 / 贴平 | 「贴纸揭角」「揭角参数按格配」「修复贴纸贴平」 |
| 终局跳转、「点哪里都跳」 | 「终局跳转」「"点哪里都跳"是怎么做到的」 |

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
| `sweepOnRepair` | 单块吸附成功不再扫光 | `gameplay/RepairSweep.ts` |
| `sweepOnComplete` | 全部修完不再扫光 | `gameplay/RepairSweep.ts` |
| `guide` | 空闲引导整棵 `GuideRoot` 藏起来，也不注册任何监听（含全局 `input` 那条） | `ui/GuideController.ts` |
| `progress` | 进度层整层隐藏 | `ui/ProgressController.ts` |
| `audio` | 不注册任何音频监听（含首次触摸解锁那条全局 `input` 监听） | `audio/AudioManager.ts` |

**读侧与组件顺序无关**：消费方照旧写 `FeatureFlags.audio`（静态 getter），getter 每次现扫场景找那个面板实例。
这不是绕远路：同节点的组件 `onLoad` / `onEnable` 按数组顺序走，而 `AudioManager` 就挂在 Canvas 上、
在 `onEnable` 里读开关 —— 面板要是刚好排在它后面，开播时读到的就是默认值。

面板不在场时（编辑模式不跑生命周期；面板被误删）getter 退回 `DEFAULTS`（全开）—— 删掉面板不会让玩法残缺，
但会**静默忽略勾选**，这就是 `verify-scene.js` 里那条 `FeatureFlags` 存在性检查的意义。
挂载走 `tools/js/mount-flags.js`（幂等，已有就原样保留值，不会复位）。
**Scene 根节点挂不了组件**（引擎直接报错），所以别想着往那儿挪。

**落点规则**：gate 放在「会建节点 / 生成贴图 / 起 tween / 改 active」的那一句前面，
`onEnable` 与 `onDisable` 的对称性一律不动（`EventBus.off` 对没注册过的回调是安全的）。

- 整个组件只干这一件事（`TrailEmitter` / `AudioManager`）：`onLoad` / `onEnable` 首行 early return。
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

**能调的数全在 Inspector 里，代码里一个常量都不留**。可调参数一律挂在各自使用者的组件上，
带中文 `displayName`，Inspector 里改完存场景即生效。

> 标 **†** 的行是**当前场景里跑不到**的参数（组件在代码里，但场景没配实例，或总开关关着，
> 或那条路到不了）。改它们不会有任何画面变化 —— 原因见「现状速查」。

| Inspector 里的名字 | 字段 | 挂在 |
|---|---|---|
| 碎片最大边长 | `maxPieceSize` | `PieceFactory` @ `Canvas/PiecePoolLayer/ScrollView` |
| † 亮边参数（淡入 / 淡出 / 呼吸一次 / 光晕外扩比 / 光边宽度比） | `glowParams`（`GlowConfig`，折叠分组） | 同上 |
| 揭角材质（正面 / 背面） | `peelFrontEffect` / `peelBackEffect`（`EffectAsset`） | 同上。**材质是全局一对、不按格配** —— 池里的碎片节点是复用的，只在第一块建起来时挂一次 |
| † 揭角参数（全局）（掀哪个角 / 掀起的比例 / 掀起时长 / 回贴时长 / 背面底色 / 折线高光宽度比 / 折线高光强度） | `peelParams`（`PeelConfig`） | 同上。**各槽位没勾「本格单独配揭角」时用的就是这一份**；改了要重跑 `mount-sticker-apply.js` |
| 本格揭角参数（本格单独配揭角 + 同上一组七项） | `peelOverride` / `peelParams`（`PeelConfig`） | `PieceSlot` @ `Slot_01` …。⚠️ **覆盖是全有或全无** —— 勾上后用的是这一份自己的值，`new PeelConfig()` 的初值是**类默认值**不是全局那份；想从全局那组起步就跑 `tools/js/mount-slot-peel.js` |
| 贴纸贴平：正面 / 背面材质 / 翘哪个角 / 翘起的比例 / 贴平时长 / 背面底色 / 折线高光带宽度 / 折线高光强度 | `frontEffect` / `backEffect` / `corner` / `openRatio` / `applyTime` / `backColor` / `creaseWidth` / `creaseGlow` | `StickerApply` @ `EffectLayer`。**槽位勾了「本格单独配揭角」的话，这六个值参数不起作用**；6 个槽位**全勾了**，所以这六个现在没人用 |
| 贴纸收尾脉冲：材质 / 缩小比 / 最低不透明度 / 缩小+淡出时长 / 放大+淡入时长 / 高亮外扩比 / 高亮边宽比 | `pulseEffect` / `pulseShrinkScale` / `pulseMinOpacity` / `pulseDownTime` / `pulseUpTime` / `pulseMarginRatio` / `pulseRimRatio` | `StickerApply` @ `EffectLayer`。贴平推完接着演的那一下：修复图先缩一点、同时淡下去，再放大回原尺寸、把不透明度收回来。`pulseEffect` = `piece-glow.effect`（和拖动亮边同一份），管的是这一下**要不要亮边**；**留空 = 只缩放 + 淡出淡入** |
| † 发射步长 | `step` / `life` / `dotSize` / `maxPerFrame` | `TrailEmitter` @ `EffectLayer` |
| † 单块·总修复各三项 | `repairTime` … `completeFlash` | `RepairSweep` @ `EffectLayer` |
| † 序列帧 | `frames` / `frameInterval` / `sizeRatio` / `revealTime` | `RepairReveal` @ `EffectLayer` |
| † 圆形扩散：扩散时长 | `revealTime` / `feather` / `revealEffect` | `CircleReveal` @ `EffectLayer`（每格在 `PieceSlot.circleReveal` 上选） |
| 拿起放大时长 | `pickScaleTime` | `DragController` @ `GameLayer` |
| 弹回原位时长 | `returnTime` | `PiecePool` @ `PiecePoolLayer` |
| 自动补位 / 补位滑动时长 | `reflow` / `reflowTime` | 同上（`reflow` 关掉 = 一块碎片被用掉后**空位留在原地**、后面的碎片不动；开着才谈得上滑多久，所以关掉时 `reflowTime` 不起作用） |
| 每屏碎片数 / 换批淡入时长 | `batchSize` / `batchFadeTime` | 同上（一屏只摆这么多块，这一批用光才补下一批；`batchSize` 填 0 = 整关一次全摆出来） |
| 吸附半径 / 吸附半径比 | `snapRadius` / `snapRadiusRatio` | `PieceSlot` @ `Slot_01` |
| † 换节点延迟 | `swapDelay` / `swapFadeTime` | `PieceSlot`（当前没有槽位用得上） |
| 进度条填充缓动时长 | `fillTime` | `ProgressController` @ `UILayer` |
| 进度条外观（底色 / 透明度 / 尺寸） | 无 —— 就是 `进度条底` / `进度条` 两个节点上 `Sprite` 的 color / `UITransform` | 改完不用动代码 |
| 结束界面入场（背景淡入 / 下落时长 / 出发高度 / 按钮间隔 / 弹跳次数 / 首跳高度 / 衰减 / 首跳时长 / 压扁幅度 / 压扁时长） | `bgFadeTime` / `dropTime` / `dropMargin` / `stagger` / `bounces` / `bounceHeight` / `bounceDecay` / `bounceTime` / `squash` / `squashTime` | `CtaController` @ `CtaLayer` |
| 终局跳转（修好几个就跳商店 / 失败界面淡入时长） | `winCount` / `failFadeTime` | `EndgameCta` @ `UILayer/CtaLayer`（`winCount` 填 0 退回「全部修完出结束界面」那条老路；修满那一格**吸附成功当刻**就跳，失败路才等这一格演完再弹再跳） |
| 引导节奏 + 副本 / 手指外观（空闲延迟 / 循环间隔 / 点击提示 / 点击下沉 / 拖动时长 / 淡入淡出 / 副本透明度 / 手指偏移） | `idleDelay` / `loopGap` / `tapTime` / `tapDepth` / `moveTime` / `fadeTime` / `ghostOpacity` / `fingerOffset` | `GuideController` @ `UILayer` |
| † 完成背景扩散时长 | `revealTime` / `feather` | `SceneBgSwap` @ `GameLayer/Scene_BG` |
| † 待机动作：左右摆幅 / 上下摆幅 / 横向拉伸幅度 / 纵向拉伸幅度 / 一次循环时长 / 起始相位 | `swayX` / `swayY` / `stretchX` / `stretchY` / `period` / `phase` | `IdleMotion` @ `GameLayer/Scene_BG/马桶隐藏节点/气体大` 与 `/气体小` |
| † 通马桶：水位节点 / 挪到位的位置 / 旋转 / 时长 / 抽动次数 / 幅度 / 单次时长 / 脏水最终缩放 / 额外下沉 / 消失时长 | `water` / `moveTo` / `rotateTo` / `moveTime` / `bobCount` / `bobDepth` / `bobTime` / `waterShrink` / `waterDrop` / `fadeTime` | `FlushAction` @ `Slot_02`。**排水时长不是参数** —— 水每抽一下缩一档，总时长 = `bobCount × bobTime × 2` |
| † 扫地：物品父节点 / 中点微调 / 挪动时长 / 摆动角度 / 来回次数 / 单程时长 / 摆动时右移距离 / 物品渐隐间隔 / 物品渐隐时长 | `items` / `offset` / `moveTime` / `sweepAngle` / `sweepCycles` / `sweepTime` / `sweepMoveX` / `gap` / `fadeTime` | `BroomSweep` @ `Slot_03` |
| † 喷瓶：两张贴图 / 气体节点 / 摇晃次数 / 摇晃角度 / 单程时长 / 起始高度 / 下落时长 / 气体渐隐时长 / 气体先后间隔 / 喷雾图缩放 / 喷雾图偏移 | `noMistFrame` / `mistFrame` / `gases` / `shakeCount` / `shakeAngle` / `shakeTime` / `mistRise` / `mistDropTime` / `gasFadeTime` / `gasStagger` / `mistScale` / `mistOffset` | `SprayAction` @ `Slot_05`。两个图口与另外七个调参由 `mount-spray-action.js` 写；`mistScale` / `mistOffset` 是**对齐两个瓶子用的量**，换美术得重新量 |
| † 地上脏水：失败后延迟 / 渐显时长 | `delay` / `revealTime` | `GroundWater` @ `Scene_BG/地上脏水`。**方向不在这儿**，是节点 Sprite 上的 FILLED/VERTICAL/`fillStart = 1` |
| 音频配置列表（激活事件 / 音效 / 音量 / 渐入 / 渐出 / 结束事件）+ 总音量 | `cues` / `volume` | `AudioManager` @ `Canvas` |
| 横屏放大倍率 / 拼图区与进度条间距 / 两栏间距 / 竖栏最大高度 | `scale` / `columnGap` / `railGap` / `maxRailHeight` | `LandscapeLayout` @ `Canvas`（§7.1） |
| 横屏底图旋转（度）/ 缩放系数 | `poolBgRotate` / `poolBgScale` | 同上（`poolBgScale = 1` 即等比盖住竖栏） |
| 常驻按钮：呼吸放大比 / 呼吸单程时长 | `breathScale` / `breathTime` | `GameCta` @ `Canvas/GameCta`。**位置不在这儿**（竖屏是同一节点上的 Widget，横屏是 `LandscapeLayout.cta` 口）。**外观也不在这儿**：底色 / 文案 / 字号都在 `Bg` / `Text` 上 |

三条踩过的坑：

- **碎片池的间距不在上表里**：落点就是 `content` 上那个 `Layout` 自己的 `spacingX` 与四边 padding。
  ⚠️ `spacingX` **由 `PiecePool.fitSpacing` 在建池子那一下按可视宽度现算并写回**，在 Inspector 里改会被覆盖 ——
  **只有四边 padding 是你可以改的**。`spacingY` 是横屏竖栏用的，由 `LandscapeLayout` 转屏时现读 `spacingX` 填。
- **亮边的 5 个参数挂在 `PieceFactory` 上，不在 `PieceGlow` 上**：碎片是运行时建的节点，场景里没有实例。
  `GlowConfig` 是个 `@ccclass` 数据类，Inspector 里显示成可折叠分组。
- **新增 `@property` 后编辑器要刷一次资源库**（MCP `refresh_assets`）才会出现在已有组件实例的 Inspector 上：
  新字段进来了，但场景里那些老实例的属性表还是旧的。**改完 `.ts` 不刷，编辑器内存里跑的还是旧类**。

⚠️ **`tools/js/build-scene.js` 现在是危险动作，别再跑了**：它把 Canvas 下所有层 `removeFromParent` + `destroy`
再重建 —— 换来的不只是上表这些值被复位，而是你手摆的整棵层级一起没了。日常改动走 `tools/js/verify-scene.js`（只读）就够了。

## 17. 埋点（Playable Analytics）

AppLovin 要求沉浸式试玩上报内部关键节点，用来做投放优化。**已接入**：
[assets/scripts/platform/PlayableAnalytics.ts](assets/scripts/platform/PlayableAnalytics.ts)
（挂在 `Canvas` 上，**只听 EventBus，发射方一行没改**）+ 接线脚本 `tools/js/mount-analytics.js`。

- 上报函数是 `window.ALPlayableAnalytics.trackEvent('<事件名>')`，**由投放容器注入**。所有调用都包了
  官方的 `typeof` 守卫，本地浏览器 / 编辑器 / Moloco / Google 产物里静默 no-op。
- **只用官方预定义事件名**，自定义事件不会被追踪。
- 映射：`LEVEL_BUILT → DISPLAYED`、`PIECE_PICK → CHALLENGE_STARTED`、
  `REPAIR_PROGRESS → CHALLENGE_PASS_25/50/75`、`GAME_OVER → CHALLENGE_SOLVED`、
  `REPAIR_FAILED → CHALLENGE_FAILED`、`CTA_SHOW → ENDCARD_SHOWN`、`CTA_CLICK → CTA_CLICKED`。
- **里程碑的分母是终局线 `EndgameCta.winCount`**（不是槽位总数）—— 否则玩家修到第 4 格就被跳走，
  后两档和 `SOLVED` 永远不出现。
- **不接** `LOADING` / `LOADED`（没有 loading 屏）、`CHALLENGE_RETRY`（没有重试概念）。
- **不给开关**：埋点是平台要求，不是可选表现（§15「合规项不进开关表」）。

完整说明（每个上报点的行号、报表含义、基准算法、自测方法、变更指引）见
**[docs/ANALYTICS.md](docs/ANALYTICS.md)**。该文档 **§1–§6 是可移植的接入规范**
（官方事件全表、零依赖参考实现、通用映射规则、落地检查清单），**给别的项目接入时直接发这一份**；
§7 是本项目的接线实例，只作对照。
