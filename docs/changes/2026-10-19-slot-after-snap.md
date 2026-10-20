# 槽位 1–4 吸附后的整段表现（行李架落下 / 石膏胳膊 / 胶带擦出 / 女主换姿势）

- 日期：2026-10-19
- 提交：<待提交>
- 关联：AGENTS.md §5 / §6 / §15

## 改了什么

- 新增 `gameplay/SlotAfterSnap.ts`：挂在槽位节点上的「吸附后整段表现」基类。`PieceSlot.repair()` 发现它就让位：
  - 不勾「等本格揭晓演完再开始」→ 当场收掉本格破损图 / 修复图，播完表现才抛 `PIECE_SHOWN`；
  - 勾上 → 先走本格原有揭晓，露面后再播，播完才抛 `PIECE_SHOWN`。
- 新增四个子类：
  - `LuggageDrop`（Slot_01）：放出 `修复完行李架`，子节点 4→3→2→1 依次从上方 `dropFrom` 处落到原位，上一件落地才激活下一件。四件全部落完，再把旧 `行李架` 用 `hideTime`（默认 0.2s）淡出隐藏；落下期间旧架子保持完整可见。
  - `RevealNodes`（Slot_02）：同时打开 `Slot_02/石膏胳膊` 与 `Scene_BG/男主表情`，各加 `UIOpacity` 从 0 淡入到 255，并从 `scaleFrom`（默认 0.9）弹回原尺寸。
  - `TapeWipe`（Slot_03）：放出 `胶带`，子节点依次用 Sprite FILLED + HORIZONTAL 擦出；默认隔一条反向（1 左→右、2 右→左、3 左→右）。
  - `PoseCrossFade`（Slot_04）：`女主` 淡出、`女主姿势变化` 淡入，勾了「等揭晓演完」，默认 `fadeTime = 0.35s`。
- 场景接线走 `tools/js/mount-slot-stage.js`（幂等）：四个组件分别挂到 `Slot_01`…`Slot_04`，节点引用已写好；`胶带` 根节点在场景里改为 `active = false`。

## 为什么这么改

- 表现挂在槽位节点上、由 `PieceSlot` 直接按组件取，不走事件 + slotIndex 过滤：`Slot_03` / `Slot_04` 的 `pieceId` 仍是重号（3/3），用事件里的排序下标对不上号，直接拿本格组件最稳。
- 擦出用引擎自带 FILLED，不另做 Mask / 材质：与 `GroundWater` 同一条路，横向 `fillStart = 0` 向右长、`fillStart = 1` 配负 `fillRange` 向左长。
- 旧架子只做「四件落完再整体淡出」，不再逐件挖洞：反向 `Mask` + `Graphics` 虽然能跟着新行李逐块露出来，但每件落地时旧图边缘会突然缺一块，观感生硬；改成全部落完再淡出，节奏更顺，也少一套 Mask / Graphics 依赖。
- 否掉的方案：给四个效果各写一个「监听 PIECE_REPAIRED + slotIndex」组件 —— 事件顺序与重号都不可靠，且拿不到「收掉本格立刻开演」这个时机。

## 怎么验的

- `npx tsc --noEmit -p tsconfig.json` 通过（0 输出）。
- `node tools/exec.mjs scene tools/js/mount-slot-stage.js` 返回四个组件挂载成功并已存盘。
- 只读探针确认：Slot_01/02/03/04 分别拿到 `LuggageDrop` / `RevealNodes` / `TapeWipe` / `PoseCrossFade`，节点引用与 `afterShown` 正确，`胶带` 根节点为 off。
- 旧架子结构：`Scene_BG/行李架` 已恢复为 `Scene_BG` 直接子节点（sibling index 3），组件只有 `UITransform` + `Sprite`，无 `Mask` / `Graphics`；`LuggageDrop.hideNode` 指向它，位置恢复为原始 `(0, 307.418)`。
- 场景落盘后复查 `.scene`：不再存在 `行李架遮罩` 节点，也没有残留的 `cc.Mask` / `cc.Graphics`。
- `npm run check` 只剩既有的 `ProgressController.label`、贴纸+画笔并存、背景 inset 三类旧告警，无新增。

## 影响什么 / 还没验的部分

- `PieceSlot` 的 `PIECE_SHOWN` 对挂了表现的槽位会延后到表现演完；进度 / 终局计数照旧按吸附当刻走。
- 节点路径保持原样：`Scene_BG/行李架`，没有新增中间层。
- **视觉与节奏未实测**：落下高度 `160`、下落 `0.35s`、旧架子淡出 `0.2s`、擦出 `0.5s`、石膏/表情淡入 `0.35s`、姿势过渡 `0.35s` 都按经验值先配，需在 Game View / 真机看。
- `胶带` 的子节点是运行时才切 FILLED，编辑器里仍是 SIMPLE（不影响预览）。
