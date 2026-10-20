# 飘雪改成「风线」（2026-10-19）

- 日期：2026-10-19
- 提交：<待提交>
- 关联：AGENTS.md §15 / docs/TUNING.md §16

## 改了什么

- 新增 `assets/recourses/particles/wind-line.png`（256×16，两端收尖、上下柔边的白色长条），作为风线贴图。
- `effects/Particle2D.ts` 新增四个 Inspector 字段：
  - `lengthRatio`：粒子沿本地 X 的拉长倍率，1 = 原方形；
  - `alignToVelocity`：勾上后每帧把粒子角度设成速度方向，长条顺着飞行方向；
  - `curveDistance`：起飞后先保持直线飞够这段距离（px），之后才转向；
  - `curveAccel`：转向的上下加速度（px/s²），出生在发射点上方向上加、下方向下加。
  尺寸更新改为 `(size * lengthRatio, size)`，粒子池初始化同步；每个粒子记录已飞距离与出生侧符号。
- `Canvas/FxLayer/FxSnow` 改为风线：贴图 `wind-line`、`lengthRatio = 32`、`alignToVelocity = true`；节点世界坐标对齐 `Slot_03/Broken`（那扇窗），数量 50、发射 30/s、寿命 0.53s、角度 180°±5°（横着往屋里）、速度 500±80、粗细 3.2→1.4、`posVar = (4, 62)`。**单条总行程约 265px（原 800px 的三分之一）**；先直飞 40px，然后上半向上弯、下半向下弯（`curveDistance = 40`、`curveAccel = 570`；切向/径向/重力都归零，免得还没直飞就偏）。**槽位 3 修好当刻停**（`stopEvents = [PIECE_REPAIRED]`、`slotIndex = 2`），音频 `刮风` 的 `stopSlot` 同步改成 2。
- `tools/js/tune-wind.js`：幂等写回上述参数，**同时按 `Slot_03/Broken` 现算并写入节点世界坐标**；`tools/js/apply-copy-particles.js` 的 FxSnow 段同步成同一组值与起停槽位，重跑不会退回圆点雪。

## 为什么这么改

- 需求是「不再是一颗颗粒子，而是一条条被风刮进来的线」。用**长条贴图 + 沿速度旋转**即可，不必改渲染管线或换粒子系统：粒子的飞行、寿命、加色、事件起停全部复用现有 `Particle2D`。
- 速度从 1100 降到 500 后，其余数据跟着速度重配：寿命 0.9 → 1.6（总行程仍约 800px）、发射 55 → 30/s（池里稳态约 48 条，不会先空再猛喷）、`lengthRatio` 70 → 32（线长仍约 100px）、`curveAccel` 900 → 190（按速度平方缩放，扇形张角不变），`speedVar` 160 → 80。此后又按要求把**总行程缩到三分之一**：速度、发射率、槽位起停不动，寿命 1.6 → 0.53s，`lifeVar` 0.2 → 0.07、`curveDistance` 120 → 40、`curveAccel` 190 → 570；线长（`lengthRatio`）不动，池里稳态从约 48 条降到约 16 条，但沿线间距不变。
- 收紧 `angleVar` / `speedVar`、把切向/径向/重力归零：原来的雪靠大抖动散开，看起来是飘雪；风要方向一致，线条才像被风卷着走。**直线段与转弯分开**：前 40px 速度里没有纵向分量，所以线是直的；过了这段才按出生位置的上下侧施加纵向加速度，上边的往上、下边的往下，形成向外张开的扇形。
- 否掉的方案：① 用 `Graphics` 每帧画线段 —— 要自己管池、寿命和加色，且拿不到现有 Inspector 调参；② 把 `snow.png` 直接横向拉伸 —— 圆点拉长后两端还是圆的，像米粒不像风线。

## 怎么验的

- `npx tsc --noEmit` 通过。
- 场景探针确认 `FxSnow`：`spriteFrame = wind-line`、`lengthRatio = 32`、`alignToVelocity = true`、`totalParticles = 50`、`emissionRate = 30`、`life = 0.53`、`lifeVar = 0.07`、`angle = 180`、`speed = 500`、`speedVar = 80`、`curveDistance = 40`、`curveAccel = 570`、`tangentialAccel = 0`、`gravity = (0,0)`、世界坐标 = `Slot_03/Broken` 世界坐标（594.249673, 884.736935）、`stopEvents = [PIECE_REPAIRED]`、`slotIndex = 2`。
- 音频探针确认 `刮风` 条目：`stopEvent = PIECE_REPAIRED`、`stopSlot = 2`。
- 资源库已导入新 PNG，生成 `wind-line.png.meta`（SpriteFrame 子资源 `@f9941`）。

## 影响什么 / 还没验的部分

- `Particle2D` 的 `lengthRatio` 默认 1、`curveDistance` / `curveAccel` 默认 0，烟 / 火 / 光等其他粒子行为不变。
- **视觉未实测**：没有跑预览/截图，50 条、长度倍率 32、单条约 265px 行程、180° 横向「从窗户往里」的实际观感需要肉眼确认；可只改 `FxSnow` 的 Inspector 参数，不用改代码。
- 打包体积增加一张 256×16 PNG（很小，base64 后仍可忽略）。
