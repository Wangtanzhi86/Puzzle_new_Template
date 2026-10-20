# 选关正式美术：背景图 + 十关卡（框 / 填充 / 丝带）

- 日期：2026-10-20
- 提交：<待回填>
- 关联：docs/changes/2026-10-20-level-flow.md、docs/changes/2026-10-20-intro-video.md

## 改了什么

- 场景 `Canvas/Change` 整棵重建（脚本 `tools/js/mount-level-select.js`，幂等）：
  - `BG`：Sprite「背景图」（1536×2761），四边 Widget 撑满；
  - `ScrollView`：上下留 90、左右留 24，纵向滚动；`view` 挂 RECT Mask；`content` 挂
    `Layout = GRID`（`cellSize = 324×295`、间距 24、`resizeMode = CONTAINER`、上下 padding 24）；
  - `Level_01..Level_10`：每关一个按钮（`cc.Button`，SCALE 0.96），三层结构与需求一致 ——
    ① `Window`（RECT Mask，决定显示范围）> `Fill`（第 N 集.jpg，等比 cover 铺满、超出裁掉）；
    ② `Frame`（框UI.png，铺满 324×295，与框图 2118×1928 同比例）；
    ③ `Ribbon`（丝带UI.png，按钮底部居中，y = −147.5 + 33，宽 279 / 高 74）> `Label`（`LEVEL N`，
    白字 + 深色 `LabelOutline`，字号 34）。
  - `LevelSelect.items` 回填 10 个按钮、`levelCount = 10`。
  - 没有任何标题 / 提示文字（旧「选关」「点击关卡开始」「第 N 关」全删）。
- 关卡顺序与片源：第 1、2、3、6、7、8、9、10、11、12 集（目录里就没有 4、5 集），
  丝带上的字号写集号（第 6 集 → `LEVEL6`），不是 1..10 的顺序号。
- `assets/scripts/ui/LevelSelect.ts`：加滚动误触保护 —— 按下后挪动超过 `TAP_SLOP = 16` UI 像素就只当滚动，
  松手不选关；监听 `TOUCH_START / TOUCH_MOVE / TOUCH_END` 三者对称注销。
- `tools/js/mount-level-flow.js`：删掉旧的暗底占位面板（Panel / 标题 / Tip / 3 个文字按钮），
  现在只管 `IntroLayer` 与两块挡板；选关交接给 `mount-level-select.js`，否则重跑旧脚本会把占位界面建回来。
- 片源一律现读 `.meta` 的 `sprite-frame` 子 uuid（`xxx@f9941`）传参，脚本里不写死。

## 为什么这么改

- 需求是「背景图 + 每关一个按钮，三层：集图 / 框 + Mask / 丝带显示 LEVEL」，
  所以 Mask 挂在 `Window` 上、把 `Fill` 作子节点 —— Mask 只裁子节点、不裁兄弟，这一层不能省。
- `Fill` 用 cover 而不是拉伸：集图 964×1188（0.81）与框 1.10 比例差不少，硬拉会变形；
  等比放大到盖满再让 Mask 裁掉多出来的部分。
- 一屏最多 3 行 2 列 ⇒ 10 关必然超一屏，用 `ScrollView` 而不是分页：少一套翻页状态与按钮资源，
  两列格子宽 = (672 − 24) / 2 = 324，行高按框图比例 295，3 行 941 + 间距 + padding ≈ 989 < 1100 可视高度。
- 丝带字号跟集号走：片源本身就叫「第 6 集」，写 `LEVEL4` 会和集图对不上。
- 否掉的方案：给每个按钮单独摆死坐标（换分辨率就散）；把集图当 Sprite 铺满再靠 Frame 的透明中心露出来
  （框图是否带透明窗无法从尺寸判断，且出框部分没有硬裁切）。

## 怎么验的

- 按老板要求没有跑预览 / 截图。
- `node tools/exec.mjs scene tools/js/mount-level-select.js "<args>"` 跑通并存盘；
  再回读运行中的场景确认：`Change` 子节点为 `BG / ScrollView`，`LevelSelect.items = 10`、
  `levelCount = 10`，首个按钮子节点 `Window / Frame / Ribbon`、有 `cc.Button`、
  `Window` 有 `Mask`（type RECT），`Fill` 的 SpriteFrame 是 964×1188、节点 324×399（cover），
  `content` 高度 1619（5 行），Label 依次 `LEVEL1/2/3/6/7/8/9/10/11/12`。
- TypeScript 未做编译验证（未开预览即未走引擎编译）。

## 影响什么 / 还没验的部分

- 框图是否带透明中心未知（只读了尺寸，没看图）：若框UI.png 中心不透明，集图会被整块盖住。
- 丝带文字颜色（白字深描边）是按常见丝带配的，实际丝带底色若偏浅可改 LabelOutline 或换深色字。
- 横屏没有单独排版：仍是两列、居中偏左，未接 LandscapeLayout。
- 10 个按钮全部进场景，集图（合计约 1.7MB 原图）会进包，交审前要按 §9 核 < 5MB；
  若要省，可只留前几关或压到 512 宽。
- ScrollView 拖动时靠 TAP_SLOP 防误选，实际手感（惯性滑动后松手）未在真机验证。

### 补丁 2（同日）：孔洞遮罩 / 位置编号 / 未解锁遮罩

- {BT}Fill{BT} 露出框外：原因不是 Mask 没生效，而是 Mask 尺寸取了**整格**（324×295），
  而框图本身有透明边距。现在量出框图（2208×1984，裁切后 rect 52,25,2118×1928）里透明孔洞的
  实际范围 —— x 264..1952、y 295..1744（相对裁切框 x 212..1900、y 270..1719）——
  把 {BT}Window{BT} 的尺寸/位置改成孔洞，{BT}Fill{BT} 反向偏移保持整格居中：
  孔洞 = **258×222**、中心 (−0.38, −4.74)。
- 丝带文字上移 14px（{BT}Label{BT} 局部 y 由 −1 改 13）。
- 关卡编号改成**按位置**（{BT}LEVEL1..LEVEL10{BT}），与片源文件名无关；片源顺序仍是
  第 1/2/3/6/7/8/9/10/11/12 集。
- 默认只亮第一关：其余 9 关各加一层 {BT}Lock{BT}（4×4 纯白 Sprite，颜色 0,0,0,140），
  并把 {BT}cc.Button.interactable{BT} 置 false；{BT}LevelSelect.pick(){BT} 同时兜一道，
  未解锁的按钮即使收到触摸也不选关。
### 补丁 3（同日）：滚动位置与拖不动

- 现象：一进选关看到的是最底部，且拖不动。
- 根因：{BT}content{BT} 上挂了 {BT}Widget{BT}（{BT}alignMode = ALWAYS{BT}，{BT}top = 0{BT}）。Widget 每帧把
  {BT}content.position{BT} 按 top 摆回去，把 ScrollView 写进去的滚动量当场吃掉 —— 所以拖不动；
  而它算出来的初始位置是 (0, **1100**)，比 view 顶边（+550）高出一整屏，越界后 ScrollView 再吸到最近的边界，
  正好落在最底部。
- 改法：{BT}content{BT} 不再挂 Widget（位置归 ScrollView 管），宽度仍与 view 相同（672）由脚本直接给；
  排版完 {BT}layout.updateLayout(){BT} 后手动把 content 摆到「顶边对齐 view 顶边」：{BT}content.setPosition(0, viewH / 2, 0){BT}，
  实测 {BT}(0, 550){BT}、{BT}content.height = 1619{BT}、首行在 y = −171.5（即屏幕最上面三行）。
- 同时删掉 {BT}sv.view = view{BT}：{BT}ScrollView.view{BT} 在 3.8.8 是**只读 getter**（取 {BT}content.parent{BT}），
  赋值没有意义。
### 补丁 4（同日）：开局引导手指

- 新增 `assets/scripts/ui/LevelGuide.ts`：手指（复用 `UILayer/GuideLayer/GuideRoot/GuideFinger` 的「手指图标」）
  在第一关按钮中心与「右下偏移」之间反复按下去 / 抬起来（`pressTime = 0.35`、
  `liftTime = 0.25`、间隔 `gap = 0.35`），任何 `TOUCH_START` 立刻收起整棵引导；
  `onDisable` 对称解绑全局输入并 `Tween.stopAllByTarget(finger)`。
- 场景：节点 `Canvas/Change/Guide`（全屏 Widget，排在 ScrollView 之后 = 最上层）→ `Finger`（199×203，scale 0.8，
  编辑器里摆在 `(80, 318)`）；`target = Level_01`。`Guide` 本身不挂监听、不拦触摸，
  只有全局 `input` 一条监听 —— 所以它压在第一关上也不会吃掉按钮的点击。
- 这棵引导挂在 `Change` 里，选关一关掉它随父节点一起消失，不需要另外收。
### 补丁 5（同日）：指尖对准按钮中心 / 关卡标题去描边

- 手指：原锚点是 (0.5, 0.5)，等于把「图标中心」对到按钮中心，视觉上指尖还差小半指。
  改用**指尖**做锚点 —— 量 `huaban-6012849863.png` 的 alpha：原图 467×398，
  不透明区 bbox x 73..424 / y 20..350；SpriteFrame 裁切 rect = (53, 18, 391, 371)。
  指尖（最上面那一小簇）在纹理坐标 (≈81.5, ≈378)，折进 rect 得锚点 **(0.073, 0.970)**。
  这样 `LevelGuide` 把 finger 摆到按钮中心时，**指尖正好落在中心**。
- 关卡标题：去掉 `Label` 上的 `cc.LabelOutline`（深色宽 3），白字保持细体。
  挂载脚本里对应那段一起删了，重建后场景里 `cc.LabelOutline` 数量为 0。
### 补丁 6（同日）：黑字 + 引导随滚动暂停/恢复

- 关卡标题颜色 `(255,255,255)` → `(0,0,0)`。
- `LevelGuide` 从「碰一下就永久收起」改成**暂停 / 恢复**：
  - 全局 `TOUCH_START` + ScrollView 的 `SCROLL_BEGAN` / `SCROLLING` → `pause()`（停 tween、藏手指）；
  - `TOUCH_END` / `TOUCH_CANCEL` / `SCROLL_ENDED` → 等 `resumeDelay`（0.2s）后 `tryPlay()`；
  - `tryPlay()` 先算可见度：把目标按钮的世界框投到 ScrollView 的 view 局部系，与 view 矩形求交，
    面积比 ≥ `minVisible`（0.8）才重新起 tween，并把手指重新对到按钮**当前**中心（滚动后位置会变）；
    不够就保持藏起，等下一次滚动结束再判。
  - 可见度判定手算世界框（`UITransform 尺寸 × worldScale` + `anchor`），不用 `getBoundingBoxToWorld()`（AGENTS.md §6）。
- 场景：已把 `LevelGuide.scroll` 接上 `ScrollView` 组件。
### 补丁 7（同日）：选关禁止拖动

- `ScrollView.enabled = false`（挂载脚本里设一次），content 停在 `(0, 550)`，
  不再响应拖动 / 惯性；`view` 的 RECT Mask 照旧裁出框外内容。
- 代价：内容高 1619 > 可视 1100，共 5 行只看到前 3 行 —— **Level_07–10 落在框外、点不到**。
  当前只有第一关解锁，暂不影响流程；若要 10 关都能选，需要缩格子（改 `cellSize` + 卡片整体缩放）
  或把关卡数减到 6。
- `LevelGuide` 的暂停/恢复逻辑保留：滚动事件不再触发，点击时仍会「按下暂停 → 松手 0.2s 后恢复」。