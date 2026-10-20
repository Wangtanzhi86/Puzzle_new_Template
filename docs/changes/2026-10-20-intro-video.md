# 开场改版：去掉「第 N 关」与「点击屏幕开始」，改为开局全屏视频

- 日期：2026-10-20
- 提交：<待回填>
- 关联：上一版 docs/changes/2026-10-20-level-flow.md / docs/VIDEO.md

## 改了什么

- `assets/scripts/ui/GameIntro.ts`：删掉 `caption` / `holdTime` / `captionFade` 三个字段与「第 N 关」标题那套 tween；
  点关卡后两块挡板**当场**（无停留）向两侧滑开，同一帧调 `EndVideo.play()` 起播全屏开头视频；
  视频播完（或跳过、或兜底超时）才 `node.active = false` 并抛 `GUIDE_RESUME` + `GAME_START`；
  没配视频时按 `slideTime` 兜底收场。
- 删除 `assets/scripts/ui/StartGuide.ts`（含 `.ts.meta`）与场景里的 `Canvas/UILayer/StartGuide`：不再有「点击屏幕开始」。
- `assets/scripts/core/GameEvent.ts`：删掉只给 `StartGuide` 用的 `INTRO_DONE`。
- `assets/scripts/audio/AudioManager.ts`：新增 `_started` 门 ——
  `unlock()` 只开闸（听 `LEVEL_SELECTED`，点关卡即算用户激活），**不再**顺带放常驻音；
  常驻音（激活事件 = NONE，BGM 与常驻背景音）改由 `onGameStart()` → `startResidents()` 在 `GAME_START` 时起播。
  一次性音效仍按原逻辑，解锁后即可响。
- 场景 `assets/scene.scene`（脚本 `tools/js/mount-intro-video.js`，幂等）：
  - 删 `Canvas/IntroLayer/Caption`；
  - 新建 `Canvas/IntroLayer/开头视频`：`cc.UITransform` 720×1280（不给 Widget）+ `cc.VideoPlayer`（clip = 开头视频、
    `playOnAwake=false`、`mute=false`、`keepAspectRatio=true`、`stayOnBottom=false`）+ `EndVideo`（`region = Canvas`、`fallbackTime = 12`），
    节点默认 `active = false`；
  - `GameIntro.left / right / video / slideTime = 0.45 / sweep = 1700` 回填。
- `tools/js/mount-level-flow.js`：同步删掉 Caption 与 StartGuide 那两段（否则重跑会把旧流程又建回来），
  视频接线单独交给 `tools/js/mount-intro-video.js`。
- `docs/VIDEO.md` 新增「开头视频（选关之后）」一节。

### 补丁：片尾渐隐（同日，第二轮）

- `assets/scripts/platform/EndVideo.ts` 新增 `fadeOut`（秒，默认 0）与 `scheduleFade / fadeAway / clearFade / onMeta`：
  `play()` 与 `META_LOADED` 各排一次，按「`duration − fadeOut`」到点给 `<video>` 元素写
  `style.transition = 'opacity <fadeOut>s linear'` + `style.opacity = '0'`；`onDisable` 换挂 `onMeta`；
  每次 `play()` 先 `clearFade()` 复位样式（同一个元素会复用）。元数据没到时每 0.1s 重试，最多 60 次。
- 场景 `Canvas/IntroLayer/开头视频` 的 `EndVideo.fadeOut = 0.5`；结尾视频那份仍是 0（不淡）。
- `tools/js/mount-intro-video.js` 同步写 `fadeOut`（args 可覆盖，默认 0.5），重跑幂等。
- `docs/VIDEO.md` 补「结尾不能硬切」一段与表格行。

## 为什么这么改

- 老板要求开场就是视频，标题与「点击屏幕开始」都不要 —— 少两拍等待，玩家点完关卡直接进画面。
- 视频起播必须**叠在挡板开始滑动的同一刻**：`GameIntro` 里用同一个 `onLevelSelected` 先起 tween 再 `video.play()`，
  不靠事件转一道，避免差一帧或多一帧。
- 视频复用 `EndVideo` 而不是新写一个：铺满 / 裁切 / 兜底 / 跳过 / 静音兜底那套逻辑已经踩过坑，
  只要把 `region` 从拼图区换成 `Canvas` 就是整屏。
- 音频门拆成两道：`LEVEL_SELECTED` 解锁（合规上「首次用户交互」就是点关卡），`GAME_START` 才起常驻音 ——
  否则 BGM 会在视频还没播完时就压上来，和片源音轨打架。
- 否掉的方案：把视频当场景 UI 动画（sprite 序列 / 导出 webm）—— 体积和画质都不划算，且引擎本来就有 `video` 模块。
- 片尾闪首帧的原因是 `<video>` 一 `ended` 就回到首帧，而 `visibility: hidden` 要等 `done()` 里
  `active = false` 才生效，中间至少一两帧能看见。淡出而不是「播到 95% 就 `stop()`」：后者会把最后 5%
  的画面和声音硬切掉；淡出既盖住闪帧，又让片子自然落到透明，`fallbackTime` / 跳过路径也照样收得干净。
  淡出只能写元素自己的 `style` —— 节点的 `UIOpacity` 管不到画布之上的 DOM 视频。

## 怎么验的

- 按老板要求**没有**跑预览 / 重建 / 截图自证。
- 已做的静态核对：`node tools/exec.mjs scene tools/js/mount-intro-video.js` 跑通并存盘；
  解析 `assets/scene.scene` 确认 —— `IntroLayer` 子节点为 `Left / Right / 开头视频`，
  `VideoPlayer._clip` 的 uuid 是 `9238ec1d-6ddf-4682-840d-6181af6a4126`，
  `EndVideo` 的 `region` 指 Canvas、`fallbackTime = 12`，节点 `_active = false`，
  `GameIntro` 上 `video / left / right` 三个引用齐全；`UILayer` 下只剩 `GuideLayer / CtaLayer`。
- TypeScript 未做编译验证（未开预览即未走引擎编译）。

## 影响什么 / 还没验的部分

- **音效**：点关卡后一次性音效可响；BGM / 常驻音从 `GAME_START` 起。若哪天开场被跳过（`IntroLayer` 摘掉），
  `GAME_START` 就没人抛，BGM 会一直不出声 —— 这是**当前设计的已知耦合**，交审前若改流程要一起改。
- 视频整屏铺满（cover），构图会裁边；12 秒兜底是按「片长未知」拍的，片长更长需调 `EndVideo.fallbackTime`。
- 体积：开头视频 989KB × 1.25 ≈ +1.24MB HTML，和结尾视频合计需重新核 < 5MB。
- 视频是 DOM 元素，演的时候整屏触摸到不了画布 —— 跳过只能靠引擎的 `CLICKED`；演完节点睡回去才恢复操作。
- 渐隐的 0.5s 是拍出来的：片长越短、绝对 0.5s 占比越大（5 秒片就是最后 10%）。要按比例淡就得再加一个
  「淡出占片长百分比」字段，目前没做。`duration` 读不到（流式/元数据没来）时重试 6 秒后放弃，退成硬切。