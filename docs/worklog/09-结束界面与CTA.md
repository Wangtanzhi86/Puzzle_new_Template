# 结束界面与CTA

> 从 `docs/WORKLOG.md` 拆出来的**历史 / 踩坑**记录（4 节）。
> **这不是规范** —— 规范在 [AGENTS.md](../../AGENTS.md)，当前状态在 [STATUS.md](../STATUS.md)。
> 文里的读数 / 行号 / 端口都可能过时，按它做事前先现读一遍。

---

## 结束界面（2026-10-09）

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

---

## 游戏中常驻的下载按钮（2026-10-09 立，2026-10-10 改成不用图）

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

---

## CTA 点了不跳：容器给的 mraid 没有 `getDeviceInfo`（2026-10-09）

浏览器里点 CTA 的报错：`Uncaught TypeError: e.getDeviceInfo is not a function`，栈是 `r.isAndroid → r.openStore → r.onClick`。

- **`mraid` 对象是在的**（所以 `api` 不为 null，走了 `getDeviceInfo` 那条分支），只是容器没实现这个方法。`MraidBridge.isAndroid()` 原来裸调 `m.getDeviceInfo().os`，抛在点击回调里 —— `mraid.open` **一次都没执行到**；外层又没有 try/catch，控制台里就只剩这一条 TypeError。
- 修法：`typeof m.getDeviceInfo === 'function'` 才调，否则回退 UA（§8.3 本来写的就是「取不到时回退 UA」，代码没照做）；`open()` 同样先查 `typeof m.open === 'function'`，并且**真跳之前打一行 `[MraidBridge] mraid.open(<url>)`** —— 之前有 mraid 时整条跳转路径一个字都不打，这就是上一轮没有控制台证据可看的原因。
- 实测（编辑场景里给 `globalThis.mraid` 塞假对象，跑完 `delete`，`--no-save`）：修前 `isAndroid()` 抛 `m.getDeviceInfo is not a function`（与线上报错逐字一致）；修后 `{ open }`（没有 `getDeviceInfo`）→ `isAndroid() = false`、`openStore()` 不抛、假 `open` 收到 iOS 链接；`{}`（连 `open` 都没有）→ 不抛、只打日志；没有 mraid → 不抛。探针没在 `globalThis` 上留下 `mraid`（`hasOwnProperty` false）。
- ⚠️ **改完 `.ts` 必须重建产物**：那条报错来自 `build/playable.html`（旧产物，编辑器里重跑一次 web-mobile 构建才会带上新代码）。
- ⚠️ 同一个容器里 `getState` / `addEventListener` 是有的（`onLoad` 没报错才走得到点击），所以只修了这两个方法，没有顺手给整条 MRAID 生命周期加判空。

---

## 「点哪里都跳」是怎么做到的（关键机制，别再想别的辙）

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
