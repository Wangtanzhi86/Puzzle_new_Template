# 新增「选关 → 开场动画 → 点击开始」前置流程

- 日期：2026-10-20
- 提交：<待回填>
- 关联：AGENTS.md §5（事件清单）/ §10（工作方式）/ docs/STATUS.md
- ⚠️ 本文件描述的是第一版流程；同日晚些时候的改版（去标题、去「点击屏幕开始」、接全屏开头视频）见 [2026-10-20-intro-video.md](2026-10-20-intro-video.md)

## 改了什么

- 新增 `assets/scripts/ui/LevelSelect.ts`：选关面板。暴露 `items: Node[]` 与 `levelCount`（0 = 按按钮数算）。
  `onLoad` 强制 `node.active = true`（加载即亮），每个 item 绑 `TOUCH_END`，点中即隐藏自己并抛 `LEVEL_SELECTED(index)`；
  `pick()` 幂等（`_picked` 去重），另留 `show()` 用于日后回到选关。
- 新增 `assets/scripts/ui/GameIntro.ts`：进场全屏动画。两块满屏挡板从中间合拢再向两侧滑出、标题「第 N 关」放大淡出；
  演完 `node.active = false` 并抛 `INTRO_DONE`。时长参数全在 Inspector（`holdTime` / `slideTime` / `sweep` / `captionFade`）。
- 新增 `assets/scripts/ui/StartGuide.ts`：动画后的引导层。听 `INTRO_DONE` 亮出「点击屏幕开始」+ 手指呼吸，
  点一下收掉并抛 `GUIDE_RESUME` + `GAME_START`。
- `assets/scripts/core/GameEvent.ts` 新增三个事件：`LEVEL_SELECTED` / `INTRO_DONE` / `GAME_START`。
- `assets/scripts/bootstrap/GameEntry.ts`：`start()` 不再直接建关，改为等 `LEVEL_SELECTED`；收到后 `levelFactory.build()`，
  紧接补一次 `GUIDE_HOLD`（建关会重置 `GuideController._holds`，所以必须放在 `build()` 之后），再 `scheduleOnce` 触发一次空闲探针。
- 场景（`assets/scene.scene`，由 `tools/js/mount-level-flow.js` 幂等挂载）：
  - `Canvas/Change`：补全屏 `UITransform` + `Widget`，挂 `LevelSelect`；下面 `Panel`（全屏 + `BlockInputEvents`）→ 深色 `BG` →「选关」标题 → 提示语 → 三个关卡按钮 `Level_1..3`（圆角白底 + 「第 N 关」文字）。
  - 新建 `Canvas/IntroLayer`（全屏 + `BlockInputEvents` + `GameIntro`）→ `Left` / `Right` 两块 1700×1700 白板 + `Caption`。
  - `UILayer` 下新建 `StartGuide`（全屏）→ `Panel`（全屏 + `BlockInputEvents`）→ `HintBG` / `Hint` / `Finger`。
  - Canvas 子节点顺序末尾为 `… GameCta, IntroLayer, Change`：选关盖住开场挡板，开场挡板盖住玩法。
- 新增 `tools/js/mount-level-flow.js`：上面这整套节点与组件接线的可重复脚本（幂等，重跑不重复建节点）。

## 为什么这么改

- **选关做成独立组件而非直接改 `GameEntry`**：关卡数量、按钮排布都还没定，`LevelSelect` 只认 `items` 数组，
  以后换成一屏 10 关或走 Prefab 都不用动流程代码；`levelCount = 0` 时按按钮数算，少配一个字段。
- **`GameEntry` 只改「何时建关」，不改建关逻辑**：`LevelFactory.build()` / `GUIDE_HOLD` 顺序原样保留，
  玩法侧（PiecePool / SnapSystem / 埋点）一行没动。
- **开场动画用两块挡板对滑**，不用相机 / 遮罩 / 换场景：节点全在 `IntroLayer` 里，演完直接 `active = false`，
  没有残留状态，也不影响 `ScreenAdapter` 的转屏重排（挡板是 Widget 全屏 + 1700 尺寸兜底，横屏也盖得住）。
- **引导做成「点一下就走」**，不设自动超时：试玩广告里第一次交互就是音频解锁点，让玩家主动点一下最稳；
  同时抛 `GUIDE_RESUME` 让 `GuideController` 的空闲引导计时从现在开始，而不是从加载时算。
- 否掉的方案：直接把 `Change` 当纯占位节点、流程写在 `GameEntry` 里 —— 那样选关按钮得由代码生成，违反 §3「关键视觉节点不许代码生成」。

## 怎么验的

- 按老板要求**没有**跑预览 / 重建 / 截图自证。
- 已做的静态核对：`tools/js/mount-level-flow.js` 在 `scene` 上下文跑通并自动存盘；直接解析 `assets/scene.scene` 确认
  `Change` 的组件是 `UITransform + Widget + LevelSelect`（`items` 3 个、`levelCount = 3`）、
  `IntroLayer` 挂着 `GameIntro`（`left` / `right` / `caption` / `sweep = 1700`）、`StartGuide` 挂着 `panel` / `hint` / `finger`。
- TypeScript 未做编译验证（未开预览即未走引擎编译）。

## 影响什么 / 还没验的部分

- **游戏不再自动开局**：必须先点关卡。若以后要「跳过选关」，把 `LevelSelect` 从 `Change` 上摘掉即可（但 `GameEntry` 会一直等事件），
  或者给 `GameEntry` 补一个无选关时的兜底（当前**没做**，按需求不需要）。
- 选关背景是纯色深底 + 圆角白按钮，**纯占位美术**，等设计稿。
- 三个关卡按钮目前都进同一个关卡（`levelId` 只用于标题文案和 `_levelId` 记录），多关卡数据还没接。
- 开场动画与引导层叠在玩法之上，`BlockInputEvents` 期间玩家点不到碎片 —— 这是预期；
  但**没验**首次点击能不能同时解锁音频（`AudioManager` 的全局 `input` 解锁应该会触发）。
- `GameIntro` 的 `onDisable` 会停掉挡板 / 标题 / 标题透明度的 tween，避免中途被关掉时残留；
  转屏时不做特殊处理（`Widget` 负责重排，动画本身是位移，横屏滑出距离 `sweep = 1700` 足够盖住 1280 宽）。