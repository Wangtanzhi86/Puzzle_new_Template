# 选关卡片：内框改成圆角遮罩，锁层跟着同一个遮罩走（2026-10-20）

## 改了什么

- 每张 `Level_XX` 的 `Window`：去掉原来的 `cc.Mask`（`type = RECT`，只能方角裁），挂上 `RoundedClip`
  （`GRAPHICS_STENCIL` + 运行时画圆角矩形），`radius 20`、`inset 0`。
- 每张卡的 `Lock`（黑色半透明 `rgba(0,0,0,140)` 的纯白 Sprite）从卡片的直接子节点**挪进 `Window`**，
  尺寸改成内框尺寸、锚点 (0.5,0.5)，排在 `Fill` 之后 —— 于是它和集图被**同一个圆角遮罩**裁，
  而且只盖住内框那一块，不再把白框和丝带一起压暗。
- 接线脚本 [mount-card-clip.js](tools/js/mount-card-clip.js)（`radius` 可传参，幂等）。

## 为什么这么改

用户观察：未解锁关卡的黑色遮罩和集图都是「规则的正方形」，应该都用框的内框做遮罩。
根因是两处都跟内框形状无关：`Window` 上的 `cc.Mask` 类型是 RECT；`Lock` 干脆是 324×295 的一整块方图、
还挂在卡片上而不是 `Window` 里。

否掉的方案：
- **给 Lock 单独挂一个 RoundedClip**：能圆角，但半径是按 Lock 自己的 324×295 算的，跟内框的弧度对不上，
  而且还得自己算一次和 Window 对齐的位置 —— 不如直接塞进 Window 吃同一层遮罩。
- **保留 RECT 遮罩、改用圆角贴图做 alpha 裁剪**：等于给每张卡加一张运行时贴图，且 10 张卡各一份，不划算。

## 怎么验的

- `node tools/mcp.mjs run_script_diagnostics '{}'`：`no errors`。
- `npm run check`：`ok: true`。
- 场景侧核对：10 张卡的 `Window` 都是 `Mask.type = 2`（GRAPHICS_STENCIL）+ `RoundedClip.radius = 20`；
  `Level_02..10` 的 `Lock` 已挂进 `Window`，`Level_01` 本来就没有 Lock。
- 按约定**没有**跑预览看实际形状。

## 影响什么 + 还没验的部分

- **影响**：`Window` 的裁剪从「矩形」变成「圆角矩形」，集图和锁层一起生效；遮罩不再压到白框与丝带。
- **没验**：`radius 20` 和白框内沿的弧度是不是严丝合缝（差一点会露出白色内沿或吃掉一细条图）；
  偏了就单张卡调 Inspector 里 `Window/RoundedClip.radius`，或重跑脚本传 `{"radius":N}`。