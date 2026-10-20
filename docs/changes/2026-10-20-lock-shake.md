# 点未解锁关卡时锁图标晃一下（2026-10-20）

## 改了什么

- [LevelSelect.ts](assets/scripts/ui/LevelSelect.ts)：
  - 新增 4 个 Inspector 参数：`lockIconPath`（默认 `Window/LockIcon`）、`lockMarkPath`（默认 `Window/Lock`，`.active` 即未解锁）、
    `lockShakeAngle 9`（度）、`lockShakeTime 0.07`（单程秒）、`lockShakeTimes 3`（来回次数）。
  - `pick()` 在「已选过」「按钮不可点」判断**之前**先看锁：`item.getChildByPath(lockMarkPath).active` → `shakeLock(item)` 后 **return**，
    既不抛 `LEVEL_SELECTED`、也不收起选关。
  - `shakeLock()`：`Tween.stopAllByTarget(icon)` + `icon.angle = 0`（连点重来不会歪），
    然后 `9 / -9 / 9 / -9 / 9 / 0` 每 0.07s 一程（共 3 个来回，最后回正）。

## 为什么这么改

点锁着的关卡以前什么都不发生（`Button.interactable = false` 直接把点击吞了），玩家不知道是没解锁还是没点到。
晃一下锁图标是最小成本的「这关还没开」提示，不新增弹窗、不新增文案。
没走 `Button` 的点击回调：`interactable = false` 时它根本不发事件，所以判断放在 `LevelSelect` 自己的 `TOUCH_END` 里。

## 怎么验的

- 场景核对：`Level_02..10` 的 `Window/Lock` 均 `active = true`；`Level_01` **没有** `Lock` 节点（它是解锁的那张），
  虽然也有 `LockIcon` 子节点 —— 所以它点下去照常进游戏，不会被误判成锁着的。
- TS 诊断 `no errors`。新字段值与类默认值相同，场景序列化时被省略（运行时照样是 9 / 0.07 / 3）。
- 按约定没有跑预览。

## 影响什么 + 还没验的部分

- ⚠️ 连点同一张卡：`Tween.stopAllByTarget` 会先掐掉上一轮再从 0 度重来，不会叠加。
- 没验：晃动幅度/时长的手感（9° × 0.07s × 3 次≈0.42s）；要不要配一声「咔哒」。