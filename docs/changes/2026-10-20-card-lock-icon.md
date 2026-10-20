# 选关卡片：内框上移 10、锁层降到 85、中间加锁图标（2026-10-20）

## 改了什么

- 每张 `Level_XX/Window` 的局部 `y += 10`（现 y = 5.26）。
- `Window/Lock` 的 Sprite 颜色由 `rgba(0,0,0,140)` 改成 `rgba(0,0,0,85)`。
- 每张卡在 `Window` 里加 `LockIcon`（child 顺序 `Fill → Lock → LockIcon`，吃同一层圆角遮罩）：
  `assets/recourses/UI及背景/suo.png`（spriteFrame `48fef97f-...@f9941`，230×279），
  居内框中心，按 `min(内框宽×0.55/图宽, 内框高×0.55/图高)` 缩到 0.44。
- 接线脚本 [mount-card-lock-icon.js](tools/js/mount-card-lock-icon.js)（幂等：已有 `LockIcon` 就原地改，不重复建）。

## 为什么这么改

按需求逐条落：内框整体上移 10，未解锁卡的压暗浅一点（140 → 85），中间压一个锁图标而不是只有一片暗色。
图标放进 `Window` 而不是卡片，是为了**跟着内框的圆角遮罩一起裁**、并被白框盖住边缘。

## 怎么验的

- `node tools/mcp.mjs run_script_diagnostics '{}'`：`no errors`。
- `npm run check`：`ok: true`。
- 场景 JSON 核对：`Level_02/Window._lpos.y = 5.2567`，子节点为 `[Fill, Lock, LockIcon]`。
- 按约定**没有**跑预览看实际效果。

## 影响什么 + 还没验的部分

- **影响**：`Level_01` 也加了锁图标（需求说的是「每个关卡」），但它本来没有 `Lock`、是解锁状态 ——
  若第一关不该有锁，把 `Level_01/Window/LockIcon` 删掉即可（或重跑脚本时加个 skip）。
- **没验**：图标 0.44 倍在真机上大小是否合适；`Window` 上移 10 后与白框内沿是否还对齐。