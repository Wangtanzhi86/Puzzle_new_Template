# 最后一块修好直接进结束界面（2026-10-19）

## 改了什么

- `assets/scripts/level/SceneBgSwap.ts`
  - `instant = true` 的语义从「直接亮完成图」扩成「**直接亮完成图并进结束界面**」。
  - `onLevelComplete()` 里在 `reveal()` 之后补 `endShow()`（`delay > 0` 时两拍一起推迟）。
  - `instant` 的 Inspector 显示名改为「直接亮出来并进结束界面」；类注释同步。
  - `onShown()` 里的 `if (this.instant) this.endShow()` 保留作兜底，注释写明正常路径已在 `LEVEL_COMPLETE` 走掉。
- `assets/scene.scene`
  - `GameLayer/Scene_BG` 的 `SceneBgSwap.instant` 由 `false` 改为 `true`（`delay = 0` 不变）。
- `tools/js/mount-scene-bg.js` / `tools/js/set-finale.js`
  - 注释与时间轴说明改为「从最后一块落位（`LEVEL_COMPLETE`）起算，`delay` 后亮图 + `END_SHOW`」；
    取消勾选才回到「最后一格露面 → 画笔 → `END_SHOW`」。
- `docs/STATUS.md` / `docs/TUNING.md`
  - 收尾、完成背景、结束界面、`instant` / `delay` / 画笔参数、`LAST_SHOWN` 的现状与待确认口径全部同步。

## 为什么这么改

需求是「最后一个物品修复完后就直接弹结束界面」。原来最后一块**吸附成功**后还要等它的 `PIECE_SHOWN`（放置那一段演完），
再等完成背景画笔 1.5s，才抛 `END_SHOW`。现在把 `END_SHOW` 提到 `LEVEL_COMPLETE` 同一拍（`SceneBgSwap.instant` 的既有分支），
`CtaController` 仍然只听 `END_SHOW`，没有改事件、也没有改 CTA 的显示逻辑。

否掉的方案：在 `RepairSystem` 里直接 `emit(END_SHOW)`。那会把「什么时候算结束」散到两个组件，
且 `SceneBgSwap` 的完成图亮出与 `END_SHOW` 不再同拍；沿用 `instant` 分支只改一处。

## 怎么验的

- `node tools/mcp.mjs run_script_diagnostics '{}'`：`TypeScript diagnostics completed successfully with no errors`，exit 0。
- `npm run check`：`ok: true`；`missing` 仍是改动前那 5 条（`ProgressController@UILayer` 的 label 为空、
  四格贴纸贴平 + 画笔涂色双填、背景九宫格 inset 未配），无新增告警。
- 解析 `assets/scene.scene` 确认 `SceneBgSwap.instant = true`、`delay = 0`、`CtaController.endVideo = null`、
  `EndgameCta.winCount = 0`。
- 未在 Game View / 真机看实际节奏（按约定不自证视觉）。

## 影响什么 + 还没验的部分

- **影响**：最后一格吸附成功当拍就亮完成图并弹结束界面；最后几格的「贴纸按平」会被 CTA 盖掉；
  `LAST_SHOWN` 那条 `魔法光粒.MP3` 实际不响（`END_SHOW` 已先 `stopAll` 并锁死）。
- **没验**：CTA 淡入 0.25s 是否够遮住完成图切换那一下、结束界面出现得是否太硬，需要实际看。
- **待确认**：`完成背景` 的 SpriteFrame 当前为 null，`SceneBgSwap.complete()` 会把 `Scene_BG` 贴图设为 null；
  `End/bg` 仍是纯白 4×4，结束界面现在是白底。这是既有美术状态，本次未改。
