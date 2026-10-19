# 手感移植 B/C/D/E：拖拽三段、按轴矩形吸附、托盘失败插入、吸附瞬间时序开关

- 日期：2026-10-19
- 提交：56e71b8
- 关联：`docs/手感移植清单-到Puzzle_new_Template.md` 工作包 B/C/D/E（源清单在 CopyPuzzle 仓）

## 改了什么

- **B 拖拽三段** `assets/scripts/gameplay/DragController.ts`
  - 按下只记 `_pressAt`（手指 UI 坐标）/ `_pressPiece`（碎片世界坐标，**必须在 `takeOut` 之前记** —— 换父节点只保本地坐标），碎片原地不动，只演放大。
  - 位移过 `moveStartDistance = 35` 才起拖，起拖先用 `catchTime = 0.14`（linear）从原地**追**到「按下时碎片位置 + 手指位移」；补间期间 `onMove` **只更新终点**，跑完才 1:1 跟手。
  - 新增 `touchOffsetY = 0`（碎片离手指的纵向偏移）、`pickScaleTime = 0.14`（原 0.12，对齐原版）。
- **C 吸附判据** `assets/scripts/gameplay/SnapSystem.ts` / `assets/scripts/level/PieceSlot.ts`
  - 新增 `snapMode`（`0` = 圆、`1` = 按轴矩形，**默认 1**）与 `snapRatio = 0.4`。
  - 矩形式：`|Δx| ≤ slot.carryWidth × r && |Δy| ≤ slot.carryHeight × r`，`r` 逐格优先（`PieceSlot.snapRatio > 0`），基准是**修复图**的世界宽高（`carryWidth`/`carryHeight`），与 `_checkSnapping()` 的 `k × 碎片宽/高` 同义。
  - `PieceSlot.snapRadius` / `snapRadiusRatio` 保留，**只在圆形模式（`snapMode = 0`）下读**，tooltip 写明。
- **D 失败插入** `assets/scripts/gameplay/PiecePool.ts` / `assets/scripts/gameplay/DragController.ts`
  - 新增 `insertOnFail = true` / `insertTime = 0.14` 与 `insertNearest(entry)`：按碎片**当前横向位置**找最近的插入下标，`spacer.setSiblingIndex` 插进去 → 记 `from` → `layout.updateLayout(true)` → `centerLayoutContent` → 再读 `to` → `backOut` 滑 `insertTime` → `settle` 落到 `spacer` 的世界位置。
  - `onEnd` 里只有 `started && pool.insertOnFail` 才插入，否则照旧 `sendHome(entry, false)`；`PIECE_SNAP_FAIL` 的发射时机和顺序没变。
- **E 吸附瞬间时序** `assets/scripts/config/FeatureFlags.ts` / 新增 `assets/scripts/gameplay/SnapReveal.ts` / `assets/scripts/level/PieceSlot.ts`
  - `FeatureFlags.snapReveal`（`DEFAULTS` + 实例 `@property` + 静态 getter 三处，**默认 false**）。
  - `SnapReveal`（挂 `EffectLayer`，全局一份）：`punchTime = 0.6` 为整段节奏尺子 —— 0–0.417T 三段缩放冲击、同时淡到 0；0.972T 时 `state.p` 归零、从圆心 `expoOut` 扩 `revealTime = 8`；材质 `bg-reveal.effect` 加 `feather = 0.35` / `brightness = 5` / `waveOn = true`（`cos²(0.5-uv0.x)` 水平调制）。
  - `PieceSlot.snapReveal` 在 `repair()` 里排**第一分支**：指了就整格走它，覆盖贴纸 / 画笔 / 圆扩散 / 序列帧。材质每个 handle 一份、收摊时 `destroy()`。
- 接线脚本 `tools/js/mount-snap-reveal.js`（幂等，**未跑**）+ `docs/TUNING.md` 新增 4 行参数。

## 为什么这么改

- **B 用「相对跟手」不是绝对跟手**：绝对跟手（碎片世界坐标 = 手指 UI 坐标）会在按下的瞬间把碎片拽到指肚下 —— 按在边角上就跳。原版也是相对量（`_desired = 按下时碎片位置 + 手指位移 + offset`）。
- **B 的阈值判总位移、不判 `Δy > 0`**：原版托盘在屏幕下方，所以只判向上；本工程横屏托盘跑到**侧面**，只判 `Δy` 就永远起不了拖。
- **C 基准取修复图而不是缺口框**：`Slot_06` 的白线框 55×44、实物 52×73（差六成），拿框当基准会让判据和玩家眼前那块碎片对不上。
- **C3 保留圆形当回退，没有把 `snapRadius` 重新解释成「半宽半高」**（否掉的方案）：改语义的话 23 格已调好的 `snapRadiusRatio` 全要重试，而收益只是少一个分支。现在两套语义并存但各有明确开关（`snapMode`），Inspector 里一眼能看出哪套在生效。
- **D 不去打开 `reflow`**（否掉的方案）：`reflow` 是「用掉之后补位」，语义是全局的；失败插入是「这次松手插回哪儿」，两者叠加会把空位模型搞乱。实现上直接复用 `spacer`（`takeOut` 已经建好的不可见占位）当「这一格被占用」，不新建视觉节点。
- **E 做成槽位覆盖 + 总开关**：原版这套时序和本工程「贴纸贴平」是**互斥**的两条演法，能共存的只有「按格选」。保守方案（只在槽位没配揭晓时生效）会导致「美术配了贴纸 ⇒ 开关白开」，所以按激进方案定了，tooltip 里写明「填了就整格走它」。
- **E 的冲击只演 0.417T 就被淡化吞掉**：原版就是这样 —— 玩家看到的是「弹一下、化掉、再从中心长出来」，不是「弹完完整停在那儿」。淡化归零那一刻正好是扩散启动那一刻，跳变被 0 不透明度盖住。

## 怎么验的

- 静态核查：`grep -rn "snapMode\|insertOnFail\|snapReveal" assets/scripts` 确认三个新开关都有读点；`git diff` 逐段复核。
- **`npm run check` 没跑成**：`连不上 MCP (http://127.0.0.1:21058/mcp)：fetch failed`（编辑器没开，端口按项目路径现算）。
- **没有任何视觉验证**：拖拽手感、矩形判据的 23 格松紧、失败插入的观感、吸附时序的节拍，全部**没在预览里看过**。

## 影响什么 / 还没验的部分

- `assets/scene.scene` 里这些新 `@property` **一个都没落盘**（`snapMode` / `snapRatio` / `moveStartDistance` / `catchTime` / `touchOffsetY` / `insertOnFail` / `insertTime` / `snapReveal` 计数全 0）⇒ 现在走的是**类默认值**：矩形吸附开、失败插入开、吸附瞬间时序关。存一次场景就会把它们写进去。
- E 那条**整体跑不到**：`EffectLayer` 没有 `SnapReveal` 实例、没有槽位指它、开关还关着。要开：`node tools/exec.mjs scene tools/js/mount-snap-reveal.js` → 给槽位指 `snapReveal` → Canvas 面板勾「吸附瞬间时序」。
- E6 第 6 拍（关联物错峰淡入 `delay 0.5 + 0.12 × i`）**没做**：得有场景里现成的关联物节点才谈得上，`SnapReveal` 里没有 `nodes` 数组。
- 23 格手感要人工试：`snapRatio = 0.4` 是原版的 k，本工程碎片更大、屏幕更小，可能偏松；逐格 `PieceSlot.snapRatio` 是留给这件事的口子。
