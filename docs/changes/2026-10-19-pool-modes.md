# 碎片池拆成两种模式（BATCH / SCROLL，用一个下拉切换）

- 日期：2026-10-19
- 提交：0717a18
- 关联：AGENTS.md §15 / §16、docs/TUNING.md、docs/worklog/（碎片池相关）

## 改了什么

- `PiecePool` 新增 `poolMode`（枚举 `PoolMode`）：`BATCH`（默认，行为与改动前完全一致）/ `SCROLL`（整关一次全摆出来、可滑，忽略 `batchSize`）。
- `SCROLL` 下：不居中、不再被 `batchSize` 截断、ScrollView 自身可滑；`PiecePool` 监听 `ORIENTATION_CHANGED`，横屏左右两栏时自动切成竖向滑并回到顶部/最左。
- `DragController` 在 `SCROLL` 下改成「先判方向、再决定拿碎片还是滚池子」：按下的头 35px 内位移主要落在池子滑动轴上就交给 ScrollView，否则才 `takeOut` 拿碎片（`BATCH` 仍是按下即拿）。
- `LandscapeLayout` 的两处 `centerLayoutContent(sv.content)` 改走 `PiecePool.alignContent()`，让横竖屏切换也遵守当前模式。
- 转屏安全：`alignContent()` 先把滑动轴拨正再落位（否则 `scrollToLeft` 的位移会被 `_flattenVectorByDirection` 清掉）；`DragController` 转屏时把碎片回位推迟到这一轮监听跑完之后，避免 tween 目标取到旧位置。
- `AutoPlayer` 在 `SCROLL` 下仍按 `batches × batchSize` 一批一批放（否则接管瞬间会把剩下的二十来块一次全飞出去）；`BATCH` 不变。
- 顺手把 `assets/scene.scene` 里被试跑写成 `6` 的 `batchSize` 改回 `3`（与 `docs/STATUS.md` 一致）。

## 为什么这么改

- 需求是「两种池子，开关切换」：每屏固定 N 块不可滑 / 全部摆出可滑。用一个枚举而不是两个布尔：两档互斥，布尔需要额外校验「两个都勾」的非法态；枚举在 Inspector 里就是一次下拉。
- 「全摆出来」没有走「把 `batchSize` 填 0」那条老路：填 0 仍是居中、不可滑，解决不了「可滑动」。
- `SCROLL` 下不能按下即 `takeOut`：一旦把碎片摘出 `content`（还带 spacer），ScrollView 就滚不动了。所以要先判方向；判成滚池子时**不建 spacer、不 takeOut**，池子保持原样。
- 方向判据用「总位移超过 `moveStartDistance` 后，位移主要落在池子的滑动轴上就算滚池子」，不引入新参数；滑动轴由 `PiecePool.scrollAlongX` 看 Layout 主轴现定（横屏竖栏是纵向滑），所以不能写死 |dx| > |dy|。代价是斜着划会按主轴归边。
- 换轴时把交叉轴坐标归零：ScrollView 的 `_moveContent` 只按方向裁增量，不清旧坐标，否则从竖屏滑到一半转横屏，整行会横向错位。

## 怎么验的

- 类型检查通过：用 Creator 自带的 tsc 跑 `--noEmit -p tsconfig.json`（`C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js`，读 `temp/tsconfig.cocos.json` 与 `temp/declarations`），**0 error**。顺带修掉一处 `Node.getComponentInParent` 在 3.8 类型里不存在的问题（改成 `sv.node.parent.getComponent(PiecePool)`）。
- `grep` 确认 `"batchSize"` 全工程只剩 `assets/scene.scene:4204` 一处且值为 3；`assets/scene.scene` 仍是合法 JSON。
- ⚠️ **没跑场景校验、也没跑预览**：`npm run check` 走 `tools/exec.mjs` → MCP（端口 27502 无监听）直接报 `Cannot read properties of null (reading 'getComponent')`，等于没验；本机无 `node_modules`。运行时手感需在编辑器**刷资源库 + 重开预览**后自测。

## 影响什么 / 还没验的部分

- `BATCH` 路径语义未变；`SCROLL` 是新路径，**尚未在真机/预览里跑过**，重点看：拖动碎片与滑池子的方向判定手感、横竖屏切换后是否回正、消耗到少于半屏时是否左贴边（ScrollView 的 list 行为，不是居中）。
- `SCROLL` 下 `AutoPlayer` 的「补下一屏」失效（池里从头就是全部），已改成按 `batches × batchSize` 截取，但后续几批的碎片会从裁剪窗外飞进来（和 `BATCH` 多摆一屏时同样的现象）。
- 场景里还没写 `poolMode` 字段，默认走 `BATCH`；要试 `SCROLL` 得在 `PiecePoolLayer` 的 `PiecePool` 上手动切下拉（切完记得存场景）。
