# 行李架下落改为「上一件落到一半就开始下一件」，并立即隐藏旧架子

- 日期：2026-10-19
- 提交：<待回填>
- 关联：docs/TUNING.md「行李架落下节奏」、docs/STATUS.md「槽位 1–4 吸附后」

## 改了什么

- `assets/scripts/gameplay/LuggageDrop.ts`：删掉「落地后停顿」`gap`，新增 `nextAt`（默认 `0.5`，显示名「下一件开始时机（占上一件时长）」）。每件落下后不再等它落地，而是在 `fallTime * nextAt` 之后启动下一件。
- `play()` 开头直接把 `hideNode`（旧 `Scene_BG/行李架`）设为 `active = false`，**第一件开始下落当刻就隐藏旧架子**；删除原 `hideTime` 淡出与 `hideRack()`，最后一件落完直接 `done()`。
- 修复「只掉两个」：调度改成 `this.scheduleOnce(() => next(), ...)`。原来直接 `this.scheduleOnce(next, ...)`，Cocos 调度器按 `(callback, target)` 复用条目，在 `next` 自身内部再排同一个 `next` 会被刚触发的旧条目吞掉，链条断在第二件。
- `assets/scene.scene`：`Slot_01` 的 `LuggageDrop` 写入 `nextAt = 0.5`，旧的 `gap` / `hideTime` 字段已移除。
- `docs/TUNING.md` / `docs/STATUS.md`：同步参数语义与当前状态。

## 为什么这么改

- 原先四件严格串行（上一件落地 + 0.06s 才放下一件），整段偏慢；改成在上一件下落动画播到一半时启动下一件，四件会短暂重叠，节奏更连续。
- 旧 `行李架` 会在新架子落下期间一直挡在前面，所以改为开始下落即隐藏，露出的就是 `修复完行李架`。
- 保留 `nextAt` 作为 Inspector 参数而不是写死 0.5：0 = 四件同时落，1 = 退回「上一件落地才下一件」，换节奏不用改代码。
- 否掉的方案：直接在 `next` 内 `scheduleOnce(next, ...)`（就是这次「只掉两个」的原因）；也否掉「最后一件落地后再等半程才收尾」，现在最后一件用 tween 完成回调直接 `done()`。

## 怎么验的

- `run_script_diagnostics`：0 错误。
- 场景脚本写入并保存成功（`bdd769ed-06ed-4ddc-86e0-54318ac1aeba`）。
- 解析 `assets/scene.scene` 确认 `LuggageDrop` 字段为 `fallTime: 0.35`、`nextAt: 0.5`，无 `hideTime`；`root` 的四个子节点仍是 `4 / 3 / 2 / 1`。
- 时间推演（`fallTime = 0.35`、`nextAt = 0.5`）：第 1 件 0s 起、0.35s 落；第 2 件 0.175s 起、0.525s 落；第 3 件 0.35s 起、0.7s 落；第 4 件 0.525s 起、0.875s 落；旧架子在开演当刻已隐藏。

## 影响什么 / 还没验的部分

- 只影响 `Slot_01` 的行李架落下段落，不动揭晓、吸附、事件与其它槽位。
- 视觉节奏（尤其 `bounceOut` 下重叠是否好看）还没有在 Game View / 真机看过，需实机确认；若觉得太挤，把 `nextAt` 调到 0.6–0.8 即可。
