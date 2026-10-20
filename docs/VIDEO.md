# 结尾视频（§18 全文）

> 从 `AGENTS.md` 拆出来。**动结尾视频 / 换片源 / 改播放区域** 之前读这一份。
>
> ⚠️ **当前已关**：`CtaController.endVideo` 留空，`END_SHOW` 一到直接亮结束界面；下面这些接线与参数都还在，重新挂上 `endVideo` 即可恢复。


**是什么**：完成图亮出来（`END_SHOW`）之后，先在**拼图区**（`Scene_BG` 那个框）铺满播一段视频，
播完（或玩家点一下跳过）才让 `CtaController` 亮结束界面。只走 `winCount = 0` 那条主路径 ——
`winCount > 0` 时是当场跳商店、根本不弹结束界面，也就不演视频。

| 位置 | 是什么 |
|---|---|
| `Canvas/GameLayer/Scene_BG/结尾视频` | 节点：`cc.UITransform`（720×1280 占位，**故意不给 Widget**）+ `cc.VideoPlayer` + `EndVideo`；平时 `active = false` 睡着 |
| `cc.VideoPlayer` | `clip` = 片源（**换片只动这一处**）；`mute = false`、`playOnAwake = false`、`keepAspectRatio = true`、`stayOnBottom = false` —— 后三项别改 |
| `EndVideo` | `player` / `region`（**播放区域** = `Scene_BG`，现在两块同尺寸 582.39×840）/ `fallbackTime`（兜底秒数，见 [docs/TUNING.md](TUNING.md)） |
| `CtaController.endVideo` | **现在是空**（= 不演视频，`END_SHOW` 一到就亮结束界面）。要恢复就在 `CtaLayer` 的 `CtaController` 上把「结尾视频」拖回 `Scene_BG/结尾视频` —— 这个口别删 |

接线脚本 `tools/js/mount-end-video.js`（幂等）：

```
node tools/exec.mjs scene tools/js/mount-end-video.js "{\"clip\":\"<片源 uuid>\"}"
```

uuid 读 `assets/recourses/*.mp4.meta`。⚠️ 重跑会把 `region` / `fallbackTime` 复位成脚本里的值。

**片源与裁切**（2026-10-15 定的）：现在用 `结尾视频3：4.mp4`（480×640，比例 **0.750**，3.88s，0.84MB）。
播放区域比例 = `582.39 ÷ 840` = **0.6933**，铺满是「盖住再裁」⇒ 这片源偏胖 ⇒ **左右各裁 3.8%**。
另一个候选 `结尾视频9：16.mp4`（720×1280，0.5625）要**上下各裁 9.4%**，内容损失更大，所以没用它 ——
**视频元素是按 CSS 像素铺的**（拼图区在手机上约 318 CSS px 宽），480 宽的片源实际是缩小显示、不会发虚，
高分辨率的优势用不上。想一点都不裁就让美术按 **0.6933**（≈ 582:840）出。

**四条约束**（原因都在引擎里，不是我们的选择；细节见 [EndVideo.ts](../assets/scripts/platform/EndVideo.ts) 的注释）：

1. 它是**盖在画布之上的 DOM `<video>`**（引擎把元素 append 到 `game.container`），跟场景层级无关 ——
   演的时候**那块地方的触摸到不了画布**，所以「点一下跳过」只能听 `VideoPlayer.EventType.CLICKED`，
   借不了全局 `input` / `Button`；
2. 「不演」必须是**节点睡着**，光 `stop()` 藏不住（引擎只在 `onDisable` 里切元素 `visibility`）；
3. 铺满靠**等比放大节点 + 自己写 `clip-path`** —— `GameLayer` 的 RECT `Mask` 裁不到 DOM 元素。
   ⚠️ 倍率与窗口要按 `player.nativeVideo.videoWidth/Height` 算，**不能读节点的 `contentSize`**
   （引擎改节点尺寸那一句排在 `META_LOADED` 之后）；
4. **别给这个节点加 Widget**、别动 `keepAspectRatio`、别用 `stayOnBottom`。

**声音**：视频有自己的音轨，它**不走 `AudioManager`**；`END_SHOW` 本来就会让 `AudioManager` 停掉全部音，
所以视频起播那一刻游戏那盘音（bgm + 魔法光粒）已经让位了。起播**先试带声音**（结尾路前面必然有过触摸，
页面有用户激活），被浏览器拦就**自动退成静音**再放一次 —— 画面照演，只是没声。

**打包**：mp4 走 `tools/runtime/playable-runtime.js` 的**拦截 2**（元素 `src` → blob）。这一支第一次被真正
用起来时补了两处：① 拦 `HTMLSourceElement`（引擎给 `<video>` 建的是**子节点 `<source>`**，只拦
`HTMLMediaElement` 等于没拦）；② 按扩展名给 blob 补 `video/mp4`（Safari 对无 type 的 blob 视频直接
`MEDIA_ERR_SRC_NOT_SUPPORTED`，**Chrome 能嗅探所以本地测不出来**）。⚠️ 这两条只在**单文件产物**里才跑到，
编辑器 / Game View 走本地文件路径 —— **别在编辑器里验过了就当过了**。

**体积**：mp4 已经压过、gzip 收不动，但 base85 会撑 **1.25 倍** —— 0.84MB 的片源 ≈ **+1.06MB HTML**。
当前载荷 1.92MB ⇒ 加完约 **3.0MB**（红线 5MB）。**换片先按「片源大小 × 1.25 + 现载荷 < 5MB」估一遍。**

**⚠️ 还没验的**：① 有声自动播放到底放不放行（真机 / 真容器才验得到）；② `CLICKED` 跳过在容器里灵不灵；
③ Safari 的 blob MIME 与 `HTMLSourceElement` 那两条修复（得在单文件产物里验）；
④ `video` 模块重开之后**引擎得重编**（去「设置 → 功能裁剪」保存一次逼它重编，光改 JSON 不够，§9）。

---

## 开头视频（选关之后）

**是什么**：玩家点完关卡，`Canvas/IntroLayer` 的两块挡板**当场**向两侧滑开，**同一刻**起播
`assets/recourses/开头视频.mp4`（989KB，uuid 见其 `.mp4.meta`）。视频**铺满整屏**（不是拼图区），
播完（或点一下跳过、或 `fallbackTime = 12s` 兜底）才算开场结束。

| 位置 | 是什么 |
|---|---|
| `Canvas/IntroLayer/开头视频` | 节点：`cc.UITransform`（720×1280 占位，**不给 Widget**）+ `cc.VideoPlayer` + `EndVideo`；平时 `active = false` |
| `EndVideo.region` | 指 **`Canvas`**（整屏铺满、溢出裁掉）。和结尾视频复用同一个组件，只是区域不同 |
| `GameIntro.video` | 指上面那个 `EndVideo`。`GameIntro` 只管挡板 tween，**视频播完由它回调 `finish()`** |
| `GameIntro.slideTime / sweep` | 挡板滑出时长 / 距离。滑出与视频起播是同一帧，**不再有停留与标题** |
| `EndVideo.fadeOut` | 开头这个是 **0.5 秒**（结尾视频留 0 = 不淡）。播到「片长 − 0.5s」把 DOM 元素的 `opacity` 淡到 0 —— `ended` 那一两帧浏览器会闪回第一帧，淡到透明就看不见 |

**结尾不能硬切**：`<video>` 播完会回到首帧再被 `visibility: hidden` 藏掉，中间那一下会闪一下首帧。
`EndVideo.fadeOut = 0.5` 在片尾前 0.5 秒起一段 CSS `opacity` 过渡，收摊时画面已经是透明的。
（`UIOpacity` 管不到画布之上的 DOM 视频，只能写元素自己的样式；`done()` 里先置 `active = false` 再回调，`onDisable` 的 `visibility: hidden` 兜底。）

**这条流程里没有「点击屏幕开始」**：`GameIntro.finish()` 直接把 `IntroLayer` 收起来，抛
`GUIDE_RESUME`（空闲引导解冻）与 **`GAME_START`**（音频那盘的起跑线）。

**声音（2026-10-20 定的）**：
- 玩家**点关卡那一刻**就算用户激活 —— `AudioManager` 听 `LEVEL_SELECTED` 解锁，**一次性音效**此后立刻能响；
- **BGM 与常驻音（激活事件 = NONE 的两条）等 `GAME_START` 才起**，不与开头视频的音轨抢；
- 视频起播照旧**先试带声音**，被拦自动静音重放（同结尾视频，走 `EndVideo.begin()`）。

接线脚本 `tools/js/mount-intro-video.js`（幂等）：

```
node tools/exec.mjs scene tools/js/mount-intro-video.js "{\"clip\":\"<片源 uuid>\"}"
```

**体积**：989KB × 1.25 ≈ **+1.24MB HTML**。加上结尾视频那份，两片合计约 +2.3MB，**交审前核一遍 < 5MB**。

**⚠️ 还没验的**：① 视频 12 秒兜底是拍出来的，片长若更长要往上调；② 整屏 cover 裁切后构图；
③ 视频那一下的触摸全被 DOM 元素吃掉（跳过只能听 `CLICKED`），演完节点睡回去触摸才穿得过。
