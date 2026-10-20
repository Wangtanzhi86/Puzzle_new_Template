# 胶带擦完后淡入「修复窗户」（2026-10-19）

## 改了什么

- assets/scripts/gameplay/TapeWipe.ts
  - 新增 revealNode（擦完淡入的节点）与 revealFade（淡入时长，默认 0.3s）。
  - 最后一条胶带擦完、走完 gap 后：胶带保持显示，激活 revealNode，补一个 UIOpacity 并从 0 补间到 255（quadOut）；revealFade = 0 时当刻全亮。
  - revealNode 留空时什么都不做，胶带停在擦完的状态。
- assets/scene.scene
  - GameLayer/BrokenLayer/Slot_03/TapeWipe 的 revealNode 指向 Slot_03/修复窗户，revealFade = 0.3。
  - Slot_03/修复窗户 保持 active = false，并补了 UIOpacity（opacity = 0）。
- tools/js/mount-tape-reveal.js
  - 幂等接线脚本：把「修复窗户」接到 TapeWipe.revealNode、补 UIOpacity、保持节点初始隐藏。
- docs/STATUS.md 与 docs/TUNING.md 同步 Slot_03 的收尾说明与调参入口。

## 为什么这么改

需求是「贴胶带动画播放完后平滑地激活 Canvas/GameLayer/BrokenLayer/Slot_03/修复窗户」，随后明确「胶带不用隐藏了」。所以收尾只做一件事：保持胶带，把修复窗户从透明淡入。

曾按「先隐藏胶带根节点再激活修复窗户」实现过，后来按用户要求撤回隐藏那一句；现在 fadeInTarget() 里不再碰 this.root。

实现放在 TapeWipe 内部，而不是在 PieceSlot 里特判 Slot_03：胶带这一格本来就是它整段接管，「擦完收场」属于同一段表现；新增的是可选属性，别的槽位不受影响。

否掉的方案：直接在场景里给「修复窗户」挂独立脚本监听 PIECE_SHOWN。那样会晚于胶带收场，且要把「胶带什么时候算完」复制到第二个组件；放在 TapeWipe 的 done 前最直接。

## 怎么验的

- node tools/mcp.mjs run_script_diagnostics '{}'：TypeScript diagnostics completed successfully with no errors，exit 0。
- npm run check：ok: true，missing 仍为既有 5 条（ProgressController@UILayer label 空、四格贴纸+画笔双填、背景九宫格 inset 未配）。
- 解析 assets/scene.scene：修复窗户节点 _active: false，cc.UIOpacity._opacity: 0；TapeWipe.revealNode 指向该节点、revealFade: 0.3。
- 场景此前已存盘（bdd769ed-06ed-4ddc-86e0-54318ac1aeba）；本次只改脚本与文档，没有改场景。
- 未在 Game View / 真机看实际淡入观感（按约定不自证视觉）。

## 影响什么 + 还没验的部分

- 影响：Slot_03 胶带擦完后停在画面上，修复窗户用 0.3s 淡入；PIECE_SHOWN 仍在淡入开始时同拍抛（不额外等淡入结束），所以进度 / 扫光 / 终局计时不变。
- 没验：胶带与窗户同时在场时的层级是否合适；修复窗户当前排在 Slot_03 子节点最后，正常应压在胶带之上，但胶带根节点在 Scene_BG 下，实际遮挡关系还需在 Game View / 真机确认。
- 可调：TapeWipe 的「淡入时长（秒）」；若窗户被胶带盖住，需要调 Slot_03 与 Scene_BG/胶带 的兄弟顺序，而不是改这段代码。
