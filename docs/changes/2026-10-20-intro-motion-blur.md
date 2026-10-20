# 开场放大动画加动态模糊（残影 + 缩放模糊材质）（2026-10-20）

## 改了什么

- 新增 [zoom-blur.effect](assets/ReusableDragFx/zoom-blur.effect)：标准 sprite 混合，片元里沿 `uv→uCenter` 方向 8 次采样
  取平均（`uStrength` 控制拉伸量，0 = 与普通贴图一致），uniform `uCenter` 固定 (0.5, 0.5)。
- 新增 [IntroMotionBlur.ts](assets/scripts/ui/IntroMotionBlur.ts)：挂在飞行的 `IntroZoom/Pick` 上。
  - 残影：克隆 `ghostCount` 个同 spriteFrame 的 Sprite 垫在底下，每个用指数平滑追前一个的世界变换
    （`1 - exp(-ghostLag·dt)`），透明度按序号递减；因为它们都是 `Pick` 的子节点，**跟着圆角遮罩一起裁**。
  - 模糊：把目标 Sprite 的 `customMaterial` 换成 zoom-blur，`setStrength()` 由 GameIntro 按速度每帧喂。
- [GameIntro.ts](assets/scripts/ui/GameIntro.ts)：新增 `blurEffect / ghostCount 4 / ghostOpacity 0.35 / ghostLag 16 / blurMax 0.12`；
  飞行段恒 `0.3×blurMax`，放大段先升到 `blurMax`（前 60%）再降回 0；`swap()` / `finish()` / `onDisable` 里 `dispose()`。
  圆角抹平结束顺手 `Mask.enabled = false` —— 全屏了看不到角，也免了自定义材质走模板测试。
- 接线脚本 [mount-intro-zoom.js](tools/js/mount-intro-zoom.js) 补上 `blurEffect` 与四项参数（只在字段为 undefined 时写，不覆盖手调值）。

## 为什么这么改

两段动画的成因不同：飞行是**平移**，用残影最像；放大是**缩放**，只有 zoom blur 能做出径向糊边。
选 A 是因为它全是 2D 侧的事 —— 不动渲染管线、不额外 RenderTexture，一个几 KB 的 effect + 纯节点残影，
对 `< 5MB` 的试玩广告没有负担。

否掉的方案：
- **后处理运动模糊（RenderTexture 帧混合 / 自建 pass）**：`custom-pipeline` 要改管线，显存与体积都不划算。
- **纯粒子速度线**：只能做「条状气流」，不是糊。
- **只做残影**：飞行段够用，但放大段没有径向糊边的感觉。

## 怎么验的

- `run_script_diagnostics`：TypeScript `exitCode 0`，无 error。
- `npm run check`：`ok: true`。
- 场景核对：`GameIntro.blurEffect` 指向 `zoom-blur.effect`（uuid `63c6f8bb-…`），`ghosts 4 / opacity 0.35 / lag 16 / max 0.12`。
- 按约定**没有**跑预览看实际效果。

## 影响什么 + 还没验的部分

- **影响**：飞行 / 放大期间多 4 个 Sprite（多 4 个 DrawCall 量级、共用一张贴图），并且主图换自定义材质；
  交接给视频前强度归 0、残影 `dispose()`，视频首帧仍然是清晰的那一帧。
- **没验**：① 残影的拖尾长度和「糊」的观感（调 `ghostLag` / `ghostOpacity` / `ghostCount`）；
  ② `blurMax 0.12` 是否过头（往 0.06~0.1 调）；③ 自定义材质的颜色是否与内置 sprite 完全一致（交接那一帧如果不齐，可把 `swap()` 提前 0.05s）；
  ④ 当前 `flyTime / zoomTime` 已被手调成 0.1 / 0.1，模糊上升沿很短，可能需要把曲线改成前 40% 到位。