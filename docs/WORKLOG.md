# 实现现状与偏差（工作日志）

> **这不是规范。** 规范是 [../CLAUDE.md](../CLAUDE.md) —— 开工前读那一份，本文件按需查。
>
> 这里放的是**历史**：某个功能当初为什么这么做、踩过哪些坑、实测读数是多少、哪个时间点做了哪个决定。
> 看到「§N」指的是 **CLAUDE.md 的对应小节**（§0–§13 / §15 / §16 都在那边）。
>
> ⚠️ **要「现在的状态」别读这里，读 CLAUDE.md 的「现状速查」**（那里是 2026-10-14 现读场景核实过的）。
> 这份日志横跨好几轮换美术，**大部分小节描述的是当时那批槽位与节点**（毛衣 / 胶带 / 喷瓶 / 稻草人 /
> 气体 / 脏水 …），那些节点现在**已经不在场景里了**。文里的读数、`@property` 名、接线脚本清单
> 大多是**当时**的真相 —— 想照着做之前先用现状速查核一遍。
>
> **什么时候来查这里**：
>
> - 「这处为什么写得这么绕？」—— 多半是踩过坑，索引里按功能名找；
> - 「这个功能现在什么状态、验过没有？」—— 每条末尾的 ⚠️ 写的都是「还没验的部分」；
> - 「我要动 X，会不会碰到别的东西？」—— 找对应小节，末尾通常有一句「改这个会影响什么」；
> - 「之前是不是试过别的方案？」—— 找「撤掉 / 已删 / 换成」这些词。
>
> 最后一条：**本文件里的场景读数、行号、端口都可能过时**（换美术、改关卡、重启编辑器都会变）。
> 要按它做事之前，先用 `tools/js/verify-scene.js` 或 `tools/exec.mjs` 现读一遍。

## 索引

- 目录与层级的偏差
- 构建 / 打包
- 场景重建
- 点击碎片没反应：不是「高层级挡住低层级」，是引擎的派发链断在中间
- 拖动特效（白边发光 + 拖尾）
- 修复后的斜向扫光
- 两层背景 + 缺口框以「修复前那张图」为准（2026-10-08 定案）
- 无交互保活已整体删除（2026-10-08）
- 稻草人的序列帧循环（2026-10-08）
- 进度条（2026-10-08 立，2026-10-10 改成不用图）
- 毛衣槽位：修好之后藏掉坏人、放出好人（2026-10-08，2026-10-09 改成换节点）
- Slot_04（胶带那格）：既没有破损图，拿在手上的也不是修复后的图（2026-10-09）
- 扫光改挂「修复图露面」，不挂「吸附成功」（2026-10-09）
- 碎片池进场停在最左（2026-10-09）
- 碎片按素材实际大小 + 一屏最多 4 块（2026-10-10）
- 碎片池分批：一屏 3 个，用完一批补下一批（2026-10-12）
- 拿起倍率改跟 `Repaired` 走（2026-10-10）
- 修复揭晓：序列帧 + 从小到大放大（2026-10-09）
- 全部修完：完成背景从中心圆形羽化扩散（2026-10-09）
- 碎片补位动画：往前滑 + 撞一下弹回（2026-10-09）
- 空闲引导：手指拖着半透明副本走一遍（2026-10-09）
- 音频：配置列表 + 常驻音（2026-10-09）
- 竖屏撑满屏幕（2026-10-09）
- 结束界面（2026-10-09）
- 游戏中常驻的下载按钮（2026-10-09 立，2026-10-10 改成不用图）
- CTA 点了不跳：容器给的 mraid 没有 `getDeviceInfo`（2026-10-09）
- 圆形扩散揭晓：把「结束背景」那套换图手法搬到每个物品上（2026-10-09）
- Slot_04 的两种状态：达标看前置槽位，不达标就跳商店（2026-10-10）
- 地上脏水：默认隐藏，修错时从上到下刷出来（2026-10-10）
- 气体待机 / 通马桶 / 扫地 / 喷瓶（2026-10-10）
- 待机：气体飘（`IdleMotion`）
- Slot_02 通马桶（`FlushAction`）
- 脏水是「等比缩小 + 底边固定」，不是「只压 y + 整体下沉」（2026-10-10 按反馈改）
- 一次抽动排一档，不是一口气缩完（2026-10-10 按反馈改）
- Slot_03 扫地（`BroomSweep`）
- 为什么动作接在 `PIECE_SHOWN` 之前（这次的关键决定）
- 为什么清掉了 `Slot_02` / `Slot_03` 的 `swapHide`（就是「配了隐藏节点但没生效」的根因）
- 场景现在的揭晓接线（2026-10-12 实测，与下面几节的老描述不一致）
- 接线与校验
- Slot_05 喷瓶：摇晃 → 换喷雾 → 落下 + 气体从上到下渐隐 → 收起（2026-10-10，同日按反馈改过一次）
- 动画期间空闲引导的计时器停住（2026-10-10）
- 终局跳转：修满 3 个 / 修错 → 跳商店，之后点哪都跳（2026-10-10）
- 「点哪里都跳」是怎么做到的（关键机制，别再想别的辙）
- 贴纸揭角：拿起碎片时一角折起来露出背面（2026-10-12，原型）
- 揭角参数按格配（2026-10-12）
- 修复贴纸贴平：修好时那一角是翘着的，再按平贴到缺口上（2026-10-12）
- 拼图框跟着底图比例走 + 四边对齐 Widget 在父节点改尺寸后会「自己长」（2026-10-14）
- 音频：音阶序列 + 带间隔的常驻循环 + 胜利风铃（2026-10-14）
- 按钮按压音效：为什么听 `TOUCH_START` 而不是 `CTA_CLICK`（2026-10-14）
- `AudioChannels` 被存进场景：`destroy()` 在编辑器里不落地（2026-10-14）
- 碎片池改成固定间距：删掉按可视宽度现算那次（2026-10-14）
- 「贴纸贴平 + 圆形扩散」为什么只能二选一（2026-10-12）
- 贴纸贴平的收尾脉冲：缩小淡出 → 放大淡入（2026-10-12）
- 单块揭晓改成「画笔涂色」：斜着来回刷，刷过的地方才显示修复图（2026-10-14）
- ⏳ 交审前必须确认（两条，都是明确要求的副作用）
- 待你确认

---


## 正文：原 CLAUDE.md §14（逐字平移，未删改）

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

**进度条（2026-10-08 立，2026-10-10 改成不用图）**

`UILayer/ProgressLayer` 下两个节点：`进度条底`（半透明细长条，sibling 0）和 `进度条`（白色填充，sibling 1）。**填充必须排在底后面**，否则被底整个盖住。接线脚本 `tools/js/mount-progress-bar.js`（幂等，老的两张图节点会先退掉）。

```
UILayer/ProgressLayer            460×90，四边不贴（见 §7.1）
├── 进度条底   Sprite：纯白.png（4×4 纯白），SIMPLE + CUSTOM，460×16，颜色 (255,255,255,70)
└── 进度条     Sprite：同一张图，FILLED / HORIZONTAL + CUSTOM，460×16，颜色 (255,255,255,255)
```

- **不用美术图了**（原来是「进度条框.png」500×55 药丸框 + 「进度条.png」493×48 药丸填充）：两张新图都出在 `assets/recourses/UI及背景/纯白.png`（4×4 纯白，72 字节）。改颜色 / 透明度 / 尺寸全在 Inspector 里（底是 `Sprite.color` 的 a、填充是 `Sprite.color`），**`ProgressController` 一行没动** —— 它照旧只推 `fillRange`，现在推的是这张白图。
- 两个节点的局部 y 都还是 **12.141**（老进度条的中心），所以屏幕上和原来落在同一处；尺寸从 500×55 / 493×48 变成 460×16（宽 = `ProgressLayer` 宽，高 16 就是「细长条」）。
- ⚠️ `纯白.png` 的 `.meta` 里把 **`packable` 设成 false**：web 端动态图集默认开着（`maxFrameSize = 512`，见 §14 上面那条），FILLED 裁边时线性采样会吃到图集里紧挨着的邻居像素，填充右端会冒一条杂色。4×4 的图也一样会被打进图集。（SLICED 的 `圆角白.png` 同理，见下面「游戏中常驻的下载按钮」。）
- `进度条` 是 **Sprite `FILLED` + `fillType HORIZONTAL`**，`fillStart 0` / `fillEnd 1` / `fillRange` 走 0→1。已核对引擎源码（`2d/assembler/sprite/bar-filled.ts` 的 `updateUVs` + `updateVertexData`）：FILLED **同时缩短 quad 和夹取 UV**，是真裁剪不是拉伸。`fillRange = 0` 时 quad 退化到零宽，什么都不画（底那条半透明的还看得见，正好当空槽）。
- `assets/recourses/进度条/`（两张老图）**已经没有引用了**，留着没删 —— 要清就整个目录连 `.meta` 一起删，`mount-progress-bar.js` 里没有它们的 uuid。
- `ProgressController.onProgress(done, total)` 里 `fill.fillRange` 目标 = `done / total`，tween 用 `quadOut` 缓动，时长是 Inspector 上的 `fillTime`（默认 0.4s）。**换了块数不用改代码**：三块就每块 33%，四块就 25%。
- **判断该不该重新起 tween 不看目标值**：`fillTo()` 一律先 `stop()` 掉在飞的那条再从当前位置起步，所以连点几块不会跳变，只会顺滑接上。`onDisable` 里也停。
- ⚠️ **场景面板里进度条永远是空的**：编辑器编辑模式不跑 `onEnable`，`fillRange` 停在场景里存的值（0）。已实测 —— 直接在编辑场景里调 `ctrl.fillTo(0.25)` 后 `fillRange` 一路保持 0.000，因为编辑模式的 director 不 tick `TweenSystem`。**要看填充只能在预览（Game View）里看。**
- ⚠️ `label` 现在是 null：`ProgressLayer` 下没有进度文字节点（`verify-scene.js` 会一直报 `missing: ProgressController@UILayer`）。要显示 `1/3` 这种文字就自己加个 Label 拖进 `label` 口，脚本这边不用改。

**毛衣槽位：修好之后藏掉坏人、放出好人（2026-10-08，2026-10-09 改成换节点）**

> ⚠️ **本节记录的是历史状态，已被 §14「气体待机 / 通马桶 / 扫地」取代**：场景重做之后 `Slot_03` 不再是毛衣，
> 它的 `swapHide` / `swapShow` 都已清空（`swapHide = null` / `swapShow = null`，见 `mount-slot-actions.js`），
> 收尾表现换成了 `BroomSweep` 扫地。`swapHide` / `swapShow` 这套机制本身还在代码里、没坏，
> 谁再配「两个口都填」就还会生效 —— 只是当前场景没有任何一格用它。
> 下面这些实测与取舍（交叉淡入淡出、`UIOpacity` 必须挂、兄弟序）对外来复用这套机制的槽位仍然成立。

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
  - ⚠️ 这一整节的数字是上一版美术（4 块、等高 150、间距固定 24）留下的记录。**现在碎片按素材原始像素显示，间隔是手配的定值**（2026-10-14 删掉了按可视宽度现算那套，见文末「碎片池改成固定间距」），一屏最多 4 块 —— 见下面「碎片按素材实际大小 + 一屏最多 4 块」。

**碎片按素材实际大小 + 一屏最多 4 块（2026-10-10）**

两条需求：① 池里的碎片和**实际大小**相同，超过限制值的等比缩到限制值；② 控制间隔，保证池里**最多显示 4 个**碎片。

- **`PieceFactory.pieceHeight`（固定高度）已删**，换成 `maxPieceSize`（最长边上限，默认 **200**）。池里按 `frame.rect` 的**素材原始像素**显示（原来是「高度钉死 150、宽度按比例算」，小图被放大约 3 倍、糊而且比例失真），宽或高超过上限的按 `k = maxPieceSize / max(w, h)` **等比**缩到它 —— 尺寸完全由图片自己决定，`Sprite.sizeMode` 仍是 CUSTOM，宽高比不会被拉变形。
  - 当前 demo 三块（`pieceFrame` 取 `repairedSprite`）：水管 `水管.png` 55×44 → 原样；马桶搋子 107×160 → 原样；扫把 147×243 → ×0.823 = 121×200。
  - 池里碎片**不再等高**。`Layout` 的 HORIZONTAL 那一路用 `alignHorizontal`（见 §7.1）把交叉轴压平，所以三块各自按 y=0 居中排成一行，矮的那块不贴底也不贴顶。
  - `carryScaleOf` 当时一个字没改（**2026-10-10 改成跟 `Repaired` 走了**，见下面「拿起倍率改跟 `Repaired` 走」）：那会儿拿起放大倍率是「缺口世界高 ÷ 碎片世界高」，1:1 之后水管是 40.97/44 = **0.931**（拿起来略缩）、扫把是 226.6/200 = **1.13**（略放大）。
- **`PiecePool.fitSpacing()`**：建完碎片按可视宽度**现算** `content` 上那个 `Layout` 的 `spacingX`：`(可视宽 − 左右 padding − 碎片宽之和) / 间隔数`。
  - 可视宽取 `scrollView.view.width` —— 就是挂 RECT `Mask` 的那层（`content.parent`，⚠️ `sv.view` 是 **UITransform 不是节点**）。
  - **一屏最多 4 块**：不足 4 块按实际块数铺满（所以 3 块就是 3 块把整条池子铺满）；超过 4 块时按「最宽的 4 块」算，保证一屏只装得下 4 块、第 5 块起要滚才看得到。
  - 实数（`view` 583.893、padding 24+24）：三块 55+107+121 = 283 → `spacingX = (535.893 − 283) / 2 = 126.45`，行宽正好 583.893 = 可视宽。行宽**不**比视区宽，引擎自己左对齐，`scrollToStart()` 那句现在只是起手保险。
  - ⚠️ **`spacingX` 从此由代码写**，Inspector 里改的值会在建池子那一下被覆盖（§16 里「池内碎片间距不在调参表里」那条以这里为准）。四边 padding 仍归 Inspector。
  - ⚠️ **只在竖屏那一条（`layout.type == HORIZONTAL`）算**：横屏时 `sv.view` 已经被 `LandscapeLayout` 换成竖栏尺寸，量出来的「可视宽」是栏宽（会把间隔算成 0）。开局就横屏时 `LEVEL_BUILT` 正好落在竖栏里，所以 `PiecePool` 另外听 `ORIENTATION_CHANGED`，**回到竖屏延后一拍**（`scheduleOnce(..., 0)`）补算一次 —— `LandscapeLayout` 把 `view` 尺寸还回去也在同一条事件里，两边谁先注册不一定，延后一拍才稳。
- **`LandscapeLayout` 跟着改了三行**：`spacingX` 不再进 `onLoad` 快照（那是场景里的旧值 24，早被 `fitSpacing` 覆盖了），竖栏的 `spacingY` 在 `toLandscape()` 里**现读** `layout.spacingX`；`restorePortrait()` 不再写 `spacingX`（横屏期间没人碰它，转回来天然是对的）。不这么改的话转一次屏间隔就退回 24；先按快照写 0 再算的话，反过来会被横屏那次的 0 覆盖成「三块贴在一起」。
- 已做：`tsc --noEmit` 零报错；上面的数按场景实际值推演过。
- ⚠️ **还没在预览里看过**（MCP 的 `run_project_preview` 起不了、编辑器当时没开）：要看的是「三块按实际大小排开、间隔均匀铺满池子」，以及拖起来时尺寸不掉链子。改完脚本记得 `refresh_assets` + 重开 Game View。
- ⚠️ `fitSpacing` 里那个「一屏最多 4 块」的硬编码**当时只是兜底**：真正决定一屏摆几块的是 `PiecePool.batchSize`（默认 3，见下面「碎片池分批」）。两处冲突时（比如把 `batchSize` 调到 5）以「4 块」为准 —— 第 5 块要滚才看得到。
- ⚠️ **2026-10-14：`fitSpacing` 整套已删**，间距改回手配的定值（`content` 的 Layout 上那个 `spacingX`，场景里定 40）。上面这些「按可视宽度现算」「只在竖屏那一条算」「`ORIENTATION_CHANGED` 补算一次」的记录都只说明当时的做法 —— 现状见文末「碎片池改成固定间距」。

**碎片池分批：一屏 3 个，用完一批补下一批（2026-10-12）**

`PiecePool` 从「建关卡时把关卡里所有碎片一次全摆出来」改成**一批一批摆**：一屏只放 `batchSize`（默认 **3**）块，
**这一批全部被吸附用掉之后**才把下一批摆上来，以此类推。需求原话是「每次只显示三个碎片，三个全部用完后再替换下三个」。

- 新 `@property` **`batchSize`**（每屏碎片数，默认 3）+ **`batchFadeTime`**（换批淡入时长，默认 0.25s）。
  `batchSize` 填 **0 = 整关一次全摆出来**（老行为，一行代码都没删）。
- 状态多了一个 **`_next`**（`_data` 里下一块该摆的碎片下标）。`onLevelBuilt` 只摆第一屏；
  `consume()` 末尾发现 **`_entries` 空了且 `_next` 还没到头**就 `buildBatch(true)` 补下一屏。
  末尾那屏不满 `batchSize` 就摆多少算多少。
- **`POOL_BUILT` 在换批时重抛一次**：横屏竖栏的宽度是照池子内容量出来的（`LandscapeLayout.onPoolBuilt`），
  换一批就可能换了最宽的那块，不重抛的话栏按上一批最宽那块算，新一批的碎片会被 `view` 上的 RECT Mask 裁掉。
  载荷仍是 `_entries` **那个数组本身**（原地 splice + push），所以 `GuideController` / `LandscapeLayout`
  手里那份引用一直有效，不用重新订阅。
- **换批是淡入，不是硬切**：`PieceFactory` 给每块碎片节点加了一个 `UIOpacity`（`create()` 里把透明度重置回 255），
  `buildBatch(true)` 把新的几块从 0 淡到 255。开场那一屏走 `buildBatch(false)`，不该淡入。
  用透明度而不是缩放，是因为 `carryScaleOf` / `GuideController.play` 都**现读 `piece.worldScale`** ——
  拿缩放做入场动画的话，动画没跑完就被拿起来会算错放大倍率。
- **引导跟着走**：`GuideController` 教的是 `_entries[0]`（池里当前最前面那块），换批之后它自动指到新一批的第一块，
  不用改一行。
- ⚠️ **当前关卡只有 3 个槽位**（`BrokenLayer` 下就是 `Slot_01` / `Slot_02` / `Slot_03`），
  `batchSize = 3` 下**看不出任何变化** —— 这条要等关卡槽位多于 3 个才会显形。加槽位走编辑器（MCP），
  代码这侧不用再动。
- 已做：`tsc --noEmit` 零报错；`refresh_assets` 已跑，`PiecePool` 的 Inspector 上 `batchSize = 3` / `batchFadeTime = 0.25` 都到位了。
- **已实测**（编辑场景里手动 `factory.onLoad()` 注册对象池 → 拿 `LevelFactory.build()` 的真数据**拼成 6 格**（同一批槽位用两遍）喂给 `pool.onLevelBuilt()`，逐块 `consume()`，跑完 `clear()` + 还原 `_data` / `_next`、停掉全部 tween，`--no-save`）：
  - 建池：**3 块，`next=3`**；
  - 第 1 块用掉 → 2 块，第 2 块 → 1 块，**第 3 块用掉 → 又变回 3 块、`next=6`**（补批生效）；
  - 第 4 / 5 块 → 2 / 1 块，第 6 块 → **0 块、`next=6`**（后面没碎片了，不再补）；
  - 每块碎片身上都取到了 `UIOpacity`；收尾 `content.children` 干净，还原后 `entries 0 / next 0`。
- ⚠️ **没在 Game View 里看过** —— 要眼过一遍的是「一批用光之后下一批淡入的节奏」（`batchFadeTime`），
  以及横屏下换批时竖栏宽度有没有跟着变（`toLandscape()` 是幂等的，重抛 `POOL_BUILT` 会重排一次）。
- ⚠️ **和终局跳转撞车（关卡槽位多于 3 个才会碰到）**：`EndgameCta.winCount` 现在是 **3**，
  也就是「修好 3 格就跳商店」。分批之后第一批正好是 3 块 —— 第 3 块一吸上就同时触发「补下一批」和「跳商店」，
  玩家根本看不到第二批。要么把 `winCount` 调大，要么把 `batchSize` 调小（比如 2 块一批），
  别让「一批用完」正好落在跳转点上。

**拿起倍率改跟 `Repaired` 走（2026-10-10）**

拿在手上的碎片放大到多大，原来是「**缺口世界高** ÷ 碎片世界高」（缺口 = `Broken` 那张图的框）。现在改成
「**修复图世界高** ÷ 碎片世界高」—— `PieceSlot` 新增 getter **`carryHeight`**，`PiecePool.carryScaleOf`
与 `GuideController` 的副本放大都读它。

- **为什么**：池里那块碎片本来就是修复后的图（`pieceFrame` 优先 `poolSprite` > `repairedSprite` >
  `repairedView.frame`），可拿起来的尺寸却按修复前那张算。两张图尺寸对不上的槽位，一拿起来就当着玩家的面
  缩一下，吸附之后又跳回原尺寸 —— `Slot_06`（白线 55×44 / 实物 52×73）会缩到 **60%**。
- **只动拿起倍率，别的都没动**：`PieceSlot.width/height/radius/worldCenter`（吸附框、吸附半径、吸附落点）
  仍然全部来自 `Broken`。缺口框是「洞」，洞还是那个洞。
- demo 六格的实测（`brokenH` → `carryHeight`）：Slot_01 `40.96 → 40.96`、Slot_02 `148.96 → 148.96`
  （两张图同尺寸，**完全不变**）、Slot_03 `226.63 → 226.23`、Slot_04 `448.74 → 452.47`、Slot_05
  `176.89 → 178.75`（都在 1% 上下）、**Slot_06 `40.96 → 67.96`（×1.66）**。也就是说这条改动实际上只
  救了 Slot_06，其余五格观感无变化。
- 实现上把 `PieceSlot.box()` 里那段手算矩形抽成了 `worldBoxOf(view)`，`box()` 与 `carryHeight` 共用
  一份（仍然是手算，**不用** `getBoundingBoxToWorld()`，理由见 §14 那条）。
- ⚠️ **`Slot_06` 的 `Broken` 图多半是配错了**：`卷纸 白线` 的框是 **55×44**，与 `Slot_01` 的
  `水管 白线` 一模一样，而 `Repaired` 的 `卷纸` 是 **52×73**（竖着的一张纸）。修好之后吸附框（来自
  `Broken`）的中心在 **(178.13, 968.58)**、修复图的中心在 **(177.02, 966.03)**，差 **2.8px** —— 能用，
  但吸附半径也按那个 40.96 的短边算（10.24，按修复图该是 12.10）。**要让框和半径也跟上，得让美术把
  `卷纸 白线` 换成和实物同比例、同尺寸的白线图**，代码这侧不用再改（`box()` 读的就是那张图自己的框）。

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
- **2026-10-12 加了个开关 `PiecePool.reflow`（「自动补位」，§16）**：关掉就**不补位了** —— 一块碎片被用掉，那个位置就空在那儿，后面的碎片待在原地不动。
  - 做法是**把顶位节点（`Spacer`）留在原地**，不是「把补位时长调成 0」。`Spacer` 本来就是 `takeOut()` 造出来顶住空位、`consume()` 里销毁的那个节点；这一下不销毁它就完了 —— Layout 眼里子节点一个没少，`updateLayout` 排不出任何变化，碎片自然一动不动。调时长那种写法位置照样会重排，只是瞬移，而且 `takeOut()` / `consume()` 里那两句 `Tween.stopAllByTarget` 还得再想一层。
  - 留着的 `Spacer` 要记账，不然换关时它会变成 `content` 里的孤儿、下一关的排布整个右移：新增 `_gaps: PieceEntry[]`（存 entry 而不是 `Node`，这样 `clear()` 能直接复用 `dropSpacer`，不用把「摘节点 + destroy」那两行抄第二遍）。
  - **`_gaps` 在「这一屏用光、补下一屏」那一下要清掉**：不清的话新一屏会排在旧空位右边，`content` 宽出去一大截，玩家得往右滚才找得到碎片。清掉之后新一屏照常从最左开始摆（实测最左那块 x = 177.28）。
  - 跟 `reflowTime` 的关系：`reflow` 关掉时根本没有补位这回事，`reflowTime` 不起作用。
  - 实测（探针从场景里取 6 个 `PieceSlot` 现造 `SlotData` 喂 `pool.onLevelBuilt`，不走 `LevelFactory.build()` —— 那会连带抛 `LEVEL_BUILT` 影响别的监听方；末尾 `try/finally` 还原 `reflow` / `_data` / `_next` / `layout.spacingX` / `content.position` 并停掉所有 tween，`--no-save`）：

    | 跑法 | `content` 子节点数 | 剩下的 `Spacer` | 幸存碎片位移 |
    |---|---|---|---|
    | 关掉，用掉一块 | 3 → 3 | 1 | **0, 0** |
    | 关掉，这一屏三块全用光（触发补下一屏） | 3（= 新一屏，一个空位都不剩） | 0 | — |
    | 开着，用掉一块（老行为） | 3 → 2 | 0 | 停在离目标 103.77px 的老位置，等 tween |

  - ⚠️ **`reflow` 是 2026-10-12 当天从 `reflowAnim` 改名的**（第一版只关掉了滑动动画、位置照旧重排，不是要的效果）。改名后**必须让编辑器重新序列化一次场景**：`refresh_assets` → `save.js`。不存的话 `assets/scene.scene` 里会留着孤儿键 `"reflowAnim": false`（序列化只写当前类的 `__props__`，存一次就自动掉了）。

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
- **修复动画在飞的时候计时器停住（2026-10-10）**：`PieceSlot` 在 `repair()` / `spotDone()` 两头抛 `GUIDE_HOLD` / `GUIDE_RESUME`，`GuideController` 用 `_holds` 计数挡住 `armIdle()`。见下面「动画期间空闲引导的计时器停住」。
- ⚠️ **必须把 `FeatureFlags.guide` 勾上**，否则 `onEnable` 第一件事就 `hide()` 然后 return，连监听都不注册 —— 表现就是「什么都看不到」。这个开关在场景里**本来是关的**，2026-10-09 已勾上（`assets/scene.scene` 里 `"guide": true`）。改完记得**重开 Game View**：开关是场景数据，跑着的预览不会热更新。
- 节奏 / 外观全是 `@property`（§16）。**手指的贴图朝向没做处理**（没识别过那张图），默认 `fingerOffset = (46, -52)`、节点 scale 0.5 —— 图标指尖对没对准副本中心，**要在 Game View 里眼过一遍再调数值**。另外**入场后 3 秒内别碰屏幕**（碰一下就重新计时），否则会以为没引导。
- 接线走 `tools/js/mount-guide.js`（幂等，scene 上下文，跑完自动存盘）。`verify-scene.js` 的必填项从 `['textGuide','fingerGuide']` 换成 `['root','ghost','finger']`，另加一条「副本节点必须挂 `UIOpacity`」（代码里取不到它就直接不显示，见下面的坑）。
- **实测**（编辑场景里手动 `onEnable()` → 喂 `LevelFactory.build()` 的真数据和一块临时造的碎片 → `show()`，跑完 `onDisable()` + 还原，`--no-save`）：`onEnable` 后 `GuideRoot` 收起；`show()` 后 `_showing=true`、`GuideRoot` 的世界坐标 **完全等于碎片的世界坐标**、副本贴图/尺寸都取到了池里那块碎片、副本透明度归 0（等淡入）、手指停在 `(46,-52)`；`onTouch()` 之后 `_showing=false`、`GuideRoot` 收起。把 `scheduleOnce` 临时换成同步执行、让整条链（点击 → 拖动 → 淡出）一口气建出来，**四个 tween 全部无异常**。
- ⚠️ **点击 / 拖动 / 淡入的观感只能在 Game View 里看**：编辑模式不 tick tween 也不 tick 调度器，上面验的是「建起来了、位置对、能收能回」，不是「看着顺」。
- ⚠️ **写这类探针时别把临时换掉的方法留在实例上**：第一版探针把 `g.scheduleOnce` 换成同步桩，结果 `play()` 当场抛错、**没走到还原那一行**，脏属性就留在编辑器内存里那个组件实例上 —— 下一轮探针读到的 `scheduleOnce` 已经是桩，`armIdle()` 因此同步触发了 `show()`。`--no-save` 救不了内存（和 §14「别把读回来的资源数组塞回 setter」是同一类坑）。探针里的替换一律包 `try / finally`（或至少两处都 `delete`），跑完确认 `hasOwnProperty` 是 false。这次确认过：脏属性**没有进 `assets/scene.scene`**（序列化走类的 `__props__`，不认这种散装属性），删掉即恢复。

**音频：配置列表 + 常驻音（2026-10-09）**

> ⚠️ **这一节描述的是当时那条配置**（`bgm.mp3` 常驻 + `LEVEL_COMPLETE / 修复成功.mp3`）。
> 场景里现在跑的是另一套（音阶序列 / 女主哭泣 / 风铃），见下面「音频：音阶序列 + 带间隔的常驻循环（2026-10-14）」。
> 本节讲的**机制**（闸门、渐入渐出、跳转停全部、切后台）到现在仍然成立。

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
    └── btn                      692×209 @ (0, -317.501) scale 0.777，挂 Button（Transition.SCALE，zoomScale 0.9）
        └── Img                  Sprite：圆角白.png 九宫格 + color 上色 —— 见下面那条「不能缩 btn 自己」
            └── Text             Label：系统字 "PLAY NOW"
```

- **「结束事件」是 `END_SHOW`，由 `SceneBgSwap.finish()` 抛** —— 底图**真的换完**那一瞬间，不是 `LEVEL_COMPLETE`（那个在最后一格吸上时就抛了，而 Slot_04 还要等胶带 + 蝙蝠 + 放大两秒多）。`revealView` / `revealEffect` 没配时 `reveal()` 直接抛这个事件，免得整条广告永远不出 CTA。
- `CtaController` 收到它才做三件事：`End.active = true` → `bg` 用 `UIOpacity` 淡入（`bgFadeTime`）→ logo / btn 从屏幕上方落下。**没亮出来之前整棵子树是 `active = false`** —— AppLovin QA 专门查「看不见却能点到」，`CtaController.onLoad` 里按住它。
- **下落 + 弹跳全在一个 `drop()` 里**，只写 `position.y` 和 `scale`，x / z 一概不动。落点就是编辑器里摆的位置（`node.position.y`），出发高度按**本节点（`CtaLayer`，运行时被 Widget 撑成画布）的高度现算**：`height/2 + dropMargin`，所以长屏 / 横屏都是从框外进来的，不用另配数。时间轴：下落（`quadIn`）→ 压扁 → 回弹，然后 `bounces` 次「弹起（`quadOut`）→ 落下（`quadIn`）→ 压扁 → 回弹」，每一下的高度 ×`bounceDecay`、时长 ×`√bounceDecay`（自由落体的缩放关系）。位置和压扁共用一条 tween 推一个 `{ y, squash }` 状态对象（和 `SceneBgSwap` / `AudioManager` 同一套路数）。
  - `squash` 是**形变量**：`scale = base × (1 + squash, 1 - squash)`，即落地横向拉宽、纵向压扁。
  - `btn` 比 logo 晚 `stagger` 秒出发，所以是「logo 先落、按钮跟着落」。
- ⚠️ **`btn` 的 Button 缩的必须是子节点 `Img`，不能缩 `btn` 自己**。引擎的 `_handleTouchEnd`（`cocos/scene-graph/node-event-processor.ts:671`）会拿**当前缩放后**的矩形做 hitTest，缩到 0.9 之后贴着边按下再松手会被判成 `TOUCH_CANCEL`，`Button` 收不到 TOUCH_END 就不发 `CLICK` —— **CTA 点击会丢**（引擎自己在 `button.ts` 的 `zoomScale` 注释里也写了这条）。缩 `Img` 则 `btn` 的命中框一动不动，怎么按都收得到。顺带把「下落动画写 `btn` 的 scale」和「按下反馈写 `Img` 的 scale」也隔开了。`verify-scene.js` 会拦「`target === node`」和「缩放目标上没有 Sprite」两种配错。
- **按钮外观不用美术图了（2026-10-10，和游戏中那个常驻按钮同一套做法）**：原来那张 `按钮.png` 随换美术一起删了，`End/btn/Img` 空了一阵（见 memory「2026-10-10 换美术后的空壳表现」）。现在 `Img` 是 `圆角白.png`（48×48、四边 `border = 16`、`packable = false`）**九宫格 + `Sprite.color` 上色**（绿 `52,168,83`，和 `GameCta` 同色），`Img/Text` 是**系统字 Label**（Arial 100 号加粗白色，"PLAY NOW"，`Overflow.NONE`）。改文案 / 颜色 / 字号 / 尺寸全在 Inspector 里，不占字体资源的体积，也不用重出图。
  - 字号 100 是**按 `GameCta` 的比例反推的**（那边 24 号配 48 高的底）：实测字块 **529.69×147.42**，占 `btn` 的 **76.5% 宽 / 70.5% 高**（`GameCta` 是 72.2% / 73.5%），所以这个按钮看着就是「同一个按钮放大版」。`btn` 自己的尺寸 / 位置 / scale **一个都没动** —— 0.777 是编辑器里摆好的值，`drop()` 拿它当基准。
  - `Text` 挂在 `Img` 下面（不是和它并排），因为 `Button` 缩的是 `Img`，按下时底和字要一起缩。
  - 接线走 `tools/js/mount-end-cta.js`（幂等，scene 上下文，跑完自动存盘）。⚠️ 它是**外观**脚本，`btn` 的命中框 / `Button` / `CtaController` 那五个口还是 `mount-end-card.js` 管的，两个都要跑。
  - ⚠️ **Label 的节点框在编辑模式不会自己重算**（实测刚挂上时 `UITransform` 停在新建节点的默认 100×100），要脚本里显式 `label.updateRenderData(true)` 才会落成 529.69×147.42 —— 不调也不影响运行期，只是场景文件里存的框是 100×100。
  - ⚠️ 观感只能看 Game View / 真机：`End` 起播前是 `active = false`，编辑场景面板里看不到按钮亮起来的样子。要过的是「绿色底 + 白字在结束界面上够不够醒目」「字块在 692×209 里留白是否合适」。
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

**游戏中常驻的下载按钮（2026-10-09 立，2026-10-10 改成不用图）**

新增 `assets/scripts/platform/GameCta.ts` + `Canvas/GameCta`（`mount-game-cta.js` 接线，幂等）。玩法过程中屏幕上一直有一个下载按钮：**竖屏贴画布下沿居中、横屏落在左边空位的中点**，一直呼吸；`END_SHOW` 一到就收掉（那一屏有自己的大按钮，两个一起摆着像坏了）。

```text
GameCta                  176×48 —— Button（缩放目标 = Bg）+ Widget（bottom 6）+ GameCta 组件
└── Bg                   Sprite：圆角白.png，SLICED，颜色 (52,168,83) —— 纯色圆角底
    └── Text             Label：系统字 Arial 24 加粗 "PLAY NOW"，白色，Overflow.NONE
```

- **外观不用美术图了**（原来是「按钮.png」720×240 整张缩到 0.2，糊得字都认不出）：底色是 `assets/recourses/UI及背景/圆角白.png`（48×48 白圆角矩形、半径 16，`.meta` 四边 `border = 16`）**九宫格 + `Sprite.color` 上色**，字是**系统字 Label**。换文案 / 颜色 / 字号 / 尺寸全在 Inspector 里改，不用重出图，也不占字体资源的体积。
  - `圆角白.png` 和进度条那张 `纯白.png` 都是**生成的小图**（48×48 与 4×4，共约 350 字节），不是美术出的 —— 圆角白用 4× 超采样算 alpha，边缘不毛。
  - 两张图的 `.meta` 里都写了 **`packable: false`**：动态图集默认开着（`maxFrameSize = 512`），这两张小图都会被塞进图集，边缘采样会吃到紧挨着的邻居像素（SLICED 的九宫格边、FILLED 的裁切边都会冒杂色）。同 `PieceFactory` 那条。
- **`Text` 挂在 `Bg` 下面而不是和它并排**，这样按下时底和字一起缩（Button 缩的是 `Bg`）。挂在 `GameCta` 自己身上也不会错，只是字不跟着缩放动。
- **竖屏那条边交给节点上的 Widget**（`bottom = 6` + 水平居中，`alignMode = ON_WINDOW_RESIZE`），画布多高它自己跟。**`GameCta` 自己一行定位都不写** —— 位置由「谁在那个方向管事」决定：竖屏是 Widget、横屏是 `LandscapeLayout`，两边互相让开（见下面那条）。
- **横屏落在「左边空位」的正中**：`LandscapeLayout` 新增第六个口 `cta`，`toLandscape()` 里先 `cta.getComponent(Widget).enabled = false`（不关掉的话竖屏那个底部 Widget 会把 y 又拽回去），再 `x = -(画布宽 ÷ 2 + totalW ÷ 2) ÷ 2`。空位是「画布左沿 → 拼图列左沿（`-totalW/2`）」，半宽取两头的平均；`totalW = colW + railGap + railW` 只有 `LandscapeLayout` 量得到（拼图列宽要乘 `scale`、栏宽要数碎片的宽），**画布宽从 `view.getVisibleSize().width` 现读** —— 画布节点自己的 `UITransform` 要等下一次 Widget 重排才更新，这一刻读到的还是竖屏那一版。demo 实数（4 块碎片、`scale = 1.4`、横屏画布 1770×1280）：`totalW = 812 + 100 + 227.5 = 1139.5`，空位 `[-885, -569.75]`（315.25 宽），**按钮中心 −727.375**，176 宽的按钮占 `[-815.4, -639.4]`，两边各留约 70px。
- `restorePortrait()` 把 `ctaPos` / `ctaWidget` 还回去（`onLoad` 快照新增这两项），交回 Widget 时顺手 `updateAlignment()` 一次，来回转屏不会越转越偏。
- ⚠️ **`mount-game-cta.js` 里不能调 `widget.updateAlignment()`**：编辑模式下它会把 `_bottom` 按节点当前矩形**回写**一遍，而画布子节点的本地坐标和它算的内缩量对不上，写回来是错的（实测 `6 → 16.367`，节点被顶高 21.84px，而且**这个错值会存进场景**）。只写内缩量 + 手动塞一版坐标就够了 —— 编辑器下一拍自己会把节点摆正（实测从任意位置滚回 −610），运行期更是照 `_bottom` 现算。
  - ⚠️ 场景里 `GameCta` 的 `_lscale` 一度是 **1.91**（来路不明，没有任何脚本写过它）—— `mount-game-cta.js` 现在每次跑都把 scale 压回 1（呼吸 tween 拿编辑器里的 scale 当基准，基准得是 1）。
- ⚠️ **必须是 `Canvas` 的子节点、且排在 `PiecePoolLayer` 后面**：碎片池底图 `PoolBG`（674×372）一直铺到画布下沿**之下**（设计 y 到 −619.81），排在池子前面会被它整个盖住。排在最后的代价是它压在 `UILayer`（进度条 / 引导 / 结束界面）上面 —— 所以 `END_SHOW` 必须收掉它。
- ⚠️ **高度 48 是被「碎片池的可点区」卡出来的，不是随便定的**（宽度 176 不受这条限制）：`ScrollView` 的矩形（实测 576.13×250.5，世界 y 56.19–306.69，即**设计 y −583.81 ~ −333.31**）上挂着触摸监听，**落在里面的触摸一律被它认领**（`_sortByPriority` 按兄弟序把池子排在前面）——压上去的那一段按下去没反应。画布正好 720×1280（16:9 竖屏）时，池子下沿到画布下沿只有 **56.19px**，`bottom = 6` 剩 50px，取 48 是不压进池子的最大值（顶边 −586，离 −583.81 还有 2.19px）。手机屏越高余量越大（19.5:9 是 195px），想做高一点得先接受「上半截点不到」，或者把它挪到池子上面去。宽度已经贴着横屏左边空位的两边约 70px 余量，再宽就要看 `LandscapeLayout` 那几个口。
  - ⚠️ 竖屏窗口比 16:9 更矮（桌面拉窄的窗口，比例 < 9/16）时画布不足 1280 高，顶边就会顶进池子矩形 —— 手机上不会出现。
  - 按钮贴的是**当前画布**的下沿，所以长屏上它比池子低一截（那是设计稿居中留出来的空带），不是偏了。横屏那边同理，贴的是画布左沿往里的那块空位。
- **跳转走新加的 `MraidBridge.openStore()`**（`isAndroid()` 分支原来在 `CtaController.onClick` 里写了一份，现在两边共用一句）。`CtaController` 的行为一字未变：还是先 `openStore()` 再抛 `CTA_CLICK`（顺序的理由见上面那条）。
- 呼吸：`repeatForever()` 套在最外层（`union()` 之后），scale 从编辑器里摆的值到 ×1.06、`sineInOut`，单程 `breathTime`（0.9s）；`onDisable` / `hide()` 都先 `Tween.stopAllByTarget(this.node)` 并还原 scale。`breathScale = 0` 就不呼吸。
- `Button` 照旧 `SCALE` / `zoomScale 0.9`，**缩放目标是子节点 `Bg`**（缩自己没有按边就丢点击，同结束界面那条，`verify-scene.js` 现在两个按钮一起查；`Bg` 上有 Sprite，`checkButton` 那三条都过）。
- 接线：`tools/js/mount-game-cta.js`。⚠️ **赋 `spriteFrame` 会按当前尺寸模式立刻改写节点框**（默认 TRIMMED → 会被写成贴图自己的大小，老图那张是 692×209），所以顺序必须是「先 `sizeMode = CUSTOM` → 再赋图 → 最后 `setContentSize`」。
  - ⚠️ **`node.setPosition(...)` 必须排在 `widget.bottom = 6` 之前**：编辑模式下 Widget 监听节点的 `TRANSFORM_CHANGED`，节点一动它就把内缩量按新位置**回写**一遍（`_adjustWidgetToAllowMovingInEditor`），后写的赢。顺序反了会存下错的 `_bottom`（实测落盘成 −5.473）。
- `verify-scene.js` 加了 `GameCta: ['bridge']`，外加三条只读检查：排在 `PiecePoolLayer` 后面、按钮配置、**顶边不许压进 `ScrollView` 的矩形**；原来的按钮检查抽成了 `checkButton(path, name)` 共用。
- 已实测（编辑场景里手动 `onLoad/onEnable`、跑完全部还原、`--no-save`）：注册前后总线 `[] → ['END_SHOW','ORIENTATION_CHANGED'] → []`；`hide()` 后 `active = false` 且 scale 还原；`onClick()` 打出 `[MraidBridge] 本地调试不跳转：https://apps.apple.com/...`（编辑期没有 mraid，走的是 UA 分支，说明 `openStore()` 通）。
  - 落盘读数：`_lpos (0, −610)`、`_lscale (1,1,1)`、Widget `_alignFlags 20`（BOT|HC）、`_bottom 6`、`_alignMode 2`。
  - Widget 侧那三组实测：只写 `bottom = 6` 不调 `updateAlignment()` → 内缩量保持 6，编辑器下一拍把节点摆到世界 y 30（本地 −610）✓；调了 `updateAlignment()` → 立刻被回写成 16.367（`--no-save` 下反复复现）；把节点故意挪到 −642.207 再等一拍 → 又滚回 −610 ✓（也就是「错值只从 `updateAlignment()` 那条路来」）。
  - `toLandscape()` / `restorePortrait()` 的探针（编辑场景里手动调，空池子 → `railW = 48`、`totalW = 960`、编辑期 `visibleW` 恒为 720）：`landscape` 读数 `x = −420`（= `expectX`）、`y = 0`、**Widget 已被关掉**；`restorePortrait()` 之后回到 `x = 0 / y = −610 / widget = true / scale = 1` —— 与进 `toLandscape()` 前逐位相等。⚠️ 这批数字里的画布宽是编辑模式的 720（真机横屏约 1770，按公式落在 −727 那一带），探针验的是**公式与开关的往返**，不是真机上的构图。
  - `verify-scene.js` 只剩那两条既有告警（`ProgressController.label` 为空、`AudioManager` 第 5 条没拖音效）；新增的 `LandscapeLayout.cta` 与 GameCta 那几条只读检查全过（176×48 的顶边离池子可点区下沿还有 2.19px）。
  - 换外观后（2026-10-10）落盘读数：`GameCta` 176×48 @ (0, −610)、scale 1、`_lscale` 1（那批 1.91 的脏值被脚本压回来了）；`Bg` 176×48、`圆角白` sizeMode 0 / type 1(SLICED) / trim false / color (52,168,83,255) / `packable false` / inset 四边 16；`Text` 的 Label `PLAY NOW`、字号 24、加粗、系统字、自动尺寸 **127.1×35.3**（比 176 窄、比 48 矮，不会出框）。
- ⚠️ **观感只能看 Game View / 真机**：编辑模式不 tick tween、也不跑 `start()`。要眼过一遍的是「呼吸的幅度与节奏」和「圆角底的绿色（和结束界面那张按钮图同色系）配白字够不够醒目、`PLAY NOW` 在 24 号字下在真机小屏上认不认得出」。另外**真机上点一下必须能跳**（走的是和结束界面同一个 `openStore()`，但这条 CTA 从开局就在，是「没通关也点了」这条新路径）。

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

**Slot_04 的两种状态：达标看前置槽位，不达标就跳商店（2026-10-10）**

`Slot_04`（人物）有两种结局：**没先修好 Slot_01 + Slot_02 就修它 → 展示 `Repaired`（失败的人）
并抛 `REPAIR_FAILED`**；两个前置都修好了 → **展示 `Repaired-001`（成功的人）**。
碎片池里那块碎片**始终**用 `Repaired` 那张（失败的人）。

- 两个新口都在 `PieceSlot` 上，全是引用、没有新的数字参数（§16 不用动）：
  - `requires`（前置槽位，`PieceSlot[]`）—— 这些槽位全部 `repaired` 才算达标。留空 = 永远达标。
  - `altView`（达标后的修复图，`RepairedSlot`）—— 达标时展示它。`onLoad` 里收起它（场景里它是 active 的，
    编辑期看得见好摆位，同 `完成背景` / `好人` 那套路数）。
- **`_met` 在 `repair()` 里算一次**（`meetsRequires()`），之后全场读 `PieceSlot.showView` getter：
  `_met && altView ? altView : repairedView`。**揭晓那三处 + 扫光都改成读它** ——
  `RevealHost` 的字段就从 `repairedView` 改名成了 **`showView`**（`CircleReveal` / `RepairReveal` /
  `RepairSweep` 一并跟着改；`repairedView` 这个 `@property` 本身没动，`RepairedSlot` 也没动）。
  不这么改的话没达标那一下的圆形扩散会盖在「成功的人」上 —— 画面和状态对不上。
- **这一格照旧算修好**：`_repaired = true`、进度 +1、`PIECE_REPAIRED` / `REPAIR_PROGRESS` 照抛
  （§1「无失败态」不变）。失败**不亮结束界面**，`CtaController` 收到 `REPAIR_FAILED` 只记下槽位号，
  等**这一格自己的修复揭晓演完**（同槽位的 `PIECE_SHOWN`）直接 `onClick()` —— 也就是
  `bridge.openStore()` + `CTA_CLICK`（后者顺带让 `AudioManager` 停掉全部音）。
  - 时机就是「动画结束再弹」：现在 Slot_04 走的是圆形扩散（0.6s），`PIECE_SHOWN` 正好在它铺满之后。
    **后面要加的那套失败动画就插在这条链上** —— 要么等它播完再让 `PieceSlot` 抛 `PIECE_SHOWN`
    （同 `RepairReveal` 的做法），要么在 `CtaController.onShown` 里换一个触发点。
- 接线走 `tools/js/mount-slot-alt.js`（幂等，scene 上下文，跑完自动存盘）：`requires = [Slot_01, Slot_02]`、
  `altView = Slot_04/Repaired-001` 的 `RepairedSlot`、`poolSprite` = `Slot_04/Repaired` 上那张（失败的人）。
  池里用图**显式钉住**，这样以后谁改 `repairedSprite` 都不会把池里那块带到「成功的人」上去。
- `verify-scene.js` 加了一条只读检查：配了「达标后的修复图」却没配「前置槽位」就报 ——
  那种配置 `meetsRequires()` 恒为 true，**失败分支一次都走不到**。现在四个槽位无告警。
- 已实测（编辑场景里手动把两个揭晓挡住让 `repair()` 直达 `showRepaired`，跑完还原、`--no-save`）：
  - 前置没修：`repair(3)` → `_met = false`、`showView = Repaired`、`REPAIR_FAILED` 载荷 `[3]`、
    `PIECE_SHOWN` 载荷 `[3]`；
  - 前置都修好（手动把 Slot_01/02 的 `_repaired` 置真）：`showView = Repaired-001`，`Repaired` 不再亮；
  - 跳转：`CtaController.onFailed(3)` 之后 `onShown(1)` **不跳**（别的槽位露面不关它的事）、
    `onShown(3)` 跳一次；跑完监听回到空、探针留下的 `play` / `handles` / `openStore` 三个桩全部 `delete` 干净。
  - 落盘读数：`Slot_04` 的 `requires` = `["Slot_01","Slot_02"]`、`altView` = `Repaired-001`、
    `poolSprite` = `repairedSprite` = `ced2a79f`（失败的人）。
- ⚠️ **「直接自动跳商店」是明确要求**（不是走结束界面让玩家点）：`mraid.open()` 在失败这一刻自己弹，
  没有任何用户交互。AppLovin 审核可能把「自动跳转」算违规项，交审前确认一次。
- ⚠️ **失败之后没有锁输入**：「无法进行其他操作」目前只靠「碎片已经用掉 + 平台跳转后广告多半被收起」。
  玩家从商店返回后仍能接着拖其余的碎片（甚至把整关修完、亮出结束界面）。要真锁就得加一条
  「游戏结束」事件让 `DragController` / `PiecePool` 停下，说一声再加。
- ⚠️ **观感只能在 Game View 里看**：编辑模式不跑 `onLoad`（所以场景面板里 `Repaired` 和 `Repaired-001`
  是**重叠**显示的，运行时才由 `onLoad` 收掉），也不 tick tween 与调度器。

**地上脏水：默认隐藏，修错时从上到下刷出来（2026-10-10）**

`Canvas/GameLayer/Scene_BG/地上脏水`（222×109，贴图 `地上脏水.png`）平时**完全不出现**，
Slot_04 修错抛出 `REPAIR_FAILED` 的那一刻，它**从顶边往下**刷满。

- 新增 `level/GroundWater.ts`，**挂在节点自己身上**（不需要 `PieceSlot` 上多一个口，也不用接线脚本回填，
  它只听事件）。两个口：`delay`（失败后延迟，默认 0）、`revealTime`（渐显时长，默认 0.5）。
  `onEnable` 注册 / `onDisable` 注销 `REPAIR_FAILED`，跑完停 tween。
- **「从上到下」还是那套 FILLED 裁剪**（同胶带 `TapeReveal`，真裁剪不是拉伸），方向靠 `fillStart`：
  ⚠️ **竖向填充是从 `fillStart` 那一头长到 `fillEnd`**，`fillStart = 1` 是顶边，所以「从上往下」要
  tween 一个 **0 → −1** 的 `fillRange`（引擎里负值 = 「起点往反方向走」，`bar-filled.ts:57`）。
  **配成正的 `fillRange` 在 `fillStart = 1` 下永远什么都不画**（`1 + r` 被夹到 1，再减回 1 → 零高）——
  实测 `fillRange = 0.5` 的四边形退化在顶边（`bottom = top = +54.5`）。`verify-scene.js` 因此卡
  「必须是 FILLED/VERTICAL/`fillStart = 1`」。
- **「默认隐藏」是靠 `fillRange = 0`**（四边形退化成零高，不是 `active = false` —— 节点一关，
  `onDisable` 就把 `REPAIR_FAILED` 的监听注销了，水永远不会出现）。场景里存的是 **1**（编辑模式不跑
  `onLoad`，得看得见才好摆位），运行期 `onLoad` 归 0。
- **顺带把 `frame.packable` 关掉**：动态图集默认开着，FILLED 的裁切边会线性采样到图集里紧挨着的邻居
  像素（同 `PieceFactory` / `纯白.png` / `圆角白.png` 那三处，这里是写在代码里而不是 `.meta` 里）。
- 接线走 `tools/js/mount-ground-water.js`（幂等，scene 上下文，跑完自动存盘）：Sprite 改
  FILLED/VERTICAL/`fillStart = 1`、`sizeMode = CUSTOM`、`fillRange = 1`（存盘的初值），挂组件。
- 已实测（编辑场景里手动 `onLoad()` → `onEnable()` → `onFailed()`，跑完还原、`--no-save`）：
  `onLoad` 后 `fillRange` 由 1 变 0、`packable` 由 true 变 false；`onEnable` / `onDisable` 前后
  `REPAIR_FAILED` 的监听数 **1 ↔ 0**；`onFailed()` 不抛。**方向直接读四边形**：
  `fillRange = −0.5` → 底边 0、顶边 +54.5（**上半截**，正是「从顶上刷下来」）；
  `−1` → −54.5 ~ +54.5（整块）；`0` → 底顶都在 +54.5（零高）。
  ⚠️ 编辑模式不 tick tween（手动 `TweenSystem.instance.update()` 也推不动），所以「刷的动作、
  0.5s 的节奏」只能在 Game View 里看。
- ⚠️ **它和 `REPAIR_FAILED` 之后的自动跳商店抢时间**：`CtaController` 等的是这一格的 `PIECE_SHOWN`，
  现在 Slot_04 走圆形扩散（0.6s），也就是说**脏水刷满（0.5s）刚过 0.1s 就跳商店**。
  想让玩家看清再跳就得把跳转压到渐显之后（给 `CtaController` 加个失败延迟，一行的事）——
  没做，要就说一声。
- 没进 `FeatureFlags`：这是「修错」这条需求本身的画面，不是可选表现（§15）。

**气体待机 / 通马桶 / 扫地 / 喷瓶（2026-10-10）**

四件事，三个新脚本 + 一个通用组件（喷瓶那节另起，见下面「Slot_05 喷瓶」）；喷瓶那节在 2026-10-10 按反馈改过一次：

| 新文件 | 挂在哪 | 干什么 |
|---|---|---|
| `gameplay/IdleMotion.ts` | `Scene_BG/马桶隐藏节点/气体大`、`/气体小` | 循环待机动作（不碰玩法、不抛事件） |
| `level/FlushAction.ts` | `Slot_02` | 通马桶收尾动作 |
| `level/BroomSweep.ts` | `Slot_03` | 扫地收尾动作 |
| `level/SprayAction.ts` | `Slot_05` | 喷瓶收尾动作（左右摇晃 → 换喷雾 → 从上往下落 + 气体从上到下渐隐 → 收起） |

**待机：气体飘（`IdleMotion`）**

- 一个通用组件：以**编辑器里摆的位置 / 缩放**为基准走正弦 —— `swayX` / `swayY`（px）+ `stretchX` / `stretchY`（比例，`0.12` = ±12%），`period`（秒）+ `phase`（0–1，多个节点错开起跑）。挂在节点自己身上，开局一直演。
- 场景里配的两条：`气体大` `swayX = 25 / period = 3.2`（只左右）——按你的要求「左右移动循环播放」；`气体小` `stretchY = 0.12 / period = 1.8`（只上下拉伸）——「上下略微拉伸」。两者其余幅度都是 0 = 那条轴不动。
- ⚠️ **没有复用已有的 `SwayMotion.ts`**：那个 `@requireComponent(UIOpacity)` 并且会把**透明度**一起 0↔255 起伏，拿它做「气体飘」会把气体飘没。`RiseReveal` / `SwayMotion` 都还在场景里（挂在稻草人那边），一个字没动。
- 实测（编辑场景里手动喂 `update(dt)`，跑完还原、`--no-save`）：`气体大` x 在 `基准 ∓25` 之间来回（-17.652 ↔ 32.348）、`scale.x` 不变；`气体小` `scale.y` 在 `1 ∓0.12` 之间（0.88 ↔ 1.12）、x 不变；两边的基准都没漂。

**Slot_02 通马桶（`FlushAction`）**

时序：吸附 → 现有的圆形扩散揭晓照旧先走（`circleReveal` 整格接管优先级最高，`repair()` 里它在第一个分支）→ 扩散铺满 → **`FlushAction.play()`** → 整段演完才抛 `PIECE_SHOWN`。

1. **挪到位**：修复图（马桶搋子）`position → (-25.28, 2.107)`、`angle → 24`，`quadInOut`，`moveTime = 0.35s` —— 就是「这个过程需要平滑一点」。
2. 到位后**同时**起两条：
   - 搋子**上下抽动**：`bobCount = 3` 个来回，`bobDepth = 14px`，单程 `bobTime = 0.18s`（`quadOut` 下、`quadIn` 上）；
   - **`脏水` 等比缩小、水面往下落**：`scale.x` 与 `scale.y` **一起**缩到 `waterShrink`，**按抽动次数分档**（`bobCount` 次压下去各缩一档、抬起来那半程水位不动 —— 见下面那条）。
3. 两条都跑完 → 搋子与脏水一起在 `fadeTime = 0.25s` 里 `UIOpacity` 淡到 0（`sineIn`）→ 各自 `active = false`。
4. `onDone()` —— 这一格这才算露面。

**脏水是「等比缩小 + 底边固定」，不是「只压 y + 整体下沉」（2026-10-10 按反馈改）**

第一版写的是 `scale.y → ×0.15`（x 不动）+ `position.y → −22px`，实测两个问题：**水被压扁成一条横杠**，
而且那条横杠宽 111px、又被往下推 22px，**横向伸出了马桶、底部也穿出去了**。

现在改成：**`waterShrink` 同时写 `scale.x` 和 `scale.y`**（形状不变），并且 **`position.y` 按「底边固定」现算** ——
`bottom = 基准 y − 内容高 × 基准 scale.y × anchorY`，每帧 `y = bottom + 内容高 × 当前 scale × anchorY`。
于是缩的时候**水面从上面往下落、底边一动不动**，正是排水该有的样子，也**不可能再往马桶底下穿**。
`waterDrop`（默认 0）是额外的下沉量，想再往下压一点才填正数。

demo 实数（`脏水` 111×45、anchor (0.5,0.5)、基准 `position (-65.287, -37.868)`）：
底边全程钉在 **−60.368**；`waterShrink = 0.2` 时水变成 **22.2 × 9**、中心从 −37.87 落到 −55.87、
顶边从 −15.37 落到 −51.37（水面下落 36px），横向只占 −76.39 ~ −54.19 —— 从 111 宽收成 22 宽，
彻底进到马桶口里面。

**一次抽动排一档，不是一口气缩完（2026-10-10 按反馈改）**

原来是**一条 `sineIn` tween 在 `drainTime` 内一路缩到底**，和抽动各跑各的 —— 看上去是「水在匀速消失，
搋子在上面自己抽」。现在把这段拆成 `bobCount` 档，**逐拍对齐抽动**：

- 第 i 次「压下去」那半程（`bobTime`）把水从上一档缩到 `i / bobCount`（`s` 由 1 线性插到 `waterShrink`，
  `d` 同步插到 `i / bobCount`），缓动换 **`sineOut`**（压下去那一下先快后慢，像被挤出来）；
  紧接着「抬起来」那半程用 `.delay(bobTime)` **让水位停住**。
- 于是两条链总长都是 `bobCount × bobTime × 2`（现在 3×0.18×2 = **1.08s**），逐拍同步、末尾同时到 ——
  观感就是「搋子抽一下、水少一截」。
- **`drainTime` 这个属性已删**（排水时长不再是独立参数，由 `bobCount` / `bobTime` 决定）；场景里那两格的旧键
  （`"drainTime": 0.5`）留在原地，反序列化时类上没有就直接忽略，下次编辑器存盘会自己掉，无害（同 `FrameLoop.scaleTime`）。
- `s` 是**分档**写的，不是每档从 1 重来：`i` 档的目标 = `1 + (waterShrink − 1) × i / bobCount`，
  所以每一档都接着上一档的尺寸继续缩，缩完恰好是 `waterShrink`。

- ⚠️ **`waterShrink` 是等比**，别指望用它单独调某一个轴；**缩得多细、抽几下**看 `bobCount` / `bobTime` / `waterShrink`。
- 以上是按公式推的端点值（`node -e` 算过，底边恒定、宽高按比例）；**观感（每档缩多少、抽动与水位对不对得上）还是只能在 Game View 里看**。

- **气体大 / 气体小 一个字节都没碰**（按你确认的「只收脏水，气体留着」）：`FlushAction` 只拿到 `water` 一个口，那两团气体不归它管，照旧飘。
- ⚠️ **曲线全是 `to()` 接到当前值**，起点是**现读的**节点位置（不是编辑器里那个），所以先播了圆形扩散、节点被挪过也不影响。
- 抽动那一段是用 `tween(bobState)` + `onUpdate` 写 `position`（外面套一节一节 `.to()`），不是改节点自己的 `position` tween —— 因为同一段时间里**水位那条也在写这个节点之外的另一个节点**，两边互不抢。

**Slot_03 扫地（`BroomSweep`）**

没有扫地序列帧素材，摆动是**程序算的**（移动 + 旋转，你确认的那条）。

时序：吸附 → 圆形扩散照旧先走 → `BroomSweep.play()`：

1. 扫把 `quadInOut` 挪到**物品中点**（`moveTime = 0.35s`，中点可以再用 `offset` 微调）；
2. **一开摆，物品就同步开始渐隐**（不再等扫把摆完）：`items` 下（= `Scene_BG/扫把隐藏节点`，子节点是 `浴球` / `牙膏` / `猫砂`）每个子物品按顺序依次渐隐，`UIOpacity` 在 `fadeTime = 0.3s` 里淡到 0 → `active = false`，相邻两个之间停 `gap = 0.1s`（第 i 个的起跑延迟 = `i × (fadeTime + gap)`）；
3. **摆动 + 右移同时进行**：`sweepCycles = 2` 个来回，每个单程 `sweepTime = 0.15s`，`angle` 在 `0 ↔ sweepAngle(16°)` 之间走 `sineInOut`；**整段摆动期间扫把还匀速向右推进 `sweepMoveX = 120px`**（起点是中点、终点 `中点 + sweepMoveX`），看着像真的扫过去；
4. **摆完立即收起**（`active = false`，没有渐隐）—— 此时物品可能还在渐隐（摆 0.6s、物品全隐要 1.1s）。
最后一个物品隐完 → 抛 `PIECE_SHOWN`。

- **中点 = 各物品位置的平均值**（2026-10-10 改，之前是「每个物品各扫一遍」）：`扫把隐藏节点` 自己在 `(0,0)`，三个物品在 `(70.6, -296.2)` / `(-129.4, -294.2)` / `(-207.9, -176.5)`，平均落在 `(-88.9, -255.6)` —— 刻意**不取父节点自己的位置**。
- **物品位置是现读世界坐标再换算到扫把父节点空间**（`parent.convertToNodeSpaceAR(item.worldPosition)`），所以转屏 / 改布局都不会跑偏（同工程里「世界坐标一律现读」那条）。
- **扫把挪 + 摆是一条链走到底**，两条 `.call()`：第一节后面那个起物品的渐隐 + 右移（= 摆动的第一拍），链末那个收起扫把。物品的渐隐是**各自独立的一条 tween**（`.delay(绝对时刻)` 起跑）—— 两条链互不抢节点。
- **右移是和角度链并行的第二条 tween，同一个节点上**（`advance()`）：两条各写各的属性（`position` / `angle`）。这是安全的 —— 引擎的 `ActionManager.addAction` 对同一 target 是 `element.actions.push(action)`（`tween/actions/action-manager.ts:156`），没有 cocos2d-x 那种「同 tag 顶掉」的行为。**别把两条都写成 `position`**，那才是会互相拽。
  - ⚠️ 同处 `:145` 还有一条：**target 是 Node 且它是这堆动作里的第一个时，动作会在节点 `active = false` 时被整个 `paused`**（`_registerNodeEvent`）。所以链末那句 `broom.active = false` 之后扫把那两条 tween 都不会再推进 —— 反正那一刻它们都跑完了。
- **物品从「摆动开始」那一刻起隐，不是「挪过去」时起隐**：挪的那 0.35s 里物品还是全的（扫把还没到，先隐就是扫空气）。要连这段一起隐就把 `fadeItems` 挪到 `play()` 里、`tween(broom)` 之前。
- `broomFadeTime` 已删（改成硬隐藏，没有渐隐这一拍了）。场景里 `BroomSweep` 那个组件上还留着旧值，反序列化时类上没有这个属性、直接忽略，无害（同 `FrameLoop` 的 `scaleTime`）。
- ⚠️ **这一版只过了 `tsc --noEmit`，没在编辑器 / Game View 里跑过**：要眼过一遍的是「扫把起手停在中点对不对（不对就调 `offset`）」「右移的距离够不够/会不会扫出物品范围（`sweepMoveX`，120 是按三个物品横向跨度约 300px 猜的）」「摆 + 平移合起来像不像在扫」和「三个物品依次渐隐的节奏」（`fadeTime` / `gap` 都在 Inspector 上）。改完记得 `refresh_assets` + 重开 Game View。

**为什么动作接在 `PIECE_SHOWN` 之前（这次的关键决定）**

`SceneBgSwap`（完成背景扩散 → 抛 `END_SHOW`）和 `RepairSweep`（总修复扫光）都按 `PIECE_SHOWN` 计数。`PieceSlot.shown()` 原来在这一格修好时**同步**就抛了 —— 这两格要是**最后一块修好的**，搋子/扫把的动作还没演完，完成背景 + 结束界面就盖上来，整段表现被吞掉（和 Slot_04 胶带那格是同一个问题，见上面「扫光改挂修复图露面」那条）。

改法：`shown()` 拆成两截 —— `shown()` 先看有没有配收尾动作，有就 `play(this, this.spotDone)`；`spotDone()` 才是原来那两行（抛 `PIECE_SHOWN`，胶带那格再多抛一条 `WINDOW_REPAIRED`）。和 `TapeReveal` 延迟露脸是同一套逻辑。

**为什么清掉了 `Slot_02` / `Slot_03` 的 `swapHide`（就是「配了隐藏节点但没生效」的根因）**

`repair()` 里那句是 `const swap = !!(this.swapHide && this.swapShow)` —— **两个口都填了才生效**。这两格当时只填了 `swapHide`（`马桶隐藏节点` / `扫把隐藏节点`）、`swapShow` 是空的，所以整条换节点分支是死的：`swapAfterSweep()` 一次都不会被调用。这就是「我配置了它的隐藏节点，但是并没有生效」的直接原因。

- 现在 `swapHide` / `swapShow` **两个都清成了 `null`**（节点引用改由新组件自己的 `water` / `items` 口承担），`verify-scene.js` 的 `checkSwap` 不再报「没配齐」。
- ⚠️ **别再往这两格填 `swapHide`** —— 填了就只是挂一个没人读的引用（`swapShow` 空着），表现上什么都不发生。

**场景现在的揭晓接线（2026-10-12 实测，与上下几节的老描述都不一致）**

> ⚠️ **这一节的数字是「六格」版本的，上面所有提到 `Slot_03` 是毛衣 / `Slot_04` 是胶带 / `Slot_05` 是喷瓶
> 的小节，描述的都是**同一批槽位换美术之前的历史**，节点与配置现在都不在了。以本节为准。

`repair()` 里排在最前的是两个「整格接管」的揭晓（贴纸贴平 → 圆形扩散），谁配了谁就决定那一格整段长什么样。
当前 `assets/scene.scene` 的实际值（**六格**，`Slot_01` … `Slot_06`）：

| 槽位 | `pieceId` | 图（`Broken` / `Repaired`） | `stickerApply` | `circleReveal` | `revealAnim` | 收尾动作 | `altView` | `peelOverride` |
|---|---|---|---|---|---|---|---|---|
| Slot_01 | 0 | 女人线 / 女人 | 有 | null | 有 | — | — | 有 |
| Slot_02 | 1 | 男人线 / 男人完整 | 有 | null | 有 | — | — | 有 |
| Slot_03 | 2 | 伞线 / 伞 | 有 | null | 有 | — | — | 有 |
| Slot_04 | 3 | 花线 / 花 | 有 | null | 有 | — | — | 有 |
| Slot_05 | 4 | 猫线 / 猫 | 有 | null | 有 | — | — | 有 |
| Slot_06 | 5 | 高跟鞋线 / 高跟鞋 | 有 | null | 有 | — | — | 有 |

- **六格都走贴纸贴平**（`mount-sticker-apply.js` 接一格就顺手清掉那一格的 `circleReveal` —— 两个都是
  「整格接管」、都往同一张修复图上挂材质，只能填一个）。
- **六格也都勾了「本格单独配揭角」**（`peelOverride = true`），`peelParams` 都是从全局那份物化来的 ——
  见上面「揭角参数按格配」。想给某格换个角，直接改它自己的 `peelParams` 即可。
- **`revealAnim` 六格都配着但走不到**：`repair()` 里贴纸贴平排在它前面，整格接管了。关掉
  `FeatureFlags.stickerApply` 才会退回「序列帧 + 放大」那条。
- **`tapeReveal` 这个字段已经从 `PieceSlot` 上删掉了**（连同 `TapeReveal.ts`、`FrameLoop.ts` 两个脚本），
  上面几节提到胶带 / 稻草人的描述是历史。`TAPE_REVEAL` / `WINDOW_REPAIRED` 两个事件也从 `GameEvent` 里删了。
- **三个收尾动作（`FlushAction` / `BroomSweep` / `SprayAction`）、`GroundWater`、`IdleMotion`
  在场景里一个实例都没有**，它们依赖的节点（`气体大` / `气体小` / `马桶隐藏节点` / `扫把隐藏节点` /
  `地上脏水` / `稻草人` / `好人` / `坏人`）**都已不存在**。代码还在、没坏，只是没有槽位在用它。
  连带地 `altView` / `requires` 六格全空 ⇒ `REPAIR_FAILED` 永不抛（终局跳转只剩「修满 `winCount` 个」
  那条路），`WINDOW_REPAIRED` 也就不再抛。
- `pieceId` 是 **0 / 1 / 2 / 3 / 4 / 5**，唯一不并列（`PiecePool` 按它排序，并列时会退化成
  场景里的子节点顺序 —— 那正是「改成不并列才没有隐患」说的隐患，现在没有这个问题了）。
- 上表是 `--no-save` 探针逐格读出来的（`stickerApply` / `circleReveal` / `revealAnim` / 三个收尾动作 /
  `altView` / `requires` / `swapHide` / `peelOverride` / `pieceId` / 两张图的 frame 名）。
  **改接线之前先看这张表。**

**接线与校验**

- `tools/js/mount-idle-motion.js`（幂等，scene 上下文，跑完自动存盘）：两团气体各挂一个 `IdleMotion` 并填参数；`脏水` 不在它的管辖里（`untouched: ["脏水"]`）。
- `tools/js/mount-slot-actions.js`（幂等）：`Slot_02` 挂 `FlushAction`（`water = Scene_BG/马桶隐藏节点/脏水`）、`Slot_03` 挂 `BroomSweep`（`items = Scene_BG/扫把隐藏节点`），回填 `PieceSlot.flushAction` / `sweepAction`，清两个 `swapHide`，并给 `脏水` / 两格的 `Repaired` / `浴球` / `牙膏` / `猫砂` 补 `UIOpacity`（渐隐要用，**缺了就是 `null.opacity` 直接抛 —— 抛在这条路上等于这一格的 `PIECE_SHOWN` 永远不抛，最后一格修好时完成背景和结束界面都不出来**）。
- `tools/js/mount-spray-action.js`（幂等，scene 上下文，跑完自动存盘）：`Slot_05` 挂 `SprayAction`（`gases = [气体大, 气体小]`）、回填 `PieceSlot.sprayAction`、**把摇晃 / 下落 / 气体那七个调参写进去**（`shakeCount 3 / shakeAngle 8 / shakeTime 0.12 / mistRise 60 / mistDropTime 0.9 / gasFadeTime 0.45 / gasStagger 0.35` —— 在 Inspector 里改过再跑一次会被复位）、给两团气体补 `UIOpacity`、`Slot_05/Repaired` 的 Sprite 改 `sizeMode = CUSTOM`、`Slot_05.pieceId` 从 0 拉到 4。**两张贴图的 uuid 不写死**（重新导入就会变），由调用方从 `.meta` 现算后经 args 传进去：
  ```
  node tools/exec.mjs scene tools/js/mount-spray-action.js \
    "{\"noMist\":\"<喷瓶无喷雾 的 uuid>@f9941\",\"mist\":\"<喷瓶 的 uuid>@f9941\"}"
  ```
  不传 args 就只接 gases / 引用 / `pieceId`，两个图口保持原样（那样这一格 `handles()` 恒为 false，整套动作不演）。
- `verify-scene.js`：`wanted` 加了 `IdleMotion: []` / `FlushAction: ['water']` / `BroomSweep: ['items']` / `SprayAction: ['mistFrame']`；新增只读的 `checkSpot`（脏水没挂 `UIOpacity`、物品父节点下没有子节点、每个子物品没挂 `UIOpacity`、喷瓶的气体没挂 `UIOpacity`、有收尾动作的槽位修复图没挂 `UIOpacity`，五条各报一条 —— **喷瓶不收修复图**（它是硬隐藏），所以它不并进最后那条）。
- 跑下来：`found.IdleMotion = ["气体大","气体小"]`、`found.FlushAction = ["Slot_02"]`、`found.BroomSweep = ["Slot_03"]`、`found.SprayAction = ["Slot_05"]`，`missing` 里只剩那三条既有的（`ProgressController@UILayer`（`label` 空）/ `BackgroundSwap@CtaRoot` / `背景图九宫格 inset 没配齐（0,0,0,0）` —— 后两条是换美术留下的真实缺口，见 memory 里那条「换美术后的空壳表现」），**没有新告警**；`npx tsc --noEmit` 与 `run_script_diagnostics` 都是零报错。
- ⚠️ **MCP 端口每一轮都可能变**（跑过 20168 / 21561 / 24148）：`tools/exec.mjs`、`tools/mcp.mjs` 默认 20168，**跑之前先带 `MCP_PORT=<端口>` 试一次 `get_editor_state`**，连不上再问 / 换端口。2026-10-12 这一轮实际是 **24148**，而 `funplay-cocos-mcp.config.json` 里还写着上一轮的 21561 —— **那个文件不保证是最新的，别拿它当唯一依据**，以 `get_editor_state` 返回的 `status.port` 为准。

- ⚠️ **观感只能在 Game View 里眼过一遍**：编辑模式不 tick tween 也不 tick 调度器，上面验的是「建起来了、数对、能收能回」，不是「看着顺不顺」。要看的四件：① 气体大飘的幅度/速度、气体小拉伸的幅度（会不会晃眼）；② 搋子挪到位那一下顺不顺、抽动几次合适、脏水下得自不自然；③ 扫把摆动角度与节奏、三个物品扫掉的先后；④ **把 `Slot_02` 或 `Slot_03` 留到最后一块修**，确认动作演完才出完成背景 / 结束界面。

**Slot_05 喷瓶：摇晃 → 换喷雾 → 落下 + 气体从上到下渐隐 → 收起（2026-10-10，同日按反馈改过一次）**

新增 `assets/scripts/level/SprayAction.ts`，挂在 `Slot_05` 上，由 `PieceSlot.sprayAction` 指过来。整段是：

1. **摇晃**：修复图（`喷瓶无喷雾`）**在编辑器里摆的角度上左右摇**（`node.angle`，不是位移）——`shakeCount` 次（默认 3），每次「摆到 `+shakeAngle` 再摆到 `−shakeAngle`」（默认 8°，单程 `shakeTime` = 0.12s），最后一次额外摆回 0，**精确停回原角度**（下面换图时的对齐量读的就是它）。
2. **换成「无喷雾」那张**：显式 `noMistFrame`（不换也不影响画面，摇晃用的本来就是它；写出来是为了别受池里那块碎片被改过的影响）。
3. **换成「喷雾」那张（`喷瓶`）+ 从上往下落一次**：换完先抬到落点上方 `mistRise`（默认 60px），再用 `mistDropTime`（默认 0.9s、`sineInOut`）缓慢落到对齐位置。**同时**两团气体**从上到下依次**渐隐 —— 每团自己一条 tween，按各自的世界纵坐标排序（上先下后），相邻两团差 `gasStagger`（默认 0.35s），每团自己淡 `gasFadeTime`（默认 0.45s）。
4. **收起**：下落和气体渐隐**都完了**才 `showView.hide()` → `onDone()` —— 也就是「喷完之后正常隐藏节点」，画面上不留下那瓶有喷雾的。

- ⚠️ **这两处是 2026-10-10 按反馈从第一版改过来的**：摇晃原来是「上下位移」（`shakeDepth` px），换图后原来是「上下浮动 3 次」（`bobCount` / `bobDepth` / `bobTime`），气体原来是**同时**淡。三个属性连同字段名一起删了 —— 场景文件里那三个旧键留在原地（反序列化时类上没有就直接忽略，和 `FrameLoop.scaleTime` 一样无害），下次编辑器存盘会自己掉。
- ⚠️ **摇晃改用 `node.angle` 之后，`spray()` 里那句读 `view.eulerAngles.z` 的对齐换算仍然对**：摇晃链最后一次明确摆回 0，所以进 `spray()` 时角度就是编辑器里那个 −9.968°。**别把最后一次 `.to({ a: 0 })` 去掉**。

- **两张贴图的画布不一样大，直接换会跳**：`喷瓶无喷雾` 是 81×192（瓶子几乎占满画布），`喷瓶` 是 230×222（瓶子缩在右下角、喷雾往左上飘）。所以换图那一下按 **`mistScale` + `mistOffset`** 把喷雾图挪回瓶身原来的位置：默认 `mistScale = 1.265`、`mistOffset = (-99.03, 42.87)`。
  - 量法（都按 **alpha 包围盒**、阈值 128，`喷瓶.png` 只看 `x ≥ 156` 以避开往左飘的雾）：两张图的**瓶身高度** 191 与 151 → `k = 191/151 = 1.265`；再让两个瓶身的**底边中点**重合 → 位移 = `A底边中点 − k × B底边中点`。**按高度对齐、不是按宽度**：两个瓶子的宽高比本来就不一样（0.419 vs 0.49，喷雾那张更矮胖），没有哪个 k 能同时对上两个方向，取高度是「瓶子还是那么高」，代价是看上去宽约 17%。
  - **`mistOffset` 写在贴图像素里**，运行时按节点自己的旋转转一次再当位移用（`Repaired` 在场景里被转了 **−9.968°**，不转的话瓶身会偏 21px 左右）。所以场景里怎么拧那个角度都不影响对齐。
  - 换图时把节点的 `sizeMode` 钉成 `CUSTOM`、框设成那张图的 `originalSize`（81×192 / 230×222），配合节点上本来就是 `trim = false` 的 Sprite —— 整张画布按 1:1 画进框里，**贴图像素 = 节点本地像素**，上面那套位移才是准的。实测（编辑场景里手动调 `spray()`，见下）瓶身底边中点换图前后落在 `(-16.860, -90.174)` 与 `(-16.848, -90.191)`，**差 0.02px**。
- **`noMistFrame` / `mistFrame` 两个图口是接线脚本赋的**，uuid 不写死（每次重新导入都会变），由调用方从 `.meta` 现算后经 args 传进去 —— 见下面「接线与校验」。**`mistFrame` 是必填**：填了 `handles()` 才为 true，留空则这一格整套动作不演（而且不报错）。
- **气体就是 `Scene_BG/马桶隐藏节点/气体大` / `气体小`**（原来归 Slot_02 的通马桶那组，`IdleMotion` 挂在它们身上）。它们在这次之前**没有 `UIOpacity`**，接线脚本补上了 —— 缺了就是 `null.opacity` 直接抛，抛在这条路上等于这一格的 `PIECE_SHOWN` 永远不抛。
  - ⚠️ **它们是同一对节点**：Slot_02 修好时气体照旧飘，Slot_05 修好时把它们淡掉藏起来，**藏了就不再回来**（`active = false`，`IdleMotion` 跟着停）。两格先后顺序不同会看到不同的中途画面（Slot_05 先修 → 后面通马桶那格就没有气体了），这是按需求来的，不是 bug。
- **`Slot_05.pieceId` 从 0 拉到了 4**：原来和 `Slot_01` 撞号，只靠 `Array.sort` 的稳定性兜着（退化成场景里的子节点顺序）。现在五个槽位是 `0/1/2/3/4`。**池里顺序肉眼无变化**，但 `pieceId = 4` 意味着它是**池里最后一块**、也是最后才可能被修的 —— `SceneBgSwap`（完成背景 → `END_SHOW`）和总修复扫光都按 `PIECE_SHOWN` 计数，而这一格整段要演「圆形扩散 0.6s + 摇晃 0.84s + 下落 0.9s ≈ 2.35s」，所以**它当最后一块时那一整套都会等它**（这是 `shown()` 那条链本来就在做的事）。
- ⚠️ **它前面还有一段圆形扩散**：`Slot_05.circleReveal` 是配上的（`repair()` 的第一个分支），所以从吸附那一刻起的顺序是「圆形扩散 → 摇晃 → 换图 + 下落」。「碎片被吸附后，碎片先有一个上下移动的动画」里的「先」指的是**扩散之后**。要让它变成吸附后立刻摇，得清掉这一格的 `circleReveal`。
- ⚠️ **`gasStagger × (团数 − 1) + gasFadeTime` 别超过 `mistDropTime`**（默认 0.35×1 + 0.45 = 0.8 < 0.9，刚好吃满）。超了的话最后一团还在淡、瓶身已经落到位并停住，两件事就脱节了；反之留太多余量会看到「气体淡完了瓶子还悬着不落」。收尾那一步是 `pending` 计数（下落 1 条 + 每团气体 1 条），**全到齐才 `hide()`**。
- 实测（编辑场景里手动调 `comp.play(slot, …)` 读摇晃链、再手动调 `comp['spray'](slot.showView, base, done)`，跑完 `stop()` + 逐项还原，`--no-save`）：
  - 摇晃链一共 **0.84s = 6 个单程 + 1 个回零**，逐段读到 `a: +8 / −8 / +8 / −8 / +8 / −8 / 0`，前六段 `sineOut` / `sineIn` 交替、收尾那段 `sineOut` —— 与「往左摆再往右摆算一次」对得上。
  - 换图后节点落在 `pos (-89.55, **122.58**)`（= 对齐位置 `62.585` 之上 **60.0px**，正是 `mistRise`）、`scale 1.265`、`size 230×222`、`frame 喷瓶`；下落那条 tween 是**一条** `.to(0.9s, { y: 62.5847 })`、`sineInOut` —— 单次、落到对齐位置。
  - `_live` = 3（下落 1 + 气体 2）。两团气体按世界纵坐标排序后：`气体大`（y=1096.5）**delay 0**、`气体小`（y=1028.6）**delay 0.35**，两条都是 `sineIn`、0.45s 淡到 0 —— **上先下后**。
  - `handles() = true`；编辑模式不 tick tween 所以 `done` 仍是 0（这条链的收尾只能在 Game View 里看）；还原后 `pos (0.57, 3.22)` / `scale 1` / `size 81×192` / `frame 喷瓶无喷雾` / 两团气体 `opacity 255 / active` 全部回到原样。
- ⚠️ **观感只能看 Game View**：编辑模式不 tick tween 也不 tick 调度器。要看的是：① 左右摇晃的幅度（8° 够不够像「在摇」、会不会晃出缺口）；② 换图那一下跳不跳（瓶身对没对上，对不上就微调 `mistOffset`）、抬 60px 再落会不会显得「蹦了一下」（不要这个起手就把 `mistRise` 填 0）；③ 下落的快慢、气体从上到下淡的先后是否看得出层次；④ 收起后画面上那块地方是不是干净的。


**动画期间空闲引导的计时器停住（2026-10-10）**

新增一对事件 **`GUIDE_HOLD` / `GUIDE_RESUME`**（`GameEvent` 里紧跟 `GUIDE_HIDE`），由 `PieceSlot` 抛出 ——
`repair()` 开头 `HOLD`、`spotDone()` 末尾 `RESUME`，**一格一段**，正好框住这一格从「吸附」到「动作演完」
的整条表现（圆形扩散 / 胶带 / 序列帧 / 通马桶 / 扫地全在里面）。

`GuideController` 里是一个**计数器** `_holds`，不是布尔：玩家能在上一格的动画还在飞的时候接着拖下一块，
两段动画会重叠（`repair()` 的 `HOLD` 是各自抛的）。

- `onHold` = `_holds++` + `unschedule(this.show)` —— 在等的那个计时器当场撤掉；`armIdle()` 也加了
  `_holds > 0` 的闸，所以动画期间怎么折腾（碰屏幕、拿起碎片）都不会重新起算。
- `onResume` = `_holds--`，减到 0 才 `armIdle()`。
- **是「暂停 + 重来」，不是「接着上次剩的时间」**：`scheduleOnce` 拿不到剩余时长，放行时按完整的
  `idleDelay` 重新起算。`idleDelay = 3s`、动画 0.5–2s 的量级下这点差别看不出来。
- `onLevelBuilt` 里把 `_holds` 归零 —— 重开关卡时不该背着上一关的欠账（归零漏了的话计数器一旦泄了就
  再也弹不出引导，而空闲引导正是 §8.1 第 6 条「无用户交互时不得超时」的兜底，不能哑）。
- **`hide()` 一行没改**：玩家拿起碎片时 `PIECE_PICK` 已经把引导收掉了，等 `repair()` 跑到的时候引导本来就
  不在显示，所以 `onHold` 不用再收一次（保证了「收」只由触摸那一条路负责）。
- ⚠️ **`_holds` 靠 `spotDone()` 配对归还**。任何让收尾动作的 tween 被 `stop()` 掉而不调回调的路径
  （`FlushAction` / `BroomSweep` 的 `onDisable`）都会少还一次 —— 那两条只在组件被禁用时走到，
  正常玩法碰不到；真泄了的话计数器不为 0，引导就不再弹，现象很好认。

**终局跳转：修满 3 个 / 修错 → 跳商店，之后点哪都跳（2026-10-10）**

新增 `assets/scripts/platform/EndgameCta.ts`（挂 `Canvas/UILayer/CtaLayer`，接线走
`tools/js/mount-endgame.js`，幂等，scene 上下文，跑完自动存盘）。两条终局：

| 触发 | 表现 | 跳转时机 |
|---|---|---|
| 修满 `winCount`（默认 **3**）个 | **不弹任何界面** | **这一格吸附成功的那一下**（`PIECE_REPAIRED`），不等它的揭晓动画 |
| `REPAIR_FAILED`（`Slot_04` 没达标就被修） | 先把 `CtaRoot/Fail` 整棵淡入（`failFadeTime`，默认 0.25s），再跳 | 等这一格的修复动画演完（`PIECE_SHOWN`）再弹、再跳 |

两条路跳完之后**玩法彻底冻结**：抛出 `GAME_OVER`，然后挂一条全局触摸监听 ——
玩家从商店回来点屏幕任意处就再跳一次（`onTap` 撤掉还没到点的那次 `scheduleOnce` 当场补跳）。

- ⚠️ **修满那条的时机 2026-10-12 改过**（原先是「等这一格的修复动画演完」）：`onRepaired` 里
  不再记 `_endIndex` 等 `PIECE_SHOWN`，改成 `scheduleOnce(finishWin, 0)` —— 吸附那一帧收摊，
  下一帧抛 `GAME_OVER`、再下一帧 `mraid.open`。理由是要「玩家拼上第 4 块就跳走」——
  揭晓动画（贴纸贴平 + 收尾脉冲）那零点几秒不想要了。那一格自己的贴纸动画照旧在后台演
  （没人听 `GAME_OVER`）。
  - ⚠️ **不能同期收摊（踩过，池里会凭空多一块揭着角的碎片）**：`PIECE_REPAIRED` 是
    **在 `PIECE_SNAP_SUCCESS` 派发中途**抛出来的，而 `GameLayer` 上三个组件的顺序是
    `SnapSystem → RepairSystem → DragController`（实测），也就是 **`EndgameCta` 被叫起来的时候
    `DragController` 还没收到那条事件、手上那块碎片还没 `consume`**。同期抛 `GAME_OVER` 的话
    `onGameOver` 会当「拖到一半该冻结了」处理 —— `sendHome` 把那块**送池子里去**（`StickerPeel`
    只认 `PIECE_SNAP_SUCCESS`/`PIECE_SNAP_FAIL` 复位，这里两条都没来，所以还揭着角），
    随后那条 `onSnapSuccess` 因为 `_entry` 已被清空直接 return，碎片就留池里了。
    推到下一帧之后那条派发整段走完（碎片回收、补位、下一屏、`REPAIR_PROGRESS` 与埋点），
    也不再依赖监听顺序。
- **失败路照旧等这一格露面**：`_endIndex` 记下终局那一格的槽位号，只有它的 `PIECE_SHOWN` 对得上
  才动手 —— 理由和扫光 / 完成背景一样，吸附那一 tick 就把事件抛了，画面还要演一两秒，
  而且失败界面得先淡入完（`failFadeTime`）才跳。
- **`REPAIR_FAILED` 是独立终局，不等凑满 `winCount`**，而且它比 `PIECE_REPAIRED` **先抛**
  （`PieceSlot.repair()` 里那句在前面）—— 所以「修满那一块恰好修错」时失败赢：`onFailed` 先把
  `_endIndex` 占了，随后那条 `onRepaired` 的 `_endIndex >= 0` 判空直接跳过。
- `winCount` **填 0 = 不按数量跳**，退回「全部修完 `END_SHOW` → 结束界面」那条老路
  （`CtaController` 那整套代码与场景照旧留着，见上面「结束界面」）。
- `onEnable` / `onDisable` 严格对称：三条 `EventBus` + `failButton` 的 `CLICK` + 全局 `input`。
  `Fail/btn` 自己也绑了 `CLICK` 跳商店（它认领自己那块矩形，落上去的触摸到不了全局那条）；
  `Fail/bg` 虽然铺满全屏但**没挂任何监听**，落在它上面的点击照样进全局。

**「点哪里都跳」是怎么做到的（关键机制，别再想别的辙）**

引擎的触摸派发链（3.8.8 源码核对过，和 §14 上面「点击碎片没反应」那条同一个根因）：

- `2d/event/pointer-event-dispatcher.ts:141` `dispatchEventTouch` —— 只要有**任一**节点处理器认领了
  这次触摸就返回 `false`；`input/input.ts` 拿到 `false` 直接 `break`，**全局 `input.on(TOUCH_START)`
  的监听器一个都收不到**。
- `scene-graph/node-event-processor.ts:638` `_handleTouchStart` **只看 `hitTest`**，跟「有没有注册
  监听器」无关 —— 所以光在 `DragController.onStart` 里加个标志位 early-return 没用。必须把监听
  `off` 掉：最后一个触摸监听被移除时（`:460` 那个 `_registerOffCallback`）引擎会把整个处理器
  移出派发表，这个节点这才不再认领。
- ⚠️ **「加一块全屏透明遮罩去接点击」这条路是死的**：节点处理器按**深度**排优先级，深节点在前 ——
  全屏遮罩挡不住池子里的 `content`（它比遮罩深），结果只会是「遮罩也没接到、全局 `input` 还是收不到」。

所以做法是**先让玩法那四处不再认领触摸，再挂全局监听**。四家各听 `GAME_OVER`（模块间只走
EventBus，§4）：

| 文件 | 做什么 |
|---|---|
| `gameplay/DragController.ts` | 把 `content` 上那四条触摸监听 `off` 掉（抽了 `unbindContent()`，与 `onDisable` 共用）；手上正拿着的那块 `sendHome(entry, true)` 弹回去 —— **不调 `release()`**，免得把 `PiecePool` 刚锁上的滚动又解回来（两条监听谁先跑不由这里决定） |
| `gameplay/PiecePool.ts` | 调现成的 `lockScroll()`（`scrollView.enabled = false`，`ScrollView` 在 `onDisable` 里注销自己那套触摸监听） |
| `ui/GuideController.ts` | 复用现成的 `onComplete()`（`_done = true` + `hide()`） |
| `platform/GameCta.ts` | 复用现成的 `hide()` —— 它是 `Canvas` 的**最后一个子节点**，压在 `UILayer`（失败界面在那儿）上面，不藏会盖住 |

全仓库的节点级触摸 / 点击监听只有这五处（`grep` 过 `assets/scripts/`）：`DragController` 挂在
`content` 上的四条、引擎 `ScrollView` 自己那套、`CtaController` 的 `End/btn`、`GameCta` 自己的
`CLICK`、`Fail/btn` 的 `Button`。前两处由 `GAME_OVER` 摘掉；`End/btn` 在 `End` 不激活时本来就不派发；
`GameCta` 被藏掉（且它自己那下也是跳商店）；`Fail/btn` 自己接得住。

- `jump()` 是 `bridge.openStore()` + 抛 `CTA_CLICK`（后者让 `AudioManager` 停掉全部音，与
  `CtaController.onClick` 同一套顺序：跳转排在埋点前面，`EventBus.emit` 不兜异常）。
- **`Fail` 补上了四边 Widget（2026-10-10）** —— 它原来**一个 Widget 都没有**（尺寸钉在场景里那个
  720×1280），所以横屏画布变宽（1770×1280）之后整棵 Fail 只剩中间 720px，`Fail/bg`（`纯白` 染成
  `rgba(0,0,0,98)` 的那层黑罩）自己那四边 Widget 是**对着父节点这个死框**对齐的，于是左右两边空着 ——
  就是「失败界面的背景没像结束界面那样铺满横屏」。`End` 一直有四边 Widget（`mount-end-card.js` 的
  `stretch()` 铺到 `End/bg` 为止），所以它横屏是满的。修法：`mount-endgame.js` 里加一段 `stretch(Fail)`，
  参数与 `End` 那套逐字一致（四边 0、`alignMode = ON_WINDOW_RESIZE`、`isAlignVerticalCenter/HorizontalCenter = false`），
  跑完落盘 `Fail` 的 `_alignFlags` 是 **45**（`TOP|BOT|LEFT|RIGHT`），与 `End` 相同。
  - ⚠️ `mount-endgame.js` 文件头原来写着「`Fail` 自己的 `Sprite` / 四边 `Widget` 都已齐」—— **那句是错的**，
    已改。别再照它推断 Fail 的接线状态。
  - 这层黑罩是**全屏遮罩**（半透明），铺满之后横屏下整个画面都会被压暗，这正是要的效果。

- ⚠️ **`verify-scene.js` 那两条只读检查**：`EndgameCta` 的失败界面必须挂 `UIOpacity`
  （缺了 `this._fade` 是 null，淡入整段被静默跳过，界面硬切一下才出来），以及 `Fail/btn` 的按钮配置
  （缩的必须是子节点，同结束界面那条）。
- 已实测（编辑场景里手动 `onLoad`/`onEnable` 五个模块，跑完全部还原、`--no-save`）：
  - `snap`（基线）干净：`contentTouch false`、`globalTap false`、Fail 隐藏、滚动开着、`GameCta` 开着。
  - 失败路：`REPAIR_FAILED(3)` 后连一个**别的**槽位的 `PIECE_SHOWN(0)` 都不动（`_endIndex 3` / `failActive false`）；
    `PIECE_SHOWN(3)` → `failActive true`、`failOpacity 0`（淡入起步）、`GAME_OVER` 抛 1 次，
    冻结四项全中（`scrollEnabled false` / `contentTouch false` / `gameCtaActive false` / `guideRootActive false`）、
    `globalTap true`；直接调 `onTap()` → `CTA_CLICK` 1 次、监听仍挂着（不只跳一次）。
  - 成功路：`PIECE_REPAIRED(0, 2)` 什么都不发生；`PIECE_REPAIRED(1, 3)` 只记下 `_endIndex 1` 不跳（`gameOver 0`，
    证明是等动画）；别的槽位 `PIECE_SHOWN(2)` 不动；`PIECE_SHOWN(1)` → `_over true`、`gameOver 1`、
    **`failActive false`**（成功那条不弹界面）、冻结四项 + `globalTap` 同上。
  - 碰撞：`REPAIR_FAILED(3)` + `PIECE_REPAIRED(3, 3)` 同一 tick → `_fail true`（失败赢），`PIECE_SHOWN(3)` 后 Fail 亮起。
  - `onDisable()` 后 `EventBus._map` 回到空、`contentTouch false`、`globalTap false`（注册对称）。
- ⚠️ **编辑模式下 `input.off` 是空操作**（`input.ts` 的 `EDITOR_NOT_IN_PREVIEW` 早退），组件 `onDisable`
  里那次注销不会生效 —— 写探针时得绕过 `input` 直接对 `cc.input._inputEventDispatcher._inputEventTarget`
  调 `off` 清残留，否则读到的是上一轮留下的监听。**运行期没有这个问题。**
- ⚠️ **观感只能开 Game View / 真机**：编辑模式不 tick tween 也不 tick 调度器，上面验的是「谁在什么时候
  抛、状态对不对」，不是「淡入顺不顺、跳不跳得出去」。真机上还要过一遍「**点哪都跳**」这条路径
  （编辑器里没有 mraid，`openStore()` 走降级路只打一行日志）。

**贴纸揭角：拿起碎片时一角折起来露出背面（2026-10-12，原型）**

照着 `原版试玩.html` 里那个「碎片被拿起像贴纸揭开一角」做的。**用的是两个 `.effect` + 一个组件**（不是一个 effect 一把梭）：

```
assets/effects/sticker-peel-front.effect   挂在碎片自己的 Sprite 上（customMaterial）
assets/effects/sticker-peel-back.effect    挂在碎片下一个同尺寸子节点 PeelBack 上
assets/scripts/gameplay/StickerPeel.ts     运行时建 PeelBack、算折线、推两个材质的 uniform
```

- **正面 `discard` 掉折线外侧那半**（`s = dot(world - 折线上一点, 折线法线) > 0` 就不要），**背面把折过去那半镜像出来**：
  顶点着色器里 `pos.xy -= 2.0 * s * peelLine.xy` 做镜像，**镜像前的世界位置存进 varying `orig`**。
  反射是仿射变换，插值到片元里 `orig` 正好是当前像素在反射下的原像 —— 于是片元里拿 `orig` 判「该不该画」
  （`s <= 0` 就是本该被裁掉的那半），UV 和顶点色则天然是对的，不用自己算。
- **背面是碎片下面一个子节点**（`PeelBack`），子节点画在父节点之上，所以折起来那半正好压住剩下的碎纸。
  它用**同一张 spriteFrame**、同尺寸、同锚点，`sizeMode = CUSTOM`，平时 `active = false`。
- **折线几何算在世界坐标里，不算在 uv 里**（同 `bg-reveal` / `repair-sweep` 那一套）：Sprite 的 `a_position`
  进顶点着色器时已经乘过 `node.worldMatrix`，片元里直接拿 `world` 投影，折痕在屏幕上就是一条直线；
  顺带绕开动态图集那条坑（只有拿 `uv0` 当坐标系时才需要 `frame.packable = false`）。
- `px` 按**碎片自己的世界矩形现算**（`contentSize × worldScale` + anchor + `worldPosition` 手算，
  **不用** `getBoundingBoxToWorld()` —— 这个碎片下面现在就挂着 `PeelBack` 和 `Glow`，那个 API 会把子节点并进来）。
  所以转屏、拿起放大、Layout 重排都不用重新接线：**拿起来会放大到缺口那么大，折线跟着 `worldScale` 一起长**，
  放大过程中折痕不会相对碎片缩小。`lateUpdate` 里重画（碎片在拖动 / 补位时每帧都在动，越晚读位置越贴），
  代价是最大一帧滞后，且只在 `r > 0` 那 0.5 秒回贴动画里有。
- **`r = 0` 时推的是一条退化线 `(0,0,0,0)`（法线取零向量）**，不是「角在哪儿」那版。零法线让正面任何像素的 `s`
  都是 0（一点不切）、背面 `s <= 0`（一点不画），「没掀」这件事就**和碎片此刻在哪儿、多大完全无关** ——
  否则 `apply()` 那一刻算出来的角会被 `Layout` 随后的一次重排带偏，正面的边上留一道细缝。
- **正面的边是硬切，不做羽化**：羽化会在折线上留半透明的接缝，底色从缝里透出来，看着像裂缝不像折纸。
- **背面 = 折线上一圈高光 + 往远端渐变成平色**（`peelParam`：x 高光带宽度按碎片高折成世界 px、y 强度）。
  `creaseGlow = 0` 就是一整块平色。靠 `discard + 平色` 做出纸背的立体感，没有几何起伏。
- ⚠️ **没做阴影**：参考实现里那层是 21×21 高斯模糊（441 次采样），0.2 秒的动画在低端 WebView 里太贵，
  而且它自己默认 `isUsingShadow = false`。要的话得单独写一遍晕影（按 `s` 衰减到折线外侧），别直接抄。
- **接线只有一处**：`tools/js/mount-sticker-peel.js`（幂等，scene 上下文，跑完自动存盘）把两个 EffectAsset
  赋给 `PieceFactory.peelFrontEffect` / `peelBackEffect`。组件本身**不挂任何场景节点** —— 碎片是运行时建的（`PieceFactory` 建节点时
  `addComponent(StickerPeel)`，和 `PieceGlow` 一样），所以没有别的口。⚠️ **两处一起决定**（池工厂里
  `addComponent` + `create()` 里 `apply()`），少任一处就是空引用或白建节点（同 §15 那条）。
- ⚠️ **`PeelBack` 排在 `Glow` 后面**：`create()` 里的顺序是「先亮边后揭角」，子节点后加的在上，
  折起来那半才盖得住光晕。调过来就会被亮边压在底下。
- 已实测（编辑场景里造一块碎片、手动把 `_state.r` 喂到 0.25 / 0.5 / 1 再调 `paint()`，跑完还原、`--no-save`；
  `Material.getProperty(name)` 才是 `setProperty` 塞进去的那个值，`pass._properties` 里存的是**效果默认值**）：

  | r | `peelLine`（388.27×400 的世界框，corner 左下） | 被掀的角 `s` | 远角 `s` |
  |---|---|---|---|
  | 1 | `(-0.707, -0.707, 276.223, 550.358)` | **+156.069**（裁掉 ✓） | **−401.321**（留着 ✓） |
  | 0 | `(0, 0, 0, 0)` | 0 | 0 |

  `156.069 + 401.321 = 557.39 = 0.707 × (w + h)`（正好是角到对角的跨度，`liftRatio = 0.28` 就是推过它的 28%）；
  被掀的角镜像落到 `(386.58, 660.72)`，在矩形里面；折线是 `x + y = 826.581`，从左边缘 `(165.87, 660.71)`
  切到底边缘 `(386.58, 440)` —— 掀掉的角三角形约占碎片 **15.7%**。`peelParam = (88, 0.5, 0, 0)`（88 = 400 × 0.22 ✓）、
  `peelTint = (0.6, 0.6, 0.6, 1)` ✓，复位后正面回到 `(0,0,0,0)` ✓。
- 两个 effect 都编译通过（`library/77/…` / `library/3c/…`，各带 glsl3 + glsl1 两套、`PeelData` 块、
  `peelTint` 带 `editor: { type: color }`）；`verify-scene.js` 无新增告警、`npx tsc --noEmit` 零报错；
  场景里 `peelFrontEffect` / `peelBackEffect` 的两个 uuid 与 `stickerPeel: true` 都已落盘。
- ⚠️ **本轮 `run_project_preview` 是好的**（`running: true` / `mode: gameView`，MCP 端口 **24148**），
  起了一次干净的 Game View：`[Probe]` 那行打出来了、**零 error** —— 正面材质从建池那一刻就每帧在画
  （程序编得过），但**背面那一半只有真拿起来才第一次画**（GL 程序在首次渲染该 pass 时才编），
  所以「拾起来有没有露出灰底 + 折线那道高光」得你在 Game View 里拖一块碎片眼过一遍。
- ⚠️ **踩到一个跟这个功能无关、但会让人以为「Game View 坏了」的坑**：探针脚本在**编辑器内存里的场景**
  造了碎片节点后没清干净（`destroy()` 在编辑模式下不一定真跑完），而 **Game View 跑的就是编辑器内存里那个场景** ——
  那两个残留碎片上的 `PieceGlow`（`_view` 为 null）在 `GameEntry.start()` 的
  `EventBus.emit(ORIENTATION_CHANGED)` 里当场抛（`PieceGlow.ts:106`），异常穿出 `emit` 把后面的
  `levelFactory.build()` 一起带停 —— **现象是 Game View 里什么都没有、画面上也看不出错**，日志里才有一行
  `Cannot read properties of null (reading 'node')`。清掉残留、重开预览就正常了。**探针脚本已删**
  （`probe-sticker-peel` / `probe-peel-store` / `probe-peel-uniforms` / `probe-leftovers` / `clean-leftovers`）；
  以后写这类探针，收尾一律 `try / finally`，跑完确认 Canvas 下没有多出来的节点再开 Game View。
- 想关掉整条：`FeatureFlags.stickerPeel` 取消勾选（关掉后碎片连 `StickerPeel` 组件都不建）。
  手感 / 外观全在 `PieceFactory.peelParams` 上（§16，**全局那份**；某一格要另配见下一节）：`corner` 换角、
  `liftRatio` 掀多大、`liftTime` / `stickTime` 快慢、`backColor` 底色、`creaseWidth` / `creaseGlow` 折线那道高光。

**揭角参数按格配（2026-10-12）**

每个槽位能单独定这一格碎片的揭角姿势（方向 / 大小 / 快慢 / 颜色），不勾的槽位仍然继承全局那份、行为一字不变。

- `PieceSlot` 上是**「布尔 + 实例」两段式**：`peelOverride`（本格单独配揭角）+ `peelParams`（揭角参数（本格））。
  取值的唯一入口是 getter **`PieceSlot.peel`** —— 没勾是 `null`，调用方（`PieceFactory.create` / `StickerApply.play`）
  退回自己那份全局 / 组件值。
  - **为什么是两段式**：Cocos 3.8 的 Inspector 对 `@property(数据类) = null` 只显示一个空槽、**没有「新建」入口**，
    点不开；给默认实例就必然每格都有值，需要布尔来表达「继承」。Inspector 也没有逐属性条件可见。
- **两个材质不按格配**，留在工厂上：`PieceFactory.peelFrontEffect` / `peelBackEffect`。池里的碎片节点是复用的，
  `StickerPeel.build()` 只在第一块建节点时跑一次（`if (!this._frontMat)`），逐格换材质会「先到先得、后来不生效」。
  所以 `PeelConfig` 现在是**纯值类**，可以放心按格复制 —— 分工同工厂上的 `glowEffect`（材质）+ `glowParams`（值）。
- ⚠️ **覆盖是「全有或全无」**：`new PeelConfig()` 的标量是**类的默认值**（`corner (0,0)` / `liftRatio 0.28`），
  **不是**全局那份。手勾那个布尔会静默把方向 / 大小 / 快慢 / 颜色全改掉。想从全局那组起步就重跑
  `tools/js/mount-slot-peel.js`（幂等，把全局那 7 个值整份克隆进每格再翻布尔；**已经勾上的格子原样保留** ——
  它是「给每格一个起点」，不是每次跑都复位，同 `mount-audio.js`）。当前三格都已物化，值 = 全局那份。
- `PieceFactory.create()` 的入参是结构化接口 **`PieceSource`**（`pieceFrame` + `peel`），不是 `PieceSlot` ——
  `level/` 本来就 import `gameplay/`，反过来引一次就成环（同 `RevealHost` 那条）。`PieceSlot` 结构上直接满足它。
- **改完某一格不用重跑任何接线脚本**：贴纸贴平那边现读本格那份。只有**全局那份**改了才要重跑
  `mount-sticker-apply.js`（而那只影响**没勾覆盖**的槽位，见下一节）。

**修复贴纸贴平：修好时那一角是翘着的，再按平贴到缺口上（2026-10-12）**

新增 `assets/scripts/gameplay/StickerApply.ts`（挂在 `EffectLayer` 上，和 `RepairSweep` / `RepairReveal` / `CircleReveal`
并列，全局一个实例），每格的可选口是 `PieceSlot.stickerApply`，总开关是 `FeatureFlags.stickerApply`。
就是**揭角反着演**：那一格的修复图整张直接出现在缺口上、一角还翘着（翘起来那半露的是贴纸背面），
再把折线从那个角推向对边、一路按平 —— **和拿起来那一角接得上**（同一个角、同样的翘起比例、同样的背面颜色）。

```text
assets/effects/sticker-peel-front.effect   挂在修复图自己的 Sprite 上（customMaterial）
assets/effects/sticker-peel-back.effect    挂在修复图下一个同尺寸子节点 ApplyBack 上
assets/scripts/gameplay/StickerApply.ts     运行时建 ApplyBack、推两个材质的 uniform
```

- **一对材质两用**：`repair()` 里要演的正是「r 从 1 走到 0」（`StickerPeel` 是 0→1），同一个折线公式、
  同一份 effect，所以折线几何那段抽成了 `StickerPeel.ts` 里导出的 `peelLine(node, corner, amount, …)`，
  两边共用（**别复制一份到 `StickerApply` 里改**，改一处漏一处就是两边对不上）。
- **姿势现读 `PieceSlot.peel`**（那一格单独配的揭角）：配了就用它的 `corner` / `liftRatio`(→翘起比例) /
  `stickTime`(→贴平时长) / `backColor` / `creaseWidth` / `creaseGlow` —— 「手上翘着的角」和「缺口上翘着的角」
  天然是同一个姿势，**改完某一格不用重跑任何脚本**。没配（`null`）才走组件自己那 6 个字段。
- **组件自己那 6 个字段是接线脚本从全局 `PieceFactory.peelParams` 抄过来的**（`corner` / `openRatio = liftRatio`
  / `applyTime = stickTime` / `backColor` / `creaseWidth` / `creaseGlow`）—— 它是**非覆盖槽位的回落值**，
  所以全局那份改了要**重跑一次 `mount-sticker-apply.js`**（`verify-scene.js` 的 `checkPeel` 会报这两处不同步）。
  当前场景里这组值是 **`corner (0, 0.5)`（左中）、`openRatio 0.3`、`applyTime 0.5`、`backColor (153,153,153)`**。
- ⚠️ **姿势必须记在 `ApplyHandle` 上、不能每帧现读组件字段**：`paint()` 由 tween 每帧推着跑，多格同时
  在飞时各自的覆盖不一样，读组件就是互相踩 —— 所以 `play()` 时把解析出来的 4 个标量（`corner` /
  `openRatio` / `creaseWidth` / `creaseGlow`）快照进句柄，`paint()` 只读句柄。
- **破损图在吸附那一刻就被收掉（2026-10-12 改）**：`repair()` 里这一支先 `brokenView.node.active = false`
  再 `stickerApply.play(this, this.shown)` —— 修复图整张从第一帧起就铺满缺口、翘起来那个角露的是贴纸背面，
  底下不需要垫图。**和圆形扩散不是同一条约定了**：圆形扩散仍然垫着（`play(this, this.covered)`，
  扩满由 `covered()` 收掉再 `shown()`），别把两处一起改。
- **背面节点是运行时建在修复图下面的子节点**（子节点画在父节点之上，翻过去那半正好压住剩下的贴纸）：
  `type` / `sizeMode = CUSTOM` / `trim` 全抄正面那个 Sprite，**顺序不能反**（先抄再赋 `spriteFrame`、
  最后 `setContentSize`），否则框会被贴图尺寸改写、翻转过去的 quad 对不齐。同 `mount-game-cta.js` 那条。
- **收摊要显式销毁材质**：`stop()` 里 `customMaterial = null` → `mat.destroy()` → `ApplyBack.destroy()`
  → `backMat.destroy()`。引擎只销毁 `MaterialInstance`，shared material 没人管（同 `RepairSweep` 那条）。
- ⚠️ **`destroy()` 是延后到帧末的**：探针里 `stop()` 之后立刻 `getChildByName('ApplyBack')` **还读得到**
  （编辑模式不 tick，那个节点永远不会被真正摘掉）。这不是没销毁，别据此改代码。
- **和圆形扩散只能填一个**（两个都往同一张修复图的 Sprite 上挂材质，只有一个 `customMaterial`）：
  `repair()` 里贴纸排在前、圆形扩散在后，两个都填时**只有贴纸会演**；`verify-scene.js` 的 `checkReveal`
  会把这种配置报出来。接线脚本接一格就顺手清一格 `circleReveal`。
- 接线走 `tools/js/mount-sticker-apply.js`（幂等，scene 上下文，跑完自动存盘）：挂组件、两个材质口从
  `PieceFactory.peelFrontEffect` / `peelBackEffect` 抄（**和揭角是同一对 effect**）、全局那组调参一起抄、
  `SLOTS` 里的槽位指向它并清掉自己的 `circleReveal`。
  ⚠️ **每跑一次都会把调参重新写一遍**，在 Inspector 里改过再跑会被复位（同 `mount-spray-action.js`）。
- `verify-scene.js`：`wanted` 加了 `StickerApply: ['frontEffect', 'backEffect']`，另加只读的 `checkReveal`。
- **已实测**（编辑场景里对 `Slot_01` 手动 `slot.repair(0)`，跑完 `stop()` + 逐项还原、`--no-save`）：
  `handles() = true`、`repair()` 返回 true、`_live` 有 1 条、`ApplyBack` 建起来且与正面**同一张 spriteFrame**、
  `Broken` **仍 active**（⚠️ 这是改动前测的；现在吸附那一刻就收了）、修复图亮起 `customMaterial` 挂上；三段折线读数：
  `r=1` → `(-1, 0, 208.842, 734.545)`（法线指向角、折线在 30% 处）、`r=0.5` → 折线退到 **164.914**、
  `r=0` → **`(0,0,0,0)`**（退化线，一点不切）；背面材质拿到的 `peelLine` 与正面**逐位相同**、
  `peelParam = (67.41, 0.5, 0, 0)`（67.41 = 修复图世界高 × 0.22）、`peelTint = (0.6, 0.6, 0.6)` ✓
  （153/255）；`stop()` 之后 `_live` 空、`customMaterial` 回 null —— 也就是收尾那条链跑通了。
  2026-10-12 只改了「破损图什么时候收」（`covered` → 吸附即收 + `shown`），其余一字未动、未重测。
- ⚠️ **观感只能开 Game View 拖一块碎片眼过一遍**：编辑模式不 tick tween 也不 tick 调度器，上面验的是
  「谁在什么时候抛、折线算得对不对、收不收得回来」，不是「贴上去顺不顺」。要过的是：① 贴上那一刻的翘角
  和松手前手上的翘角**是不是同一个姿势**（**配了本格揭角的槽位天然一致**；对不上只会发生在没勾覆盖的
  槽位，那就把全局那份和这里的组件值对齐、重跑 `mount-sticker-apply.js`）；
  ② 0.5s 推平的速度；③ 折线那道高光和背面那层灰看着立不立体（`creaseGlow` / `backColor`）。
- 想关掉整条：`FeatureFlags.stickerApply` 取消勾选 —— 配了本组件的槽位立刻退回它自己那套
  （槽位没配 `circleReveal` 的话就是「破损图收掉、修复图直接出现」）。

**「贴纸贴平 + 圆形扩散」为什么只能二选一（2026-10-12）**

有人把 `FeatureFlags.stickerApply` / `circleReveal` 两个开关一起开、又给 `Slot_01` / `Slot_02` 两格同时填了
`stickerApply` 和 `circleReveal`，结果**只演贴平、扩散一次都不出现**。这不是开关的问题，两条都不该一起填：

1. **控制流直接短路**：`repair()` 里贴平那一支排在前面、命中就 `return true`，圆形扩散那段代码这一次
   根本不执行（两边的 `@property` tooltip 都写了「只能填一个」）。
2. **结构上就是互斥的**（这才是根因，光调顺序治不好）：两个都要往**同一张修复图的 Sprite** 上挂
   `customMaterial`（一个 `sticker-peel-front`、一个 `bg-reveal`），而一个字段只能有一个材质；而且两个
   对「破损图」的要求正好相反 —— 贴平第一句就 `hideBroken()`（翘角露的是运行时建的背面节点，底下不用垫图），
   圆形扩散恰恰要破损图**留着垫在底下**（`bg-reveal` 圆外 alpha 就是 0，扩满才由 `covered()` 收）。

想两个都要，**不能靠接在贴平后面再演一遍扩散**：扩散是「揭晓」，它得有东西可揭，而贴平演完那一刻修复图
早就完整铺好了 —— 非要接就只能把破损图放回原位再盖一次，观感是「贴好 → 弹回破损 → 再从中心糊上」。
所以这一轮的做法是**把收尾那一下做成贴平自己的最后一环**（下一节），不去碰圆形扩散。
场景里 `Slot_01` / `Slot_02` 那两处 `circleReveal` 已经清掉（死配置，留着只会让人以为它在生效）。

**贴纸贴平的收尾脉冲：缩小淡出 → 放大淡入（2026-10-12，同日按反馈从「放大→缩回」改过来）**

贴平把折线推平之后**不直接收摊**了，紧接着加一下：修复图先缩一点、同时淡下去，再放大回原尺寸、
把不透明度收回来。它不揭任何东西 —— 纯粹是「贴好了」那一下的反馈，所以和圆形扩散不冲突、也不用抢，
是本组件流程末尾的一段。

```text
settle()   推平到位 → peelOff() 收掉贴纸那套 → runPulse()
peelOff()  收起贴纸那套（材质 / ApplyBack），正常演完和 onDisable 半路收摊都走它
runPulse() tween state.g 0 → 1 → 0：缩放 1 → 缩小比 → 1，alpha 255 → 最低 → 255
endPulse() 缩放与颜色还原、ApplyPulse 与材质销毁，跑完才调 onApplied
```

- **改版原因（2026-10-12）**：第一版是「放大 1.06 再缩回 + 边缘高亮」，实际看着不好 —— 放大那一下像是在
  「弹一下」，贴平已经是一个往前推的动作，再顶一下读起来是重复的。改成**先缩再涨**：等于「贴上去 →
  按平 → 一沉 → 回到位」，和「按」这个动作同向。
- **不透明度走 `Sprite.color` 的 alpha，不走 `UIOpacity`**：不用往这一格上加组件、也不用管它本来有没有
  `UIOpacity`（`swapFadeTime` 那条用的是另外两个节点上的），收摊时把原色还回去就行。每帧改的是同一个
  `Color` 实例（`live`），不重新 new。
- **半程各一条 `sineInOut`**：`g` 0 → 1 是「缩 + 淡出」，1 → 0 是「涨 + 淡入」，中间那一瞬间最暗最小。
  ⚠️ `pulseMinOpacity` 默认 **0** ⇒ 这一格会整个消失一下。**破损图在吸附那一刻就收了**，所以淡到 0
  的那几帧这一格是空的（露 `Scene_BG`）。按当前 0.1s / 0.1s 实测，alpha 低于 24 的窗口约 **0.04s**
  （约 2–3 帧），想看得到「沉一下」但不想露底就把 `pulseMinOpacity` 调到 60 往上。
- **边缘高亮（`pulseEffect`，可留空）跟的是 `g` 自己那条 0 → 255 → 0 的包络** —— 两端都不亮，跟着画面
  一起收干净。**不能让它的亮度跟「修复图的不透明度」走**：那样收摊那一帧它正好是满亮，节点一销毁就是
  「啪」地掉一下。材质复用 `piece-glow.effect`（`assets/effects/piece-glow.effect`，uuid `c2dbdffc-…`）——
  就是拖动亮边那一份：轮廓外八方向取最大 alpha 出羽化光晕 + 紧贴轮廓内侧一圈高光。**没新写材质**，
  也没动既有的四个 effect。⚠️ 它只在**淡出那半程**最亮，那一刻修复图是透明的 —— 看到的是这个部件轮廓
  的一圈光。不想要就把 `pulseEffect` 清空（= 只做缩放和淡出淡入，不用再加开关）。
- **高亮节点比修复图大一圈**，`uvScale` 把 uv 缩回修复图自己的坐标系 —— 和 `PieceGlow.apply()` 同一套路数
  （贴着 quad 边的那段轮廓不留余量会被裁平）。区别只有一处：`PieceGlow` 那个 `Glow` 子节点的父节点锚点
  恒为中心，这里父节点是 `Repaired`，**锚点得自己算**：子节点 `(0,0)` 落在父节点锚点上，所以位置是
  `(0.5 - anchorX) * w, (0.5 - anchorY) * h`。
  ⚠️ **`setContentSize` 必须排在赋 `spriteFrame` 之后**：`sizeMode = CUSTOM` 的 Sprite 一换帧就把节点尺寸
  改成贴图尺寸，先设的那次会被冲掉（同 `PieceGlow.apply`）。第一版就是栽在这儿 —— 高亮节点和修复图
  一样大，外圈光晕整片被裁掉。
- ⚠️ **`onApplied()` 被推后了 `pulseDownTime + pulseUpTime`（当前 0.2s）**：这一格「露面」（`PIECE_SHOWN`）
  现在等脉冲跑完才抛 —— 和收尾动作（通马桶 / 扫地）接在 `shown` 前面是同一个约定，扫光和总修复计数都按
  「露面」计数，不推后的话最后一块修好时脉冲会被完成背景盖掉。
- **半路收摊不回调**：`onDisable` 里 `peelOff()`（不回调）+ `endPulse(node, false)`（不回调），和原来
  `stop(node, false)` 的语义一致 —— 那一格算没露面，别去推进度、别触发总修复。缩放和颜色都会还原成
  编辑器里那两个值。
- 接线口在 `tools/js/mount-sticker-apply.js`（`if (!apply.pulseEffect)` 才赋，重复跑不会把值改成别的；
  它**只管材质口**，六个调参是各人自己在 Inspector 里定的）。
- **已实测（2026-10-12）**：编辑模式主循环不跑，是用 `cc.TweenSystem.instance.ActionManager.update(dt)`
  手动 tick 出来的读数（`--no-save`）—— 0.02s 一步，`ratio / alpha / 高亮透明度`：
  `0 → 1 / 255 / 0`、`0.06 → 0.952 / 167 / 88`、`0.12 → 0.86 / 0 / 255`、`0.18 → 0.952 / 167 / 88`、
  `0.22 → 1 / 255 / 0`；`endPulse` 之后缩放回 `(1,1,1)`、颜色回 `rgba(255,255,255,255)`。曲线对称、两端
  归位，就是上面那张表。
  ⚠️ 注意 `ActionManager.update` 第一次调用有一拍的开销（tween 要先 start），所以「t=0.12 到谷底」对应的是
  `pulseDownTime = 0.1` 走完，不是 0.12。
- ⚠️ **观感还得开 Game View 眼过一遍**：要过的是：① 缩小比 0.86 在六张贴图上是不是都「沉得住」；
  ② 淡到 0 那一下的露底看不看得出来（觉得空就把 `pulseMinOpacity` 调上去，或根本不要淡到 0）；
  ③ 贴平推完到脉冲起之间**没有空档**（`applyTime` 0.5s 推完立刻起才对）。
- 接线脚本跑完 `refresh.js` 那两次都返回 `ok: false`，但类**确实重载了**（新字段 / 新默认值都读得到）——
  `refresh-asset` 那条消息的返回值不可靠，别拿它当判据；判据是「去场景里读一眼新字段在不在」。

**⏳ 交审前必须确认（两条，都是明确要求的副作用）**

1. **成功那条也是「无用户交互自动跳转」**：第 3 块动画演完自动 `mraid.open()`，玩家一个字没点。
   AppLovin 审核可能把自动跳转算违规项（原来只有失败那条是自动的，现在成功这条也是）。
2. **失败界面那颗按钮上现在写的是 `TRY AGAIN`**（`Fail/btn/Img/Text` 的 Label），但点下去跳的是商店。
   文案要不要改成 `PLAY NOW` 之类，得你定 —— 那是文案侧，我没动它。
3. **失败之后没锁输入**这条已经解决了（`GAME_OVER` 那套冻结），但**成功那条冻结时画面停在游戏画面上**
   （不弹任何界面），只靠全局监听跳 —— 这是按需求来的，不是漏了。

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

---

## 拼图框跟着底图比例走 + 四边对齐 Widget 在父节点改尺寸后会「自己长」（2026-10-14）

换 1010 那批美术时，拼图区底图从 `拼图.png`（569×840）换成 `捉奸黑白.png`（976×1221），
`Scene_BG` 一挂上去就被横向压扁约 15%，而且在 Inspector 里**怎么调都没反应**。两个独立的原因：

**一、框和图的比例本来就不一样，不是「调一下缩放」能解决的。**

`GameLayer` 是拼图区的硬边界（`569×840`，比例 `0.677`），`Scene_BG` 是 `sizeMode CUSTOM` + `type SIMPLE`，
所以它是**整张图硬掰进框**。底图 `976×1221` 的比例是 `0.799` —— 差 15%。旧的 `拼图.png` 正好是 569×840，
所以以前 1:1 严丝合缝、什么问题都没有，换图之后才暴露。

定案（用户选的）：**改框适配图** —— 框高保持 840，宽改成 `840 × 976/1221 = 671.45`（画布 720，左右各留 24px）。
三个节点一起钉成 `671.45×840`：`GameLayer` / `Scene_BG` / `完成背景`。
- 改这**三个**是因为 `SceneBgSwap.revealView`（= `完成背景`）要求是「本节点下的一个**同尺寸**子节点」。
- 换一张比例的底图就要一起改这三个数，另外 `tools/js/mount-adapt.js` 里 GameLayer 那个 `unanchor(…, 671.45, 840)`
  也得跟着改（写死了，重跑会覆盖回去）。

**二、`Scene_BG` / `完成背景` 上那两个「四边对齐 + `AlignMode.ALWAYS`」的 Widget 是个雷。**

`GameLayer` 的尺寸一改，这两个节点就开始**自己长**：实测 `Scene_BG` 566 → 881 → 986、
`完成背景` 986 → 1932，**每帧都在变**（`完成背景` 的 inset 被推到 -630.3，尺寸正好等于 `671.45 + 630.3×2`
—— 它是**照着被推歪的 inset 一致地在算**，坏的是 inset 本身）。

机制：节点 `SIZE_CHANGED` 时编辑器按**旧尺寸**把 inset 反推一遍，`ALWAYS` 再按新 inset 重排一次，
两者互相喂 → 正反馈。**这在 Inspector 里表现为「拖框/改尺寸都被弹回去」，也就是用户说的「调缩放没用」。**

佐证：`Bg_Sprite`（同样是四边对齐 + inset 0）一直稳，因为它的父节点 `BackgroundLayer` 尺寸**从没变过**。
所以这不是「四边对齐不能碰」，是「**父节点尺寸不能变**」。

修法照 §7.1 已有那套记号：**Widget 留着、四条边全不勾、尺寸钉死**（`Scene_BG` / `完成背景` 现在 `alignFlags = 0`）。
清完对齐边之后 30 秒内三个节点纹丝不动。`verify-scene.js` 只对 `GameLayer` / `PiecePoolLayer` /
`UILayer/ProgressLayer` 查「不许贴边」，`Scene_BG` 不在它管范围内，改完没有新报错。

⚠️ **还没验的部分**：① 编辑器场景面板看不出撑满效果，横竖屏下的实际观感要开 Game View 过一眼；
② 横屏两栏（`LandscapeLayout`）里拼图列现在比原来宽 102px（`colW = max(拼图区, 进度条) × scale`），
`colW` 变大之后两栏总宽有没有顶到画布边、右边竖栏还有没有地方，得过一次转屏；
③ `Slot_01` 还是按旧框（569 宽）摆的位置，**整关的槽位要按新的 671.45×840 重摆**。

---

## 音频：音阶序列 + 带间隔的常驻循环 + 胜利风铃（2026-10-14）

三条需求：①修好一块换一个音阶（1-6）；②全部修完响风铃；③女主哭泣常驻循环、带渐入渐出、
遍与遍之间留一段静默。顺带把原来那条 `PIECE_SNAP_SUCCESS / 贴纸.mp3` 换掉了。

**为什么不能只往 `cues` 里加条目**：`AudioCue` 原来一条 = 一个 `clip` + 一个事件，
「按顺序播一串」和「循环但每遍之间留静默」都不是它表达得出来的。加了两格（都在 Inspector 里）：

| 新字段 | 意思 | 实现要点 |
|---|---|---|
| `顺序音效列表`（`sequence`） | 非空时按顺序播，每触发一次取下一格，一轮放完回到第一条；这条的「音效」作废 | `Channel.seq` 游标，`nextClip()` 里 `(seq + 1) % length`。**不是随机、不是一次性洗牌** —— 就是 1→2→…→6→1 |
| `循环间隔`（`loopGap`） | 常驻音一遍放完先静这么久再从头起播。0 = 老行为（引擎的无限循环） | 见下 |

**带间隔的循环为什么绕一下**：引擎 `loop = true` 时**永远不抛 `ENDED`**（`_registerListener` 里
`player.onEnded` 才发那个事件），所以「每遍之间插静默」只能把 `loop` 关掉、自己接下一遍。
做法是听 `AudioSource.EventType.ENDED`（引擎在 `audio-source.ts` 里 `this.node?.emit(ENDED, this)`，
**第一个参数就是哪个 source 放完的**）→ `scheduleOnce(playCue, loopGap)`。因为有这个，切后台
（`pause()`）那一遍不抛 `ENDED`、回来 `play()` 接着放完才接着排，**`onMute` 一行都不用改**。

- ⚠️ 所有声道**挤在同一个宿主节点** `Canvas/AudioChannels` 上（一条一个 `AudioSource` 组件），
  所以 `ENDED` 只在 `build()` 里挂**一条**监听，回调里按 `ch.source === source` 认领 —— 别按声道各挂一条。
- **末尾那一段渐出靠时长倒推**：`clip.getDuration()` 拿时长，在 `duration - fadeOut` 排一次 `fade(1→0)`，
  正好淡到这一遍结束。**这个时长是真有的** —— 导入的音频 JSON 里带 `_duration`
  （实测 `library/ed/ede486ed-….json` 写着 `"_duration": 6.974688`，音阶 1 是 `0.444082`），
  `getDuration()` 先读它、读不到才回落到 `_meta.duration`。取不到就只丢渐出、不丢间隔（间隔靠 `ENDED`，与时长无关）。
- `onDisable` 补了一句 `unscheduleAllCallbacks()`：循环那一遍是靠 `scheduleOnce` 排的，
  禁用了还留着到点就会打到已经拆掉的声道上。

**风铃为什么得开一个「不随关场停全部停」的口子**：它绑 `LEVEL_COMPLETE`，而这一下和跳商店是**同一拍的事**
（见下面 winCount 那条）—— 下一帧 `jump()` 里 `mraid.open()` + 抛 `CTA_CLICK`，`AudioManager.stopAll()` 当场停全部，
风铃只响得到一帧。所以把「终局之后仍然要放的那两条」提成一个模块常量
`POST_OVER = [END_DROP, LEVEL_COMPLETE]`，`stopAll()` 跳过它们、`playCue` 的 `_closed` 闸门也放它们过。
原来的 `END_DROP` 特例就是同一个意思，这次只是从「内联的一个 `!==`」提成了有名字的列表。

**终局线 `winCount` 4 → 6**（`mount-endgame.js` 里写死，那个脚本是 `EndgameCta` 的接线脚本）。
原来修满 4 格就跳，`LEVEL_COMPLETE`（总修复事件）**结构上永远抛不出来** —— 风铃没地方挂。
改成 6 = 槽位总数，也就是玩家标的那条「全部修完再响」。连带两件**你得知道**的：

1. **结束界面从这一轮起走得到了**：最后一格的 `PIECE_SHOWN` 到了之后 `SceneBgSwap` 扩散完抛 `END_SHOW`，
   `CtaController` 随即把 `CtaRoot` 亮起来。⚠️ 它**排在跳商店之后**（第 6 格吸附的下一帧就 `mraid.open`），
   玩家从商店回来才会看见 —— 而 `End/bg` 还是**纯白 4×4**（见 CLAUDE.md 现状速查），那一屏现在是白底。
2. 埋点的三条 `PASS_*` 触发点跟着挪到第 2 / 3 / 5 格（分母 6），`ENDCARD_SHOWN` 也从「走不到」变成走得到。
   `PlayableAnalytics` 是运行期现读 `winCount` 的，代码一行没改。

**接线**：`tools/js/mount-audio.js` 整个重写成「按激活事件 / 音效认条目，认到的原样留着、只补缺的那几条」，
跑完 `Canvas/AudioManager.cues` 是这四条：

| 激活事件 | 音效 | 音量 | 渐入渐出 | 间隔 |
|---|---|---|---|---|
| `NONE` | 空灵背景 | 0.6 | 0.3 / 0.3 | 0 |
| `PIECE_SNAP_SUCCESS` | **音阶 1-6（顺序列表）** | 1 | 0 / 0 | 0 |
| `NONE` | 女主哭泣 | 0.8 | 1 / 1 | **3** |
| `LEVEL_COMPLETE` | 风铃 | 1 | 0 / 0 | 0 |

`verify-scene.js` 的 `checkAudio` 跟着改了：原来「没拖音效就报」会把顺序列表那条误报成空，
现在 `!c.clip && !c.sequence.length` 才报。

**实测**（编辑场景跑探针：`onDisable` / `onEnable` 重建 → 直接打各条的 `onStart`，跑完还原 + `--no-save`）：

- 声道 4 条齐全：`空灵背景 / 音阶列表×6 / 女主哭泣 / 风铃`；
- 解锁后 `空灵背景 loop=true gapLoop=false`、`女主哭泣 loop=false gapLoop=true`（`gain=0` 是渐入的起点，
  编辑模式不 tick `TweenSystem`，和 §14「音频」那次一样）；
- 连打 7 次音阶那条拿到的是 `音阶1 音阶2 音阶3 音阶4 音阶5 音阶6 音阶1`；
- 风铃那条 `clip=风铃 / live=true / loop=false`；`onEnd()`（= `END_SHOW` / `CTA_CLICK` 走同一条）之后
  `_closed=true`、**只剩风铃还 live**（两条常驻都被停了）；
- `verify-scene.js` 的 missing 与改动前逐字一致（还是那 4 条已知空壳），没有新报错。

⚠️ **还没验的部分**：①「听感」一概验不了 —— 编辑模式的 web 播放器不真播，`ENDED` 永远不会来，
所以**「一遍放完 → 静 3 秒 → 再哭」这条循环路在编辑器里没跑过一次**，得开 Game View 听；
② 末尾渐出的起点是按时长算的，如果哪个 mp3 的 `_duration` 与实际时长对不上，渐出会早一点或晚一点；
③ 四条音频全进了 `assets/recourses/audio/`，单文件产物的体积门禁（§8.5）与「mp3 走 XHR 能不能解码」
照旧没跑过 release 构建。

### 按钮按压音效：为什么听 `TOUCH_START` 而不是 `CTA_CLICK`（2026-10-14 当天追加）

需求是「按下按钮也加一个音效，使用 `button_down`」。这条**没有走 EventBus**，是为数不多
绕开「只在监听侧加」那条规矩的地方 —— 因为**没有可听的现有事件**。

- `CTA_CLICK` 是三颗按钮唯一的事件（`GameCta.onClick` / `EndgameCta.jump` / `CtaController`），
  但它是 **`Button.EventType.CLICK` 派出来的，也就是松手那一下**；更要命的是两个 handler 里
  **`bridge.openStore()` 都排在 `EventBus.emit(CTA_CLICK)` 前面**。所以绑它 = 商店已经在开了才起播
  —— 真机上一声都听不见（`mraid.open` 让广告转 `hidden`，`onMute` 立刻 `pause()`）。
- 于是 `AudioEvent` 里加了唯一一个**不是 `GameEvent` 的选项** `BUTTON_DOWN`，
  `AudioManager.buttons`（节点数组）是它的落点，`build()` 里给每个按钮挂 `Node.EventType.TOUCH_START`
  → `playCue()`。**按下去那一刻就响，松手前那一整段都在播。**
- 同一个 handler 里先 `unlock()` 再 `playCue()`：玩家第一下就点 CTA 的话，
  全局 `input` 那条解锁路收不到那一下（碎片池里那条同理，见「音频：配置列表 + 常驻音」），
  不补这一句按钮音效和 BGM 都不会起。
- `BUTTON_DOWN` 进了 `POST_OVER`：按下去时 `_closed` 还是 false，但**松手**就是 `CTA_CLICK`
  → `stopAll()`，不豁免的话正好在按着的那一段被掐掉。
- 三个节点由 `mount-audio.js` 末尾现按路径指：`Canvas/GameCta`、`UILayer/CtaLayer/CtaRoot/End/btn`、
  `UILayer/CtaLayer/CtaRoot/Fail/btn`。`verify-scene.js` 的 `checkAudio` 加了一条
  「配了 `BUTTON_DOWN` 但 `buttons` 是空的」——不然是个配了不响的死配置。

**实测**（编辑场景跑探针，`onEnable()` → 打 `TOUCH_START` → `onDisable()`，把 `AudioSource`
的 `play` / `stop` / `pause` 临时换成空函数免得碰真播放器，跑完还原 + `--no-save`）：
三个按钮 `hasEventListener(TOUCH_START)` 全 `true`、`onDisable` 后全 `false`；
按下 `GameCta` → `_unlocked=true`、两条常驻 `live=true`、`BUTTON_DOWN` 那条 `live=true`；
再按 `Fail/btn` 不报错。

⚠️ **还没验的部分**：真机上「按下到 `mraid.open` 之间那一下到底听得见多少」没法在编辑器里验
（编辑模式不真播），得开 Game View / 真机听一次。

### `AudioChannels` 被存进场景：`destroy()` 在编辑器里不落地（2026-10-14）

`AudioManager.build()` 会 `new Node('AudioChannels')` 挂到 `Canvas` 下，`onDisable()` 里销毁。
**在编辑器里跑探针（或任何触发 `onEnable` 的路径）之后存场景，这个节点会被写进 `assets/scene.scene`**
—— 实测本轮开场时文件里就躺着一个（`AudioChannels` + 4 个 `AudioSource`，空的、`playOnAwake=false`，
运行期无害，但 Inspector 里多一个看不懂的节点，而且每探一次多攒一个）。

根因：`Node.destroy()` 是**延迟到这一帧末**才真移除的，而编辑器不跑帧 —— 节点一直挂在 `Canvas` 下，
`Scene` 序列化是从根走子节点树的，于是它被写进文件。修法是 `destroy()` 前先 `removeFromParent()`
（摘下来是即时的），已写进 `AudioManager.onDisable`。

本轮顺手清掉了场景里那个残留节点（`removeFromParent()` + `destroy()`），重新存盘后
`assets/scene.scene` 里 `AudioChannels` 与 `cc.AudioSource` 都是 0 个。

⚠️ **顺带的坑：这个 MCP 会话里 `save-scene` 会时灵时不灵**。同一个脚本先是连跑三次
`save.js` 都返回 `false`（文件 mtime 不动），隔一会儿再跑（这次是
`Editor.Message.request('scene', ...)` 连问几个消息、顺带再发一次 `save-scene`）就返回了场景 uuid、
真落盘了。WORKLOG 里早记过「末尾那次自动存盘可能静默失败、再调一次就好」，
但**这次连调三次都没用**，所以：**别信返回值，一律回读 `assets/scene.scene`**
（看 mtime + 直接 `JSON.parse` 数条目）。本轮就是靠回读才发现第一次「已存盘」其实没写进去。

---

## 碎片池改成固定间距：删掉按可视宽度现算那次（2026-10-14）

**原来的做法**（见上文「碎片按素材实际大小 + 一屏最多 4 块」）：`PiecePool.fitSpacing()` 建完碎片
把这一行剩下来的宽度**均分到碎片之间** —— 缝跟着这一批碎片的宽窄变。

**为什么改**：实测两批差一倍。第一批 `Slot_01/02/03`（宽 95 / 119 / 157.3）算出 **82.3**，
第二批 `Slot_04/05/06`（宽 178 / 138.5 / 135.2）算出 **42.1** —— 换批那一下整条池子的疏密变一次。

**改法**：`fitSpacing` 整段删掉，连同它的两个调用点（`buildBatch` 末尾、`onOrientation` 里延后一拍的
补算）与 `PiecePool` 上那条 `ORIENTATION_CHANGED` 注册（它从头到尾只为这件事存在），
`onDisable` 里的 `unscheduleAllCallbacks()` 一并删。间距从此是 `content` 上 `Layout.spacingX`
一个**手配的值**（场景里定 **40**），Inspector 里改、存场景即生效，没有任何东西再覆盖它。

- **`buildBatch` 末尾留了一句 `layout.updateLayout(true)`**：原来那次同步重排是 `fitSpacing` 里的
  这句干的，而 `onLevelBuilt` 紧接着就 `scrollToStart()`，要按**排好的内容宽度**算。
  引擎的 `Layout` 挂在 `AFTER_UPDATE` 上跑，`updateLayout(force=false)` 不脏就直接 return
  （`cocos/ui/layout.ts:702`）—— 不显式排一下，`scrollToStart()` 读到的是上一帧的内容尺寸。
- **`LandscapeLayout` 一个字没改**：竖栏的 `spacingY` 本来就是转屏时**现读** `layout.spacingX`，
  现在读到的就是这个定值；横屏期间没人碰 `spacingX`，转回竖屏天然还是对的。
- **定值为什么取 40**：最宽的一批（178 + 138.5 + 135.2 = 451.7）+ 两个缝 80 + 左右 padding 48
  = 579.7，卡在可视宽 583.893 里不出框。窄的那一批（95 + 119 + 157.3 + 80 + 48 = 499.3）
  右边会空出约 **85px** —— 固定间距就意味着行宽不再等于可视宽，而 `ScrollView` 不居中内容，
  碎片是靠左排的。要「两边都不留空」就得回到自动算法。
- 玩法逻辑（吸附点、缺口框、拿起倍率）一行没碰 —— 间距只影响池子里那一行的排布。

**实测**：编辑场景里现读 `content` 的 Layout —— `spacingX = 40`、`type = HORIZONTAL(1)`、
padding 24 / 24、`view.width = 583.893`；`assets/scene.scene` 里那个 Layout 的 `_spacingX` 已是 **40**
（回读文件核的）。`verify-scene.js` 三条 `missing` 全是老账（`ProgressController.label` 空、
底图 inset 全 0 的误报、`StickerApply` 抄写值 drift），这次改动没添新的。

⚠️ **还没在 Game View / 真机上看过**：要看的是两批的缝是不是终于一样、以及第一批右边那 85px 空档
能不能接受。改完记得 `refresh_assets` + 重开 Game View。

---

## 单块揭晓改成「画笔涂色」（2026-10-14）

**要什么**：修好一块不再「贴平」，改成一支**圆头画笔**斜着来回刷 —— 起笔在左上角，第一笔从上边划到
左边，笔到左边后往下挪一点点、再划回上边，如此来回，整体一路推到右下角收笔；**刷过的地方才显示修复图**，
没刷到的地方露的还是底下那张破损图。

**怎么落的**：新组件 `gameplay/BrushReveal.ts` + 新材质 `effects/brush-reveal.effect`，走的是
`CircleReveal` 那一套「整格接管」——破损图留着垫底，修复图上挂材质，材质只画出刷过的地方，
刷完 `PieceSlot.covered()` 收掉破损图、抛 `PIECE_SHOWN`。六格的 `stickerApply` 全被清掉、改指它
（`tools/js/mount-brush-reveal.js`；组件与开关都留着，重跑 `mount-sticker-apply.js` 就能退回贴平）。

**路径的几何**（这是这一版唯一有推导量的地方）：把碎片自己的 uv 乘上长宽比 A = 宽÷高 当坐标，
原点挪到左上角，第 i 笔就是 `u + t = d` 这条 45° 斜线的一段，`d = (i + 0.5) × 2 ÷ K`：

| d 落在 | 两端在哪 | 起笔方向 |
|---|---|---|
| `d ≤ 1` | 「上边」和「左边」 | 偶数笔 上边 → 左边，奇数笔 左边 → 上边 |
| `d ≥ 1` | 「右边」和「下边」 | 同上 |

第一笔起在左上角、最后一笔收在右下角（d 从 0 走到 2 正好扫过整块），一笔一笔推过去就是那个
「斜着来回」的样子；笔头在画面上是**正圆**（横轴乘了 A，和 `bg-reveal` 用世界坐标算半径是同一个理由）。
判定就是老实的「点到**已经刷过**那一段笔迹的距离 ≤ 笔触半径」，圆头、软边、以及「笔尖前面还没刷到」
全从这一句出来 —— 每笔按 `tau` 截断，只算笔已经走过的部分。

- **笔数 K 与半径 R 的关系（实测出来的，不是估的）**：把这段判定抄成 JS 扫一遍采样点，
  涂满整块需要的半径 ≈ **1.45 ÷ K**（比拍脑袋想的 1÷K 大 —— 非正方形碎片上相邻两笔的
  **垂直间距**是 `dd × A ÷ √(1+A²)` 那一支，A 越大越宽）。K=5 要 0.285，所以默认半径定 **0.3**。
  - 六格碎片现在最宽的是 `Slot_06` 的 **1.078 : 1**（其余 0.5 ～ 0.86），0.3 有余量；
    以后换更横的碎片要按 `1.45 ÷ 行数` 重新核一遍。
  - 抄出来的那份 JS 镜像还核了：进度 0 时整块不显（`best` 是无穷大）、进度 1 时涂满、
    已涂面积随进度大致线性爬（A=3/K=5 时 10% → 16%、50% → 62%）。
- **为什么不用 `uv` 直接算半径**：和 `bg-reveal` 的注释同一个坑 —— 非正方形碎片会把圆压成椭圆。
  这里把横轴乘上 A 就等价于「按碎片像素算」，比那边改走世界坐标更省事（这一格不需要知道自己在屏幕哪）。
- **材质编译验过**：在编辑器里真给 `Slot_04` 的修复图挂上、渲了两帧，`passes = 1`、无 console 报错
  （编辑器看不到画面，只能验到这一层）。

⚠️ **还没在 Game View / 真机上看过**：要看的是笔头大小、5 笔够不够「来回」的感觉、0.8 秒快慢、
以及四角有没有留白。观感全在 `EffectLayer` 上那个 `BrushReveal` 的四个数（`rows` / `radius` /
`feather` / `revealTime`）里，Inspector 里改完存场景即生效。

⚠️ **`verify-scene.js` 那条 `StickerApply 抄写值 drift` 现在不该再劝人重跑贴平脚本**：
六格都不用贴平了，重跑 `mount-sticker-apply.js` 会把槽位从画笔手里抢回去，所以那条检查加了
「没有任何槽位在用贴平就直接跳过」的前置判断。

---

# 附录：从 CLAUDE.md 移出的长推导

下面这几段原本长在规范里，但它们是**推导过程和踩坑经过**，不是「照着做就能做对」的约定，
所以搬到这里。CLAUDE.md 里对应的位置只留结论。

## 来自 §7.1：为什么一句 `setDesignResolutionSize` 就够了

  - **为什么一句 `setDesignResolutionSize` 就够了**（引擎源码核对过，别把这句挪到 `start` 去）：`view.setDesignResolutionSize` 先重算 `visibleRect`，再抛 `design-resolution-changed`。同一次派发里：`Canvas._onResizeCamera` 立刻更新相机 `orthoHeight`；`WidgetManager.onResized` 把 `alignMode` 是 `ON_WINDOW_RESIZE`/`ALWAYS` 的 Widget 全置脏并 `_nodesOrderDirty = true`。紧接着那次 `AFTER_SCENE_LAUNCH` / `AFTER_UPDATE` 的 `refreshScene` 会**先按层级排序再对齐**（父先于子），而 `Canvas` 自己就挂着一个四边 Widget（`alignMode = 2`），它的父节点是 Scene → 运行期 `getReadonlyNodeSize` 取的就是 `visibleRect` —— 所以画布节点先变成撑满后的尺寸，各层再照着它对齐，同一帧内完成，不会闪。
  - 编辑期 `EDITOR_NOT_IN_PREVIEW` 让这条路整体短路（Canvas 的 Widget 拿的是 `getDesignResolutionSize()`），这就是场景面板里看不出变化的原因。
  - ⚠️ 这条**是对原文「保持 fitHeight + fitWidth」的有意偏离**。`fitHeight` / `fitWidth` 在项目设置里没动（还是都开），偏离发生在运行期 —— `view.setDesignResolutionSize()` 把策略换掉了，项目设置只是初值。
  - ⚠️ **编辑器场景面板看不出这个变化**：编辑模式恒按 `getDesignResolutionSize()` 算，画布永远是 720×1280。撑满只发生在运行时（Game View / 产物）。

## 来自 §8.5：构建钩子那三个坑

  - ⚠️ **`options.buildPath` 是编辑器内部的 URL（`project://build`），不是文件系统路径**（2026-10-09 找到的根因）：`path.join('project://build', 'web-mobile')` 拼出来的是 `.\\project:\\build\\web-mobile` 这种相对路径（`path.join` 还会把 `//` 收成 `\`），打包器一看没这个目录就当场 `exit 1` —— 活是 5.5 秒的，**一秒都没跑完**。`hooks.js` 里 `resolveBuildPath()` 负责把 `project://` 前缀换成 `ROOT`，绝对路径原样透传。
    - 判断依据是**时间**：`temp/builder/log/` 里那次 `playable-builder:(onAfterBuild) start` 与整条构建链的结束落在同一秒，而打包器实测要 5.5s —— 只可能是启动即失败。**这个扩展在工作区里一共跑过四次（10-8 两次、10-9 两次），四次全栽在这儿，之前从来没成功出过产物**；`build/playable.html` 一直是手跑 `npm run pack` 生成的。
    - 想自己看 `options` 全貌：`temp/builder/log/` 里 `Start build task, options:{...}` 那一行打了原始 JSON，`"buildPath":"project://build"` 就写在那儿。
  - ⚠️ **子进程的输出必须 pipe 回来转发，不能用 `stdio: 'inherit'`**（2026-10-09 改）：inherit 时打包器的 ❌ 列表直接写到编辑器自己的 stdout，`temp/logs/project.log` 里一个字都不留，构建一失败就只剩「退出码 1」+「请检查插件的代码逻辑」，**根本没法诊断**（`temp/builder/log/` 里也没有这次的记录）。改成 `['ignore','pipe','pipe']` + 逐行 `console.log(TAG + line)`，❌ / ✅ 全进 `project.log`，`grep playable-builder` 就能捞出来。两条流都走 `console.log` —— 用 `console.error` 的话 Cocos 会给每一行附一段 Error 堆栈，多行消息被切碎。**改完 `hooks.js` 要重启编辑器或重载扩展**，扩展是启动时加载的（构建钩子跑在 builder 的 worker 里，`require` 有缓存，同一个编辑器会话里改了也不生效 —— 判据是堆栈里的 `hooks.js:行号` 还是旧的行号）。
  - ⚠️ **`hooks.js` 里不能依赖 `Editor` 全局**：钩子跑在 builder 的 worker 进程里，项目根用 `path.resolve(__dirname, '..', '..')` 推（`ROOT` 已经是这么来的）。

## 来自 §8.7：分发包的实测记录


