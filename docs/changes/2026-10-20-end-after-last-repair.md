# 结束界面改到「最后一格修复演完」才弹（2026-10-20）

## 改了什么

- `assets/scripts/level/SceneBgSwap.ts`
  - `instant` 的语义收窄成「**完成图直接亮出来**」：`onLevelComplete()` 只做 `reveal()`（亮完成图），**不再同拍 `endShow()`**。
  - `onShown()`（最后一个 `PIECE_SHOWN` = 最后一格揭晓演完）在 `instant` 下 `endShow()` —— 结束界面在这一拍才亮。
  - 类注释、`instant` / `delay` 的 `displayName` / `tooltip`、`reveal()` 里的行内注释同步。
- `assets/scene.scene`
  - `CtaController.logo` 由 `null` 补成 `UILayer/CtaLayer/CtaRoot/End/文字标题`（`verify-scene.js` 早就报 NULL：
    原来的 `show()` 会走到 `drop(null)` 直接抛，logo 不下来、`END_DROP` 也不发）。
- `tools/js/mount-scene-bg.js` / `tools/js/set-finale.js`：注释与 `toEndShow` 口径改成「`instant` 时结束界面时间不确定（等最后一格 `PIECE_SHOWN`）」。
- `docs/STATUS.md` / `docs/TUNING.md` / `docs/ARCH.md`：收尾、完成背景、结束界面、`instant`/`delay` 的现状同步。

## 为什么这么改

需求是「激活 `End` 的那一拍改到最后一个物品修复完毕之后」。原来 `END_SHOW` 在 `LEVEL_COMPLETE`（最后一块**吸附成功**）就抛，
最后那几格的「贴纸按平」被结束界面盖掉。现在把两件事拆开：

- **亮完成图**仍留在 `LEVEL_COMPLETE`（这时候所有碎片都已落位，底板不会是线稿，也不用等）；
- **`END_SHOW`（= 结束界面、`CTA_SHOW`、停全部音）**推迟到最后一个 `PIECE_SHOWN`，也就是最后一格修复演完的那一拍。

否掉的方案：在 `CtaController` 里自己数 `PIECE_SHOWN`。那样「什么时候算结束」会散到两个组件，而且 `CtaController` 得再拿一份总数；
`SceneBgSwap` 本来就按 `LEVEL_BUILT` 的总数在数 `PIECE_SHOWN`，沿用它的 `onShown()` 只改一处。

## 怎么验的

- `node tools/mcp.mjs run_script_diagnostics '{}'`：无 error。
- `npm run check`：`ok: true`，`missing` 与改动前一致（只剩既有的进度条 label、四格「贴纸贴平+画笔都填」、背景九宫格 inset）。
  其中 `CtaController@CtaLayer` 那条 NULL 已随本次补 `logo` 修掉。
- 按约定**没有**跑预览 / 截图看节奏。

## 影响什么 + 还没验的部分

- **影响**：最后一格揭晓能演完再进结束界面；`LAST_SHOWN` 那条音效（`魔法光粒.MP3`）与 `END_SHOW` 现在同拍，可能撞一下。
  `instant` 勾着 + `delay > 0` 时，`delay` 只推迟「亮完成图」，不再影响结束界面。
- **没验**：最后一格演完 → 结束界面之间现在没有转场（只有 `bgFadeTime` 0.25s 淡入），要不要补一拍得在 Game View / 真机上看。


## 补：这一关没有修复图

- `SceneBgSwap.reveal()` 开头加一条早退：`revealView` 为空**或它的 `spriteFrame` 为空**时什么都不动 ——
  不把 `完成背景` 的（空）贴图挪到 `Scene_BG`（原来会把底图清空），也不 `fadeOut(hideBeforeReveal)`（破损图 / 碎片池 / 毯子那层留着）。
  `END_SHOW` 照旧在最后一个 `PIECE_SHOWN` 抛。
- `assets/scene.scene`：`CtaController.hideNodes` 由 `[BrokenLayer]` 清空 —— 结束界面出现时也不再收破损图。
