# 开场改成「卡片静图放大铺满 → 无缝换视频」（2026-10-20）

## 改了什么

- [GameIntro.ts](assets/scripts/ui/GameIntro.ts) 重写：不再滑挡板。点关（`LEVEL_SELECTED`）时取点中卡片的 `Window/Fill`
  （720×1280 原图），按世界变换挂到运行时全屏层 `Canvas/IntroZoom/Pick`（`RoundedClip` 裁圆角），
  先 `flyTime 0.34` 飞到屏幕中心（等比取小 = 整图可见），再 `zoomTime 0.5` 放大到**和视频同一个取景**（等比取大 cover）。
  圆角在头 `cornerFade 0.22s` 里从 `cornerRadius 26` 抹到 0。
- [EndVideo.ts](assets/scripts/platform/EndVideo.ts) 新增 `playCovered(onDone, onReady)` / `reveal()`：
  起播时把 `<video>` 元素 `opacity` 设 0 照常解码，`META_LOADED` 后再等 0.05s 回调 `onReady`；
  `reveal()` 一帧内把透明度放回来并补排结尾渐隐。`_covered` 期间不排渐隐，免得提前淡掉。
- 交接判定：放大到位 **且** 视频首帧就绪，同一帧里「静图层 `active = false` + 视频揭示」；
  视频迟迟不就绪则等 `readyTimeout 1.2s` 后照样揭示；播放器放不出来（`playCovered` 返回 false）就铺满后直接收场。
- [LevelSelect.ts](assets/scripts/ui/LevelSelect.ts)：`pick()` 改为**先抛事件再收起自己** —— 开场要在这一拍把 `Fill` 接走。
- 旧的左 / 右挡板在场景里 `active = false`（留着对照），接线脚本 [mount-intro-zoom.js](tools/js/mount-intro-zoom.js) 幂等可重跑。

## 为什么这么改

用户指出「第一张卡的图和视频首帧是同一张画」。既然如此，「淡入淡出」是多余的：
把静图放大到**视频首帧在全屏上的精确取景**，两边像素级重合，切换就是隐形的，观众只看到画面开始动。

关键在取景必须和 [EndVideo.fit()](assets/scripts/platform/EndVideo.ts#L147) 同一套公式：`k = max(屏宽/图宽, 屏高/图高)` + 居中。

否掉的方案：
- **交叉淡入（图铺满，视频 0.25s 淡入）**：能遮住不连续，但观众看得出「闪一下」，且淡入期间两层都在画。
- **飞整张卡片**：白框和丝带一起放大，铺满后一圈白边。
- **保留挡板**：挡板的作用是盖住「视频还没起播」的空档，现在这个空档由静图填上了，挡板反而打断连贯。

## 怎么验的

- `node tools/mcp.mjs run_script_diagnostics '{}'`：`no errors`。
- `npm run check`：`ok: true`。
- 场景核对：`IntroLayer/GameIntro` 的 `select` 指 `Canvas/Change`、`video` 指 `IntroLayer/开头视频`、`region` = `Canvas`；
  `Left`/`Right` 已 `active = false`；视频 `region = Canvas`、`fallbackTime 12`、`fadeOut 0.5`。
- 按约定**没有**跑预览看实际效果。

## 影响什么 + 还没验的部分

- **影响**：开场总时长 = `flyTime + zoomTime + 等视频首帧`，之后由视频自己的时长决定（`fallbackTime 12` 兜底）。
  `GAME_START` / `GUIDE_RESUME` 仍由 `GameIntro.finish()` 抛，BGM 的起点没变。
- **没验**：① 放大终点和视频首帧对得准不准（差一点就会在交接时跳一下，可微调 `zoomTime` 或改用视频实际 `videoWidth/videoHeight`）；
  ② 圆角抹平够不够顺；③ 视频元素在部分浏览器首帧是黑的（就绪信号只到 `META_LOADED`），真机上可能要加长 `readyTimeout` 之前的判定；
  ④ 横屏下 cover 会裁掉上下，静图与视频同步裁，理论上仍然一致。