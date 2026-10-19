# Inspector 里的调参表

> 本文件是 [../AGENTS.md](../AGENTS.md) **§16 的表格**。
> 工作区指令有 64KB 预算，AGENTS.md 放不下全文，所以正文搬到这里、那边只留指针 ——
> **内容一字未改**（2026-10-15 起只跟着场景同步过几个数），改代码前按需读这一份。

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
| 本格揭角参数（本格单独配揭角 + 同上一组七项） | `peelOverride` / `peelParams`（`PeelConfig`） | `PieceSlot` @ `Slot_01` …。⚠️ **覆盖是全有或全无** —— 勾上后用的是这一份自己的值，`new PeelConfig()` 的初值是**类默认值**不是全局那份；想从全局那组起步就跑 `tools/js/mount-slot-peel.js`。**23 格现在是按各自形状算出来的一份**（掀哪个角 + 掀起多少都逐格不同），重算走 `tools/js/set-slot-peel.js` —— 见下面那条 |
| 贴纸贴平：正面 / 背面材质 / 翘哪个角 / 翘起的比例 / 贴平时长 / 背面底色 / 折线高光带宽度 / 折线高光强度 | `frontEffect` / `backEffect` / `corner` / `openRatio` / `applyTime` / `backColor` / `creaseWidth` / `creaseGlow` | `StickerApply` @ `EffectLayer`。**槽位勾了「本格单独配揭角」的话，这六个值参数不起作用**；6 个槽位**全勾了**，所以这六个现在没人用 |
| 贴纸收尾脉冲：材质 / 缩小比 / 最低不透明度 / 缩小+淡出时长 / 放大+淡入时长 / 高亮外扩比 / 高亮边宽比 | `pulseEffect` / `pulseShrinkScale` / `pulseMinOpacity` / `pulseDownTime` / `pulseUpTime` / `pulseMarginRatio` / `pulseRimRatio` | `StickerApply` @ `EffectLayer`。贴平推完接着演的那一下：修复图先缩一点、同时淡下去，再放大回原尺寸、把不透明度收回来。`pulseEffect` = `piece-glow.effect`（和拖动亮边同一份），管的是这一下**要不要亮边**；**留空 = 只缩放 + 淡出淡入** |
| † 发射步长 | `step` / `life` / `dotSize` / `maxPerFrame` | `TrailEmitter` @ `EffectLayer` |
| † 单块·扫光各三项 | `repairTime` / `repairBand` / `repairFlash` | `RepairSweep` @ `EffectLayer`。`sweepOnRepair` 关着 ⇒ 这三个调了不会有画面变化 |
| † 总修复：开演前定格 / 时长 / 光带半宽比 / 补光强度 / 光带颜色 | `completeDelay` / `completeTime` / `completeBand` / `completeFlash` / `sweepColor` | 同上。**2026-10-15 起整段不演**（`FeatureFlags.sweepOnComplete` 关掉了），这两个数留在组件上但没人读，调了不会有画面变化。⚠️ 它和 `SceneBgSwap` 那一行的「开演前等待」是**一对**：扫光**开着**时 `delay = completeDelay + completeTime`，**关着**时 `delay` **必须是 0**（否则最后一格露面之后白等一段）。成对写的地方是 `tools/js/set-finale.js`，`verify-scene.js` 会卡「白等」 |
| † 序列帧 | `frames` / `frameInterval` / `sizeRatio` / `revealTime` | `RepairReveal` @ `EffectLayer` |
| † 圆形扩散：扩散时长 | `revealTime` / `feather` / `revealEffect` | `CircleReveal` @ `EffectLayer`（每格在 `PieceSlot.circleReveal` 上选） |
| † 吸附瞬间：扩散材质 / 冲击时长 / 扩散时长 / 羽化半宽 / 边缘提亮 / 水平波纹 | `revealEffect` / `punchTime` / `revealTime` / `feather` / `brightness` / `waveOn` | `SnapReveal` @ `EffectLayer`（全局一份，每格在 `PieceSlot.snapReveal` 上选）。**2026-10-19 已接线**：`EffectLayer` 挂了一份、23 格全指、Canvas 上「吸附瞬间时序」开着；重跑 `node tools/exec.mjs scene tools/js/apply-copy-snap.js` 可原样恢复这四项配置（它会按 CopyPuzzle 原值覆写参数）。只想让某几格走：把别格的 `snapReveal` 清空。时序（原版 1:1）：`0–0.417T` 弹一下 + 淡到 0 → `0.972T` 从圆心扩出来（expoOut，前两成时间走掉八成）。`punchTime` 是整段的尺子，改它等比缩放全部节拍；`revealTime` 原版 8 秒 —— 23 格嫌慢先试 1.2 |
| 画笔涂色：材质 / 涂完时长 / 笔触行数 / 笔触半径 / 笔触羽化 | `brushEffect` / `revealTime` / `rows` / `radius` / `feather` | `BrushReveal` @ `EffectLayer`（每格在 `PieceSlot.brushReveal` 上选）。⚠️ **半径有下限**（低于它相邻笔迹之间露底）：实测 = `c ÷ 行数`，`c` 只跟底图长宽比走 —— 竖长碎片（A≈0.7）`c ≈ 0.75`，方图 `c ≈ 1`，很扁的 `c ≈ 0.46`；行数越少笔头越粗，「来回」的痕迹越糊。**别再照 1.45÷行数 配**（那是老数，比实测大一倍，白扔一半的细节） |
| 拿起放大时长 | `pickScaleTime` | `DragController` @ `GameLayer` |
| 起拖判定距离（px）/ 追手时长 / 碎片离手指的纵向偏移 | `moveStartDistance` / `catchTime` / `touchOffsetY` | 同上。这三项加上面那条就是「拖拽三段」：**按下碎片不动**（只记按下时的手指与碎片位置）→ 位移过 `moveStartDistance`（现在 35，原版 20px@414 折合）才起拖、先用 `catchTime`（0.14，linear）把碎片**追**到手指 → 补间跑完才 1:1 跟手。`touchOffsetY` 正数把碎片抬到指肚上方（原版 80px@414 折合 139；**现在是 0** = 碎片就在指肚底下） |
| 失败插入（推开邻居）/ 插入滑动时长 | `insertOnFail` / `insertTime` | `PiecePool` @ `PiecePoolLayer`。拖着走了一圈却没吸上、松手：按碎片**当前的横向位置**插回最近的那个空位，右边那些碎片顺势推开让位（0.14s 一起滑）；关掉 = 老行为，碎片横穿整个托盘飞回原来那个空位。⚠️ 只有**过门槛真拖动过**才算「失败插入」（`DragController` 里的 `started` 判据）—— 点一下就松手不插 |
| 自动打关：玩家修够几块后接管 / 接管前停顿 / 同一屏错峰间隔 / **一次飞几批** / 每批之间的间隔 / 飞入时长 | `afterPlaced` / `startDelay` / `stagger` / **`batches`** / `gap` / `flyTime` | `AutoPlayer` @ `GameLayer`（和 `DragController` 同节点）。总开关在 `Canvas` 的 `FeatureFlags` 面板上；面板关着时这几个数怎么调都不会有画面变化。⚠️ `afterPlaced` 要**小于** `EndgameCta.winCount`（`winCount` 填 0 时不受限）——不然玩家自己就修满了，接管无事可做。⚠️ **`batches` 填 1 = 一屏一屏放**（老行为）；填大了池子会临时多摆几屏，**最外围那两块是从裁剪窗外飞进来的**（池子平时只摆一屏，宽度是照裁剪窗定的）。⚠️ **最后一批不走 `stagger`**（整批齐落），这是代码里的定则不是参数，见 §16 末「收尾那三拍」 |
| 弹回原位时长 | `returnTime` | `PiecePool` @ `PiecePoolLayer` |
| 自动补位 / 补位滑动时长 | `reflow` / `reflowTime` | 同上（`reflow` 关掉 = 一块碎片被用掉后**空位留在原地**、后面的碎片不动；开着才谈得上滑多久，所以关掉时 `reflowTime` 不起作用） |
| 池子模式 | `poolMode` | `PiecePool` @ `PiecePoolLayer`。`BATCH` = 现状：每屏只摆 `batchSize` 块、整行居中、**不能滑**；`SCROLL` = 整关一次全摆出来、**可以滑**（忽略 `batchSize`；横屏左右两栏时自动改成竖向滑）。⚠️ 改完要刷资源库 + 重开预览 |
| 每屏碎片数 / 换批淡入时长 | `batchSize` / `batchFadeTime` | 同上（一屏只摆这么多块，这一批用光才补下一批；`batchSize` 填 0 = 整关一次全摆出来）。⚠️ 只在 `poolMode = BATCH` 下生效 |
| 碎片间距 | 无 —— 就是 `content` 上 `Layout` 的 `spacingX`（现在是 **80**） | 改完不用动代码。**它是个定值**，碎片宽窄不一，行宽不再等于可视宽；但**整行永远居中**，两头超出裁剪窗的部分被 Mask 裁掉（见下面那条坑） |
| 吸附半径 / 吸附半径比（**圆形模式专用**） | `snapRadius` / `snapRadiusRatio` | `PieceSlot` @ 各槽位。**只在 `SnapSystem` 的「吸附范围形状」= 0（圆）时生效**；默认走矩形模式，这两项调了不会有反应 |
| 吸附范围形状 / 矩形吸附比例 | `snapMode` / `snapRatio` | `SnapSystem` @ `GameLayer`（和 `DragController` 同节点）。`snapMode = 1`（默认，对齐原版 `PuzzleItem._checkSnapping()`）= **按轴矩形**：`|Δx| ≤ 修复图宽 × r && |Δy| ≤ 修复图高 × r`，两轴各判各的 —— 长条物件不再「横向给太多、纵向给太少」，大件松、小件紧；`0` = 旧的圆形判据（纯回退开关，不用改接线） |
| 矩形吸附比例（本格） | `snapRatio` | `PieceSlot` @ 各槽位。> 0 时盖掉全局那个 r（逐格微调：小件要更紧就往下调）；`0` = 用 `SnapSystem.snapRatio`（0.4） |
| 吸附后整格隐藏（跳过全部揭晓） | `hideOnRepair` | `PieceSlot` @ `Slot_03`（勾着）。吸附时不走任何揭晓：破损图 / 修复图在 `swapFadeTime` 秒内轻微放大 + 淡出，隔 `swapDelay` 把 `swapHide` 淡出、`swapShow` 淡入并从 0.92 弹回原大，同时在人物位置撒一把「魔法仙尘」，整段演完才抛 `PIECE_SHOWN` |
| † 换节点延迟 | `swapDelay` / `swapFadeTime` | `PieceSlot`。普通槽位：先露实物扫光、隔 `swapDelay` 再换节点；`Slot_03`（勾了「吸附后整格隐藏」）也读这两个值 —— `swapFadeTime` 是碎片化掉 / 两个角色交叉淡入的时长，`swapDelay` 是「碎片化掉」到「开始换人」的间隔 |
| † 换人时撒的仙尘 | `swapDust` | `PieceSlot` @ `Slot_03`，填的是完成背景那个 `魔法仙尘`（`ParticleSystem2D`）。⚠️ 两边共用一个粒子：完成背景的画笔一旦开始每帧挪这个节点（= 已经被它接管），本组件就不再停系统 |
| 进度条填充缓动时长 | `fillTime` | `ProgressController` @ `UILayer` |
| 进度条外观（底色 / 透明度 / 尺寸） | 无 —— 就是 `进度条底` / `进度条` 两个节点上 `Sprite` 的 color / `UITransform` | 改完不用动代码 |
| 结束界面入场（背景淡入 / 下落时长 / 出发高度 / 按钮间隔 / 弹跳次数 / 首跳高度 / 衰减 / 首跳时长 / 压扁幅度 / 压扁时长） | `bgFadeTime` / `dropTime` / `dropMargin` / `stagger` / `bounces` / `bounceHeight` / `bounceDecay` / `bounceTime` / `squash` / `squashTime` | `CtaController` @ `CtaLayer` |
| 终局跳转（修好几个就跳商店 / 失败界面淡入时长） | `winCount` / `failFadeTime` | `EndgameCta` @ `UILayer/CtaLayer`（`winCount` **现在是 6 = 全部修完**，填 0 退回「全部修完出结束界面」那条老路；修满那一格**吸附成功当刻**就跳，失败路才等这一格演完再弹再跳） |
| 引导节奏 + 副本 / 手指外观（首次延迟 / 空闲延迟 / 循环间隔 / 拖动时长 / 收起淡出 / 副本淡出 / 手指脉冲三件 / 手指淡出 / **手指缩放 / 副本缩放** / 副本透明度 / 手指偏移 / 碎片池触摸区） | `firstDelay` / `idleDelay` / `loopGap` / `moveTime` / `hideTime` / `dragableFadeTime` / `pulseScaleX` / `pulseScaleY` / `pulseTime` / `handFadeTime` / **`fingerScale` / `ghostScale`** / `ghostOpacity` / `fingerOffset` / `poolTouch` | `GuideController` @ `UILayer`。编排对齐 CopyPuzzle `TutorialController`：0.5s 首播、之后 3.5s；拖动途中大小/透明度不变，**到位后**手指脉冲（0.853/0.883）→淡出、副本 0.2s 淡出，停 1.5s 重播；收起 0.3s 淡出。`poolTouch` 指池子的 `content`，补上「按在池子空白处也收引导」这一路 |
| 完成背景：**直接亮出来** / 亮之前等多久 | `instant` / `delay` | `SceneBgSwap` @ `GameLayer/Scene_BG`（§18）。`instant` **没勾（现在走画笔）**；勾上 = **最后一块落位当刻**（`LEVEL_COMPLETE`）就把完成图亮出来，不走画笔、不起 tween、不撒仙尘。`delay` **只在 `instant` 勾着时生效** = 那一拍之后先等几秒再亮（**扫光关着时必须填 0**，`verify-scene.js` 会卡「白等」）；画笔模式不读它 —— 最后一个 `PIECE_SHOWN` 当刻就落笔 |
| † 完成背景画笔（只有**取消勾选**「直接亮出来」才走）：材质 / 涂完时长 / 笔触行数 / 笔触半径 / 笔触羽化 | `brushEffect` / `revealTime` / `rows` / `radius` / `feather` | `SceneBgSwap` @ `GameLayer/Scene_BG`（和单块那套同一份 `brush-reveal.effect`、同一组参数含义）。**现在这几个数都生效**（`instant` 没勾）：**12 笔 / 半径 0.08 / 羽化 0.25 / 1.5s** —— 底面 582×840 比单块大得多，起笔那一瞬是个半径 `radius × 高度` 的圆：老配置（5 笔 0.3）是 252px 半径、直径占画面宽 87%（一上来糊掉半张图），现在是 67px / 23%。**「一开始只涂一点」就压 `radius`**（下限 `0.74÷行数` = 0.062，见上一条），`revealTime` 是「走完要多久」（2026-10-15 从 2.5 改成 1.5）。⚠️ 走画笔时这段在 `winCount = 0` 是**主路径**：`revealTime` 演完才抛 `END_SHOW`（后面还接结尾视频，§18），别为「再长一点」再往上堆。重算走 `tools/js/set-scene-brush.js`（只管笔头，`revealTime` 只在 ≤1.3 时才被抬到 2.5、手调的值保留）/ `tools/js/set-finale.js`（管 `delay` 那几拍） |
| 完成背景仙尘（粒子）：数量 / 发射率 / 存活 / 起止尺寸 / 角度与散射 / 速度 / 颜色 | `totalParticles` / `emissionRate` / `life` / …（`ParticleSystem2D` 自己那张表） | `魔法仙尘` @ `GameLayer/Scene_BG/魔法仙尘`。**「粒子多一点亮一点」就调这几个**：`emissionRate` 与 `totalParticles` 管多，`startColor` 与尺寸管亮。⚠️ 它的**混合模式**（加色）与**位置类型**（`FREE` = 留在原地才有拖尾）都不在 Inspector 里 —— 前者由 `SceneBgSwap.glow()` 运行期改材质实例（`@property` 存不进场景），后者在粒子组件上、`verify-scene.js` 会查 |
| † 待机动作：左右摆幅 / 上下摆幅 / 横向拉伸幅度 / 纵向拉伸幅度 / 一次循环时长 / 起始相位 | `swayX` / `swayY` / `stretchX` / `stretchY` / `period` / `phase` | `IdleMotion` @ `GameLayer/Scene_BG/马桶隐藏节点/气体大` 与 `/气体小` |
| † 通马桶：水位节点 / 挪到位的位置 / 旋转 / 时长 / 抽动次数 / 幅度 / 单次时长 / 脏水最终缩放 / 额外下沉 / 消失时长 | `water` / `moveTo` / `rotateTo` / `moveTime` / `bobCount` / `bobDepth` / `bobTime` / `waterShrink` / `waterDrop` / `fadeTime` | `FlushAction` @ `Slot_02`。**排水时长不是参数** —— 水每抽一下缩一档，总时长 = `bobCount × bobTime × 2` |
| † 扫地：物品父节点 / 中点微调 / 挪动时长 / 摆动角度 / 来回次数 / 单程时长 / 摆动时右移距离 / 物品渐隐间隔 / 物品渐隐时长 | `items` / `offset` / `moveTime` / `sweepAngle` / `sweepCycles` / `sweepTime` / `sweepMoveX` / `gap` / `fadeTime` | `BroomSweep` @ `Slot_03` |
| † 喷瓶：两张贴图 / 气体节点 / 摇晃次数 / 摇晃角度 / 单程时长 / 起始高度 / 下落时长 / 气体渐隐时长 / 气体先后间隔 / 喷雾图缩放 / 喷雾图偏移 | `noMistFrame` / `mistFrame` / `gases` / `shakeCount` / `shakeAngle` / `shakeTime` / `mistRise` / `mistDropTime` / `gasFadeTime` / `gasStagger` / `mistScale` / `mistOffset` | `SprayAction` @ `Slot_05`。两个图口与另外七个调参由 `mount-spray-action.js` 写；`mistScale` / `mistOffset` 是**对齐两个瓶子用的量**，换美术得重新量 |
| † 地上脏水：失败后延迟 / 渐显时长 | `delay` / `revealTime` | `GroundWater` @ `Scene_BG/地上脏水`。**方向不在这儿**，是节点 Sprite 上的 FILLED/VERTICAL/`fillStart = 1` |
| 音频配置列表（激活事件 / 音效 / **顺序音效列表** / 音量 / 渐入 / 渐出 / **循环播放** / **循环间隔** / 结束事件）+ 总音量 / **结束事件的槽位** | `cues` / `volume` | `AudioManager` @ `Canvas`。顺序列表非空时按「每触发一次换下一条」播，那一条的「音效」作废（当前没人用）；「循环播放」让**非常驻**的一条也能一直循环（自动打关音），靠「结束事件」收；循环间隔是每一遍之间那段静默（0 = 引擎的无限循环）。⚠️ 激活事件 `LAST_SHOWN` = 「最后一格露面」，不是总线事件，见「音频配置」 |
| 按压音效按钮 | `buttons`（节点数组） | 同上。「激活事件」选 `BUTTON_DOWN` 的那一条听的就是它们的 `TOUCH_START` —— **加按钮就往这儿拖一个节点**（现在三颗 CTA：`GameCta` / `End/btn` / `Fail/btn`） |
| 横屏放大倍率 / 拼图区与进度条间距 / 两栏间距 / 竖栏最大高度 | `scale` / `columnGap` / `railGap` / `maxRailHeight` | `LandscapeLayout` @ `Canvas`（§7.1） |
| 拼图框最大宽 / 最大高 | `maxWidth` / `maxHeight` | `PuzzleAreaFit` @ `GameLayer`（§7.1）。把底图 contain 进这个盒子，`Scene_BG` / `完成背景` 一起写成同一个数。因为取的是 min，框**只会变小不会变大**，所以永远压不到进度条、也不出画布顶（`maxHeight` 别超过 919）。⚠️ **换图不用改这里** |
| 横屏底图旋转（度）/ 缩放系数 | `poolBgRotate` / `poolBgScale` | 同上（`poolBgScale = 1` 即等比盖住竖栏） |
| 常驻按钮：呼吸放大比 / 呼吸单程时长 | `breathScale` / `breathTime` | `GameCta` @ `Canvas/GameCta`。**位置不在这儿**（竖屏是同一节点上的 Widget，横屏是 `LandscapeLayout.cta` 口）。**外观也不在这儿**：底色 / 文案 / 字号都在 `Bg` / `Text` 上 |
| 结尾视频：播放器 / 播放区域 / 兜底时长（秒） | `player` / `region` / `fallbackTime` | `EndVideo` @ `Canvas/GameLayer/Scene_BG/结尾视频`（§18）。`region` = 铺满的那个框（现在 `Scene_BG`）；`fallbackTime` 是「自动播放被拦 / `COMPLETED` 不回调」时的兜底，**不能填 0**，否则结束界面永远不出来；片长 3.88s ⇒ 现在 8s |
| 结尾视频播放器：片源 / 静音 / 等比 / 铺底 / 开启即播 / 全屏 | `clip` / `mute` / `keepAspectRatio` / `stayOnBottom` / `playOnAwake` / `fullScreenOnAwake` | `cc.VideoPlayer` @ 同一节点。**换片只动 `clip`**；`mute` 保持 false（起播自带静音退路）；后三项别改（§18 那四条约束） |

| 飘雪：贴图 / 加色 / 数量 / 发射率 / 寿命 / 角度 / 起止尺寸 / 自转 / 起止颜色 / 抖动 / 速度 / 加速度 | `spriteFrame` / `additive` / `totalParticles` / `emissionRate` / `life(+Var)` / `angle(+Var)` / `startSize(+Var)` / `endSize(+Var)` / `startSpinVar` / `startColor` / `endColor` / `posVar` / `gravity` / `speed(+Var)` / `tangentialAccel(+Var)` / `radialAccel(+Var)` | `Particle2D` @ `Canvas/FxLayer/FxSnow`。**位置照抄原版的比例再按背景构图挪的占位值**：雪在右上窗前，`posVar` 是「雪云」的横竖范围（142×174 覆盖整个窗），要更大的雪片就抬 `startSize`。**「雪往哪边飘」改 `angle`**（250 = 左下），**「多密」改 `emissionRate` 与 `totalParticles`** |
| 烟雾：贴图 / 加色（**别勾**）/ 数量 / 寿命 / 角度 / 起止尺寸 / 速度 / 切向加速度 / 重力 / 起止颜色 | 同上（`Particle2D` 那张表） | `Particle2D` @ `Canvas/FxLayer/FxSmoke`。烟走**普通 alpha**（`additive` 关着、`additiveEffect` 空），颜色是深灰 39 → 22 全透明。**「烟往哪儿飘」= `angle` 60 + `gravity.y`**；`endSize` 比 `startSize` 大 5 倍是原版的膨胀烟，改小了会像喷泉 |
| 火光柔光 / 火星 | 同上（`Particle2D` 那张表） | `Canvas/FxLayer/FxFireShine` / `FxFireSparks`。两者都**勾加色**且 `additiveEffect` = `SpriteAdd.effect`（漏了就变灰块）。柔光是「大气氛」：`totalParticles` 只有 15、`endSize` 661，别嫌少；火星靠 `gravity.y` + `radialAccel` 往上蹿 |
| 炉火翻页动画：帧序列 / 最低不透明度 / 淡入淡出时长 / 翻页间隔 / 缩放 / 锚点 | `frames` / `minOpacity` / `fadeTime` / `changeInterval` / `spriteScale` / `spriteAnchor` | `FireAction` @ `Canvas/FxLayer/FxFire`。**帧序列是「后显示的在前」**：数组顺序 fire-4 / fire-3 / fire-2 / fire-1，最后一个（fire-1）先出场 —— 原版就是预置 fire-1 再往后翻，别把数组倒过来。`minOpacity = 40` 让旧帧留一点底，填 0 会出现全黑一瞬 |
| 粒子起停条件（**所有**粒子 / 炉火共用）：进场就播 / 启动事件 / 启动延迟 / 停止事件 / 停止延迟 / 只认槽位 | `playOnLoad` / `startEvents` / `startDelay` / `stopEvents` / `stopDelay` / `slotIndex` | 每个粒子组件自己的字段（`EventTrigger` 那组）。填的是 `GameEvent` 的**字符串名**，多个事件是「全部到齐才启动」；`slotIndex = -1` 认任意槽位，填了就只认 `PIECE_REPAIRED` 的第一个参数。**现在接的是**：雪开场就下、整关完成 0.5s 后停；火 / 光 / 火星 / 烟等第一块修好（延迟 1.8 / 1.9s）。想让火等壁炉那件修好才点：启动事件留 `PIECE_REPAIRED`、`slotIndex` 填那一件的序号 |
| 粒子位置 / 层级 | 无（节点 transform 与 `spriteFrame` 都在 Inspection 面板上） | 五个节点都在 `Canvas/FxLayer` 下，**容器夹在 `GameLayer` 与 `PiecePoolLayer` 之间**：火苗能被壁炉挡住一半、雪盖住拼图，但拖拽中的碎片与 HUD 永远在最上层。坐标原点在画布中心（720×1280 ⇒ x ∈ ±360、y ∈ ±640）。**整套重接**：`node tools/exec.mjs scene tools/js/apply-copy-particles.js` |

