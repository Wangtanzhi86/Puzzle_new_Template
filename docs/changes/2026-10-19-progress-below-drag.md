# 拖拽碎片压过进度条（2026-10-19）

## 改了什么

- 场景层级：把 `ProgressLayer` 从 `UILayer` 下移到 `Canvas` 下，排在 `PiecePoolLayer` 之后、`DragRoot` 之前。
  - 新顺序：`PiecePoolLayer → ProgressLayer → DragRoot → EffectLayer → UILayer(GuideLayer, CtaLayer) → GameCta`。
  - 只改父节点与兄弟序，`ProgressLayer` 的位置 / 尺寸 / 组件 / 世界坐标不变（`UILayer` 在 0,0、scale 1）。
- `assets/scripts/level/SceneBgSwap.ts`：`layersByName()` 的进度条兜底改成先找 `Canvas/ProgressLayer`，找不到再回退 `UILayer/ProgressLayer`；tooltip 同步。
- `assets/scripts/bootstrap/GameEntry.ts`：`[Probe] progressY` 不再写死 `UILayer/ProgressLayer` 路径。
- 新增接线脚本 `tools/js/mount-progress-order.js`（幂等）：已在 Canvas 下且排在 DragRoot 前就什么都不做。
- `AGENTS.md` / `docs/ADAPT.md` 的层级说明同步。

## 为什么这么改

拖起来的碎片被 `setParent(dragRoot)` 挪到 `DragRoot` 下，而 `DragRoot` 原先排在 `UILayer` 之前；`ProgressLayer` 是 `UILayer` 的子节点，所以整条进度条压在拖拽层上面，碎片经过 y≈-275 时被盖住。

把 `ProgressLayer` 下移一层即可：拖拽层仍在它上面，但 `EffectLayer`、`UILayer`（CtaLayer）和 `GameCta` 仍在拖拽层上面，修复特效与 CTA 的遮挡关系不变。

否掉的方案：
- 把 `DragRoot` 整体挪到 `UILayer` 之后：会连 `CtaLayer` / 结束界面一起压住，游戏中拖拽碎片可能盖住 CTA。
- 把 `DragRoot` 挪进 `UILayer`、排在 `ProgressLayer` 后：拖拽层会同时压过 `EffectLayer`，改变修复特效与碎片的遮挡关系。
- 用 `UITransform.priority` 调渲染顺序：跨父节点不稳，且碎片子节点多，容易漏。

## 怎么验的

- `node tools/exec.mjs scene tools/js/mount-progress-order.js`：返回 `parentBefore: UILayer`、`parentAfter: Canvas`；Canvas 顺序为 `PiecePoolLayer / ProgressLayer / DragRoot / EffectLayer / UILayer / GameCta`；场景已存盘（`bdd769ed-06ed-4ddc-86e0-54318ac1aeba`）。
- 解析 `assets/scene.scene`：`ProgressLayer` 的 `_parent` 指向 Canvas，`_lpos.y = -275.481`；`UILayer` 子节点只剩 `GuideLayer / CtaLayer`；`SceneBgSwap.hideBeforeReveal` 仍引用进度条节点。
- `node tools/mcp.mjs run_script_diagnostics '{}'`：0 错误。
- `npm run check`：`ok: true`，missing 仍是既有 5 条（`ProgressController@UILayer` label 空、四格贴纸+画笔双填、背景九宫格 inset 未配）。
- 未在 Game View / 真机实际拖动验证遮挡（按约定不自证视觉）。

## 影响什么 + 还没验的部分

- 影响：拖拽碎片现在盖住进度条；进度条与 `DragRoot` 的相对顺序固定，转屏时两者都不贴边，位置不变。`ProgressController` 仍挂在 `UILayer` 上、`fill` 仍指向原来的 Sprite，进度功能不受影响。
- 没验：横屏 / 撑满后进度条与拖拽路径的实际重叠情况；`SceneBgSwap` 收场时对进度条的淡出仍走原引用，未在真实结束流程里复看。
- 若以后把 `ProgressLayer` 再挂回 `UILayer`，需要同步改回 `SceneBgSwap.layersByName()` 与 `GameEntry` 的兜底路径。
