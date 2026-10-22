# UI 与屏幕适配

> 本文件是 [../AGENTS.md](../AGENTS.md) **§7 的全文**。
> 工作区指令有 64KB 预算，AGENTS.md 放不下全文，所以正文搬到这里、那边只留指针 ——
> **内容一字未改**，改代码前按需读这一份。

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
    间隔同理：`content` 上那个 `Layout.spacingX` 是**手配的定值**（碎片池不再按可视宽度现算间距），
    横竖屏共用同一个值 —— 竖栏的 `spacingY` 是 `LandscapeLayout` 转屏时现读它填的。
  - **玩法逻辑一行没碰**：缺口框 / 吸附半径 / 拿起倍率全按世界坐标现算，放大对吸附是透明的。
  - **安全区**：`maxRailHeight` 压到 880，竖栏居中后顶端最高 +440，正好不伸进右上角关闭按钮那个
    200×200（设计单位）安全区。
  - **转回竖屏原样还回去**：`onLoad` 存下竖屏的节点位置 / 缩放 / 尺寸 / 挂件开关 / Layout 参数，
    转回来逐项还原 + `centerLayoutContent()` 重新居中。来回转屏不会越转越偏。
    ⚠️ `ScrollView.horizontal` **不在「原样还回去」之列**：它归 `PiecePool.onLoad` 管，恒为 `false`。
    `onLoad` 排在 `PiecePool.onLoad` **前面**，存下来的是场景里那个旧值（`true`），还回去就把居中的前提拆了。
  - **溢出不走滚动，两头一起被裁**：竖栏装不下时不再 `scrollToTop()`，和碎片池横排同一条规矩 ——
    整列几何中心对到栏的中线上（见 §16「整行永远居中」）。
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
  2. `GameLayer` / `PiecePoolLayer` / `ProgressLayer` —— 三处**一条边都不贴**。
     `PiecePoolLayer` / `ProgressLayer` 尺寸钉死（720×300 / 460×90，作者摆的）；
     **`GameLayer` 的尺寸不是手配的** —— 它连同 `Scene_BG` / `完成背景`（后者是
     `SceneBgSwap.revealView`，要求同尺寸）由 `ui/PuzzleAreaFit.ts` 按拼图区底图的**原始长宽比**
     现算：把贴图 contain 进 `maxWidth × maxHeight`（默认 671.45 × 840）的盒子，三处写同一个数。
     **换一张比例的底图不用改任何东西** —— 编辑期组件带 `@executeInEditMode`，Inspector 里换完图
     框当场就变；`mount-adapt.js` 只拆对齐边、**不写 GameLayer 的尺寸**（写死过 671.45×840，
     会把自适应结果盖回去）。
     - ⚠️ `Scene_BG` 的 Sprite 是 `CUSTOM` 尺寸模式，**贴图有多少像素跟节点世界尺寸无关** ——
       美术只改分辨率、不改比例的话，本来就什么都不用做。
     - ⚠️ 资产没拖进来时编辑器**不给 null**，而是塞一个 2×2 的占位 `SpriteFrame`（资产不在
       `assetManager`、名字为空）。`PuzzleAreaFit` 认这个、直接跳过；不认就会把框压成正方形。
     - ⚠️ 比例变了之后 **6 个 `Slot_XX` 仍要手工重摆** —— 那是美术构图，算不出来。
  - ⚠️ 每拆掉一条对齐边，Widget 都会把节点放回**场景里存的 `contentSize`** 并把中心留住 ——
    尺寸必须显式再钉一次。
  - ⚠️ **「四边对齐 + `AlignMode.ALWAYS`」只在这一层的父节点尺寸不变的场合才安全**：父节点尺寸一变，
    编辑器按旧尺寸反推 inset、`ALWAYS` 再按新 inset 重排，两者互相喂，节点会一帧一帧地长
    （实测 `Scene_BG` 566 → 881 → 986、`完成背景` 986 → 1932）。所以 `Scene_BG` / `完成背景`
    也按上面那套记号钉住（`alignFlags = 0`）。来龙去脉见 WORKLOG「拼图框跟着底图比例走…」。
  - 三处的 `Widget` 组件**留着**，只是勾全空 —— 这是「故意不对齐」的记号，别当成没用的组件删掉或者重新勾上
    （勾回去就是长屏偏下）。`verify-scene.js` 的 `checkAdapt` 会拦住。
  - ⚠️ WidgetManager 的整树重排要等下一次 `AFTER_UPDATE`，编辑模式不一定跑得到，所以接线脚本末尾
    自上而下 `updateAlignment()` 刷一遍，否则存进场景的 `UITransform` 会停在中间态。
- 画布尺寸会随转屏 / 撑满而变，**世界坐标一律现读，不存快照**：`SnapSystem` 的吸附目标读的是
  `slot.worldCenter`（live getter），不是建关卡时快照的 `worldPos`。
- **重排全部交给 Widget，代码基本不参与**。`GameEntry` 照旧抛 `ORIENTATION_CHANGED`，横屏那一套由
  `LandscapeLayout` 听它来做，竖屏一律回落到 Widget 摆出来的位置。
- 想让某层横竖屏各一套尺寸，加 Widget 边已经不够了，得写代码。当前玩法内容三处
  （`GameLayer` / `PiecePoolLayer` / `ProgressLayer`）**一条边都不贴**、停在设计稿位置 ——
  横竖屏都靠这个「设计稿居中在画布上」的行为，**别给它们加对齐边**。
  （尺寸钉死的只有后两处；`GameLayer` 的尺寸归 `PuzzleAreaFit` 按底图比例算，见上。）
- 转屏时若碎片正在被拖动，取消拖动并弹回原位（复用 `PIECE_SNAP_FAIL` 流程）。
- ⚠️ **编辑器场景面板看不出撑满的效果**：编辑模式恒按 `getDesignResolutionSize()` 算，画布永远 720×1280。
  撑满只发生在运行时（Game View / 产物）。
- **选关 `ScrollView/view/content` 的顶边靠 Widget 跟，不写死 y**：content 锚点在顶，但长屏
  `FIXED_WIDTH` 会把 `view` 拉高；`content.position.y` 若还是 1280 稿的 `viewH/2`（550），
  首行就会往下坠 —— 屏幕越长，顶部空得越多。现在 content 挂 Widget（`isAlignTop`、`top = 0`、
  `alignMode = ON_WINDOW_RESIZE`），只在画布策略变化时对齐一次，不跟 ScrollView 的滚动量打架。
  接线 `tools/js/fix-level-scroll-top.js`；重建选关的 `tools/js/mount-level-select.js` 也已同步。

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

