# 槽位1停雪 / 槽位3直接换人 / 关结尾视频

## 改了什么

- `FxSnow`（`Canvas/FxLayer/FxSnow`，`Particle2D`）：`stopEvents` 由 `[LEVEL_COMPLETE]` 改成 `[PIECE_REPAIRED]`，`slotIndex = 0`（槽位 1，0-based），`stopDelay = 0` —— 槽位 1 修好当刻停止发射，已经飘出来的雪自然落完。
- `PieceSlot` 新增 `hideOnRepair`（「吸附后整格隐藏（跳过全部揭晓）」）：吸附那一刻直接收掉破损图 / 修复图，跳过贴纸 / 画笔 / 圆扩散 / 序列帧 / 吸附揭晓；配了 `swapHide` + `swapShow` 时也当场换（不等 `swapDelay`、不做渐显），然后照常抛 `PIECE_SHOWN`。
- `Slot_03` 的 `PieceSlot`：`hideOnRepair = true`、`swapHide = character_shake`、`swapShow = 完成_人物_绑骨K帧_3.8.75`。
- `CtaController.endVideo` 置空（`EndVideo` 节点本来就 `active = false`）—— `END_SHOW` 一到直接亮结束界面。

## 为什么这么改

- 停雪走 `Particle2D` 已有的 `EventTrigger` 配置，不写新代码：`slotIndex` 过滤的是 `PIECE_REPAIRED` 的第一个参数（槽位下标，0-based），所以「槽位 1」要填 0。
- 槽位 3 那块位置最终要交给换成好人的 Spine 节点，本格实物不该出场；比起叠一串「先收破损图再等延迟」的配置，加一个整格直隐开关最直接，也保留了原有换节点的字段语义。
- 结尾视频属于可选表现，`CtaController` 的 `endVideo` 本来就是「留空 = 不演」，改配置即可，不动 `EndVideo.ts`。

## 怎么验的

- `tsc --noEmit`（Creator 3.8.8 自带 TypeScript）通过，0 error。
- `assets/scene.scene` `JSON.parse` 通过，并回读确认：`FxSnow.stopEvents = [PIECE_REPAIRED]` / `stopDelay = 0` / `slotIndex = 0`；`Slot_03.hideOnRepair = true`、`swapHide = {__id__:18}`、`swapShow = {__id__:15}`；`CtaController.endVideo = null`。
- 没有跑预览（本机 MCP 端口 27502 无监听）。

## 影响什么 / 还没验的部分

- `hideOnRepair` 是普通字段，未勾选的槽位行为不变；`Slot_03` 上原有的 `snapReveal` / `stickerApply` / `brushReveal` 引用保留，但被直隐分支提前短路。
- 待验：槽位 1 修好后雪是否立刻停、剩余雪是否自然落完；槽位 3 吸附瞬间是否无揭晓直接消失、人物是否当场换出且 `character_shake` 隐藏；结束路是否直接进 CTA、视频不再出现。
- 编辑器若还开着旧场景并保存，可能把这几处配置写回旧值 —— 改完先刷资源库 / 重开预览。

## 补记：雪为什么没停（2026-10-19 当天修复）

- **根因**：`core/EventBus.ts` 的 `emit` 只把载荷 `apply` 给回调，**不透传事件名**；`effects/EventTrigger.ts` 的 `_onEvent(event, ...args)` 却按「第一个参数是事件名」写 —— 于是它收到的 `event` 其实是载荷（槽位号 0），`stopEvents.indexOf(0)` 恒为 -1，**所有配在 `Particle2D` / `FireAction` 上的事件起停从来没生效过**（雪靠 `playOnLoad` 进场播，事件停雪自然从没停过）。
- **修法**：`EventTrigger._subscribe()` 改成按事件各包一层 `(...args) => this._onEvent(e, ...args)`，并把每条的 handler 记进 `_handlers`；`dispose()` 从错的 `EventBus.offTarget(this._host)`（订阅 target 其实是 `this`）改成逐条 `EventBus.off(e, h, this)` —— 顺带修掉反复 enable 时的监听泄漏。
- 不改 `EventBus.emit` 的签名：全仓库几十个监听方都按「第一个参数是载荷」写，加上事件名会全部错位。
- 运行时探针（7456 预览 + CDP）：`FxSnow` 组件配置为 `stopEvents=[PIECE_REPAIRED]`、`slotIndex=0`，`EventBus.emit('PIECE_REPAIRED',0,1)` 时该监听回调 `calls=1` 但 `_stopped` 仍 false；`_onEvent` 里读到的 `ev=0`（不是事件名）—— 与根因一致。改后需刷资源库 / 重开预览再验。

## 再补：火焰 / 黑烟先默认关掉（2026-10-19）

- 用户反馈「火焰和黑烟怎么开了」。原因是上一节修好 `EventTrigger` 之后，这些组件上原本形同虚设的 `startEvents = [PIECE_REPAIRED]` 第一次真正生效，修第一格就同时起了火与烟 —— 这是修 `EventTrigger` 的连带效果，不是新配的。
- 按要求先默认关：`assets/scene.scene` 里 `FxSmoke` / `FxFireShine` / `FxFireSparks`（`Particle2D`）与 `FxFire`（`FireAction`）的 `startEvents` 清空、`playOnLoad = false`；节点保持 active、其余参数（延迟 / 停止事件 / 粒子参数）一个没动，要用时在 Inspector 里重新填 `PIECE_REPAIRED` 即可。
- `FxSnow` 不受影响（它本来就是 `playOnLoad` 进场播）。
- `docs/STATUS.md` 的炉火表格已标注「当前关着」。
## 再补：槽位 3 换人柔化（2026-10-19）

- 用户反馈「槽位3修复切换的效果太僵硬了」。原因是上一轮为了「吸附后直接换成人物」加了 `hideOnRepair` 硬切：收图、换节点、抛 `PIECE_SHOWN` 全在同一帧，中间没有任何过渡。
- 改法（方案 A，零新增美术）：`PieceSlot.hideOnRepair` 那一支换成 `softSwap()` ——
  1. 破损图 / 修复图 / `hideWithBroken` 在 `swapFadeTime` 秒内轻微放大（×1.06）+ 淡出后隐藏（`fadeOutNode()`，没有 `UIOpacity` 就补一个）；
  2. 隔 `swapDelay` 秒，`swapHide` 淡出、`swapShow` 淡入（都是 `UIOpacity` 补间），同时从 0.92 弹回原大（`backOut`）；
  3. 同一刻在 `swapShow` 的世界坐标上撒一把 `魔法仙尘`（`swapDust`），`swapFadeTime × 2.5` 后停系统；
  4. 交叉淡入演完才抛 `PIECE_SHOWN`（这一格的扫光 / 完成背景计数因此晚约 `swapDelay + swapFadeTime` 秒）。
- 时长没有新增数字：全部复用已有的 `swapDelay`(0.45) / `swapFadeTime`(0.25)。
- 场景：`Slot_03` 的 `PieceSlot` 新增 `swapDust = 魔法仙尘`；`完成_人物_绑骨K帧_3.8.75`(#15)、`character_shake`(#18) 各补一个 `cc.UIOpacity`（`swapAfterSweep()` 那条老路径本来就需要，缺了会空引用）。
- 仙尘与完成背景的画笔共用同一个粒子节点：`dustBurst()` 只在节点位置没被挪走时才停系统 —— 画笔一旦开始每帧跟着笔头走，就说明已被它接管，这里不再插手。
- 验证：`tsc --noEmit -p tsconfig.json` 通过；`assets/scene.scene` 重新 `JSON.parse` 回读确认 `swapDust` 指向 `cc.ParticleSystem2D`(#27)、#15/#18 已含 `cc.UIOpacity`。`verify-scene.js` 要在编辑器里跑，本机 MCP 端口没监听，未跑。
- 还没验：真机 / 预览里的实际节奏（0.45 + 0.25 是否偏慢）、仙尘位置是否落在人物脚下、换人期间 `PIECE_SHOWN` 延后对完成背景与进度的影响。改完要刷资源库 / 重开预览。
## 再补：完成图改回画笔涂色（2026-10-19）

- 需求：最后显示完全修复图时要走画笔填充效果。
- 改动：`assets/scene.scene` 里 `Scene_BG` 的 `SceneBgSwap.instant` 由 `true` 改成 `false`。于是收尾不再在 `LEVEL_COMPLETE` 当刻直接换图，而是等最后一个 `PIECE_SHOWN`（最后一格演完）落笔：`完成背景` 亮出、挂 `brush-reveal.effect` 材质、12 笔 / 半径 0.08 / 羽化 0.25 / 1.5s 从左上角斜刷到右下角，笔头位置每帧同步 `魔法仙尘`；刷完把成图贴图挪到 `Scene_BG`、`完成背景` 收起，再抛 `END_SHOW`（后面接 `CtaController` 那套）。
- 顺带修正：`SceneBgSwap.delay` 的 tooltip 之前写成「最后一格露面之后先等」，但代码里 `delay` 只在 `instant` 分支（`onLevelComplete`）读，画笔模式根本不读。已改成如实描述 —— 行为未变。
- 用到的现成配置：`brushEffect` 已指向 `brush-reveal.effect`、`revealView` = `完成背景`（同尺寸成图）、`dust` = `魔法仙尘`，无需重新接线。
- 验证：`tsc --noEmit` 通过；场景 JSON 回读确认 `instant = false`、`revealTime 1.5 / rows 12 / radius 0.08 / feather 0.25`、`revealView` 指向 `完成背景` 的 `cc.Sprite`、`dust` 指向 `魔法仙尘` 的 `cc.ParticleSystem2D`。`verify-scene.js` 需在编辑器内跑，本机 MCP 端口未监听，未跑。
- 待验：1.5s 的画笔节奏在真机是否偏快；`RepairSweep` 的总扫光（`completeDelay 0.5 + completeTime 0.9`，由 `LEVEL_COMPLETE` 触发）与画笔起点（最后一个 `PIECE_SHOWN`）会有一段重叠，若观感打架，把 `completeDelay` 调大或把 `sweepOnComplete` 关掉。改完要刷资源库 / 重开预览。
## 再补：结束画面时 Spine 穿模（2026-10-19）

- 现象：结束画面亮出来前后有一刻，槽位 3 的人物 Spine 盖在完成图上（像「穿模」）。
- 原因：`Scene_BG` 的子节点顺序是 `完成_人物(Spine, idx0) → character_shake(idx1) → 完成背景(idx2) → 魔法仙尘 → 结尾视频`。走画笔模式时 `完成背景`（成图）压在 Spine 上面，画笔刷的过程中把人物盖住了；`SceneBgSwap.finish() → complete()` 把 `完成背景` 收起、成图挪到 `Scene_BG` 自己身上之后，成图里的**静态人物**和底下还活着的 **Spine（待机动画在跑）**就同时存在 —— 那一帧就露出来了。
- 改法：`SceneBgSwap` 新增 `hideAtComplete: Node[]`（「完成图出现时收掉的节点」），`complete()` 里先把这些节点 `active = false` 再换成图。场景里填 `完成_人物_绑骨K帧_3.8.75` 与 `character_shake`。不是按名字写死，换关卡/换美术只在 Inspector 改这个数组。
- 验证：`tsc --noEmit` 通过；场景回读确认 `hideAtComplete` 指向这两个节点。另用 headless Chrome + CDP 抓了 `UIRenderer.fillBuffers` 的每帧顺序，确认 CTA 的 `bg/logo` 在 `Scene_BG` 之后绘制（不存在 z 序倒挂），问题只出在成图与活节点重叠。
- 待验：完成图上不应再出现「动的人物」；若以后想让 Spine 继续在成图上活动，把 `hideAtComplete` 清空即可（那时要接受人物与成图重叠）。
## 再补：结束界面出现时收掉 BrokenLayer（2026-10-19）

- 需求：结束事件触发时把 `BrokenLayer` 也隐藏。
- 改法：`CtaController` 新增 `hideNodes: Node[]`（「结束界面出现时收掉的节点」），`show()` 一进来先逐个 `active = false`，再亮 `End`。场景里填 `BrokenLayer`。挂在 `END_SHOW` 这条路上，不动 `GAME_OVER`（跳商店那条）。
- `SceneBgSwap.hideAtComplete` 只在完成图亮出来那一刻收节点（instant 模式下会早于最后一格的揭晓），所以 `BrokenLayer` 不走那儿，改挂 `CtaController.show()`。
- 验证：`tsc --noEmit` 通过；场景回读确认 `hideNodes = [BrokenLayer]`。
## 更正：BrokenLayer 要在画笔开演**前**收掉（2026-10-19）

- 上一版把 `BrokenLayer` 挂在 `CtaController.hideNodes`（`END_SHOW` 那一拍）—— 而画笔模式在 `END_SHOW` **之前**就演完了，等收的时候破损碎片早就跟着画笔演了一遍，所以看起来「没隐藏」。
- 改法：`SceneBgSwap` 新增 `hideBeforeReveal: Node[]`（「开演前收掉的节点」），在 `reveal()` 的第一行逐个 `active = false`，然后再建材质 / 起 tween。两种模式都生效，画笔模式下就是「先清场，再落笔」。
- 场景里填了整组 gameplay 层级：`BrokenLayer` / `PiecePoolLayer` / `DragRoot` / `GuideLayer` / `ProgressLayer` / `GameCta`；`UILayer` 不能整层收（`CtaLayer` 是它的子节点，收了结束卡也没了），所以只收它下面的两个子层。
- `CtaController.hideNodes` 保留（`END_SHOW` 再兜一次，跳商店那条路也算有收尾），不再是主路径。
- 验证：`tsc --noEmit` 通过；场景回读确认 `hideBeforeReveal` 六项、`hideAtComplete` 两项。
## 再改：落笔同拍淡出、关掉收尾扫光（2026-10-19）

- 需求：最后一个物品的修复动画演完 → 立刻开画笔，同时各层淡出；不要那道亮白扫光。
- 扫光：`Canvas` 上的 `FeatureFlags.sweepOnComplete` 由 `true` 改成 `false`（`sweepOnRepair` 本来就是 false）。收尾扫光是 `LEVEL_COMPLETE` 起 `completeDelay 0.5` 后横扫全场，看着就是「各个物品闪一道白光」；关掉之后 `SceneBgSwap.delay` 保持 0。
- 淡出：`SceneBgSwap` 的 `hideBeforeReveal` 从「当刻 `active=false`」改成 `fadeOut()` —— 每个节点补 `UIOpacity`、在 `hideFadeTime`（新字段，场景里 0.3s）内淡到 0 再隐藏；`reveal()` 第一行就起，和画笔同拍。填 0 退回当场收。
- 参与淡出的仍是六项：`BrokenLayer / PiecePoolLayer / DragRoot / GuideLayer / ProgressLayer / GameCta`。
- 验证：`tsc --noEmit` 通过；场景回读 `hideFadeTime 0.3`、`sweepOnComplete false`、`sweepOnRepair false`。
- 待验：0.3s 淡出是否够（想更慢就调 `hideFadeTime`）；关掉扫光后 `RepairSweep` 的 `completeDelay/completeTime` 不再参与节奏，画笔在最后一个 `PIECE_SHOWN` 当刻起笔。
## 再改：淡出先走完，画笔才起（2026-10-19）

- 反馈：`BrokenLayer` 在画笔出现时还没收干净。原因：上一版 `fadeOut()` 和画笔同时在 `reveal()` 里起，0.3s 的淡出和 1.5s 的画笔画面前半段重叠。
- 改法：`reveal()` 只负责「淡出 + 排期」，把画笔那一段拆成 `startBrush()`；`hideFadeTime > 0` 时 `scheduleOnce(startBrush, hideFadeTime)`，淡出走完才落笔。`onDisable` 同步 `unschedule(startBrush)`，避免中途关组件后延迟起笔。
- 于是时序变成：最后一个 `PIECE_SHOWN` → 六层各 0.3s 淡出（画面上先「空场」）→ 画笔从左上角落下刷 1.5s → `END_SHOW`。总时长比之前多 0.3s。
- 验证：`tsc --noEmit` 通过。
## 再改：场景字段被编辑器抹掉 → 代码侧按名字兜底（2026-10-19）

- 现象：用户仍看到「画笔演完组件才消失」。查 `assets/scene.scene` 发现 `SceneBgSwap.hideBeforeReveal` 整个字段没了（只剩 `hideAtComplete` / `hideFadeTime`），编辑器进程正在跑（CocosCreator.exe 15632）—— 它用内存里的旧场景覆盖了文件，于是运行时只剩 `CtaController.hideNodes` 在 `END_SHOW` 收，看起来就是「画笔之后才收」。
- 改法：先补回场景里的六项；再给代码加兜底 —— `hideBeforeReveal` 为空时 `layersByName()` 现找 `GameLayer/BrokenLayer`、`Canvas` 下的 `PiecePoolLayer` / `DragRoot` / `GameCta`、`UILayer/GuideLayer` / `ProgressLayer`。这样编辑器再清空数组，收场也不会露底。
- 改完必须：编辑器里「刷新资源库」→ 重开预览（预览 chunk 是启动时编的，旧包看不到新字段/新逻辑）。
## 飘雪加风声（2026-10-19）

- 需求：给飘雪粒子配声音，仿 CopyPuzzle。CopyPuzzle 的做法是 `cold_wind` 常驻循环，窗户修好（= 雪花停的那个事件）停风。
- 改法：`AudioManager@Canvas` 加一条常驻 cue：音效 `刮风.mp3`、音量 0.5、渐入/渐出 0.6、结束事件 `PIECE_REPAIRED`。
- 为了跟 `FxSnow` 严格同拍，给 `AudioCue` 新增 `stopSlot`（显示名「结束事件的槽位」，默认 -1 = 任意）：填 0 就只有槽位 0 修好才停 —— 和 `FxSnow.stopEvents=[PIECE_REPAIRED]` / `slotIndex=0` 一致。
- 起播沿用常驻音规则（首次触摸后），不违反 AppLovin「交互前不出声」。
- 验证：场景回读 7 条 cue，新条目字段正确；tsc 未跑（本机没 node_modules）。
## 引导系统按 CopyPuzzle 对齐（2026-10-19）

- 对照 CopyPuzzle `gameplay/TutorialController.ts` 逐项对齐 `ui/GuideController.ts`，自研的部分（`FeatureFlags.guide`、`GUIDE_HOLD/RESUME` 在修复动画期间挂起、转屏重来、手指偏移）保留。
- 节奏：首次 `firstDelay = 0.5s`（新增），之后 `idleDelay = 3.5s`（原 3），到位后停 `loopGap = 1.5s`（原 0.5），`moveTime = 1`（原 1.1）。
- 编排：去掉开头「在池里点一下」的 tap（`tapTime/tapDepth` 删除）；拖动途中副本 180 不透明度、手指 255，**全程不变**；到位才做手指脉冲（0.853×0.883，单程 0.25s）→ 延迟 0.25s 淡出 0.1667s，副本同时 0.2s 淡出。
- 收起：整棵根节点 0.3s 淡出再隐藏（原为硬切），淡完把 opacity 复位成 255。
- 触摸：新增 `poolTouch`（指 `PiecePoolLayer/ScrollView/view/content`），补上「按在碎片池条带空白处也会收引导」——那一路触摸被 content 认领，全局 input 收不到。
- 场景 `GuideController` 已同步上述数值并接好 `poolTouch`；删掉旧的 `tapTime/tapDepth/fadeTime` 序列化字段。
- 未对齐项：手指锚点仍按场景里摆的（CopyPuzzle 把 anchor 落在指尖）——我们的手指图不一定同源，硬改 anchor 会让手指整体错位，先保留 `fingerOffset` 调。
- 验证：括号配对检查通过；未跑 tsc/预览（本机无 node_modules、MCP 未起）。
## 引导手指 / 副本缩放参数（2026-10-19）

- 之前手指节点每遍被硬写成 `setScale(1,1,1)`，场景里摆的 0.5 被覆盖；副本大小则完全跟随池里碎片与缺口修复图，没有可调的倍率。
- 新增两个 Inspector 字段（`GuideController`）：
  - `fingerScale`（手指缩放）：**基准是 GuideFinger 在场景里摆的 scale**（现在 0.5），实际大小 = 场景 scale × 本值；到位脉冲是相对它的乘数。填 0.5 = 场景摆的 0.5 再减半。
  - `ghostScale`（副本缩放）：副本整体（起手与到达缺口）等比再乘，默认 1 = 与池里碎片/修复图同大。
- 场景不用手改：两个字段走默认值 1，手指恢复成编辑器里看到的 0.5 大小（之前被放大了一倍）。
- 验证：括号配对检查通过。
## 压体积：JPEG 重压 + 打开打包器 WebP（2026-10-19）

- 背景：构建 5,809,031 B 仍超 5MB 线 566,151 B。源资源 4.6MB，其中 PNG 2.66MB。
- 做法 ①：`npm install` 装上 `package.json` 早就声明的 `@jsquash/webp` / `@jsquash/png`，打包器 `toWebp()` 才会真正跑（此前一直「跳过 WebP」）。实测 12 张 PNG 无损转 WebP 省 **0.73MB**（character_shake 409→?、stroller、sweater 等）。
- 做法 ②：`background.jpg` 用 Pillow 以 quality=82 / progressive / optimize 原位重压：752,399 → **156,403 B（−79%）**，尺寸不变。原图备份在 `_origin/UI及背景/background.jpg`（放在 `assets/` 外面，免得被 Cocos 导入）。
- `修复图.jpg` 重压反而变大（449k→646k，原图压缩率已很高），已从备份还原，保持 449,297 B 不变。
- 没有缩像素：场景里 character_shake / stroller / sweater 等 5 张 Sprite 的 `sizeMode = TRIMMED`，运行期节点尺寸跟着贴图像素走，缩图会让画面变小，所以只做同尺寸重压。
- 结论：合计可省约 **1.3MB**，预期产物回到 ~4.2MB。待验：编辑器重新构建 web-mobile → 扩展自动打包，看三份产物是否 ✅。
- 回滚：`_origin/` 里有原件；`npm run pack -- --no-webp` 可临时关掉 WebP。