# 场景接线：按 CopyPuzzle 配置吸附 + 显示（SnapReveal）

- 日期：2026-10-19
- 提交：0717a18
- 关联：`docs/手感移植清单-到Puzzle_new_Template.md` 工作包 E、`docs/changes/2026-10-19-feel-drag-snap-insert-reveal.md`

## 改了什么

- **`assets/scene.scene`**（编辑器存盘，2026-10-19 09:22）：
  - `EffectLayer` 新增 `SnapReveal` 组件，`revealEffect` = `assets/effects/bg-reveal.effect`；
  - 参数按 CopyPuzzle 原值：`punchTime = 0.6`、`revealTime = 8`、`feather = 0.35`、`brightness = 5`、`waveOn = true`；
  - 23 个 `PieceSlot` 的「吸附瞬间揭晓」全部指向这个组件；
  - `Canvas/FeatureFlags` 的「吸附瞬间时序」打开；
  - `SnapSystem` 显式写 `snapMode = 1` / `snapRatio = 0.4`（对齐 `PuzzleItem.snapRadius = 0.4`）；
  - `PiecePool.insertOnFail = true` 显式落盘（原先只是类默认值）。
- **新增 `tools/js/apply-copy-snap.js`**：上面这一整套的幂等版本，重跑可原样恢复；只是配置，不改代码。

## 为什么这么改

- CopyPuzzle 的「吸附 + 显示」只有一条路：`PuzzleItem.snap()` → `_reveal()` → `_playSnapAnimation()`（0.6s 三段缩放 + 淡出）→ `scheduleOnce(_startFader, 0.5833)` → 8s `expoOut` 径向扩散（`brightness = 5`、`cos²(0.5 - uv0.x)` 水平波纹）。目标工程原先 23 格走的是「贴纸贴平」，是多套并行的一种，不是 CopyPuzzle 那套。
- **用脚本接线而不是手点**：组件 + 23 个引用 + 1 个开关，手点漏一个就有一格「没反应」；脚本可重跑、可读、可当回滚说明。
- 否掉的方案：
  - **把 `FeatureFlags.snapReveal` 的默认值改成 `true`**：一份工程被复制成多个日期目录时，默认值会跟着扩散；开关是场景数据，就该只在本工程打开。
  - **把 `SnapReveal` 挂到 `Canvas`**：特效统一挂 `EffectLayer`（`RepairReveal` / `CircleReveal` / `RepairSweep` 都在那），跟着走。

## 怎么验的

- 编辑器上下文 `execute_javascript` 返回「场景已存盘（bdd769ed-…）」。
- `assets/scene.scene` 文本里 `"snapReveal"` 出现 24 次（23 个槽位引用 + 1 个开关），`45692ecc-…`（bg-reveal uuid）在场景里。
- `node tools/exec.mjs scene tools/js/verify-scene.js --no-save`：`missing` 25 条全是既有告警（23 格「贴纸贴平 + 画笔涂色 都填了」、背景九宫格、ProgressController），**无新增**。
- **没有跑预览 / 没截图**：这一轮的验收交给人工试手感。

## 影响什么 / 还没验的部分

- 23 格现在**整格走 `SnapReveal`**：贴纸贴平、画笔、圆扩散、序列帧都不再发生；配置没有删，关掉 Canvas 上的开关就整条回退。
- 每格会新建一个 `Material`（`SnapReveal.play` 里 `new Material`，收摊时 `destroy`），23 格同时扩散时是 23 个 material —— **draw call 未测**，真机若掉帧先查这里。
- 8 秒扩散是 CopyPuzzle 原值；23 格并排看可能偏慢，`docs/TUNING.md` §16 已给「先试 1.2」的建议。
- 手感（35px 起拖、0.14s 追手、0.4 吸附比例、0.6s 冲击）都没在真机/预览里试过，**数值来源是 CopyPuzzle 代码而不是实测**。
