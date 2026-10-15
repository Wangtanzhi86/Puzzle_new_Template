# 结尾视频（§18 全文）

> 从 `AGENTS.md` 拆出来。**动结尾视频 / 换片源 / 改播放区域** 之前读这一份。


**是什么**：完成图亮出来（`END_SHOW`）之后，先在**拼图区**（`Scene_BG` 那个框）铺满播一段视频，
播完（或玩家点一下跳过）才让 `CtaController` 亮结束界面。只走 `winCount = 0` 那条主路径 ——
`winCount > 0` 时是当场跳商店、根本不弹结束界面，也就不演视频。

| 位置 | 是什么 |
|---|---|
| `Canvas/GameLayer/Scene_BG/结尾视频` | 节点：`cc.UITransform`（720×1280 占位，**故意不给 Widget**）+ `cc.VideoPlayer` + `EndVideo`；平时 `active = false` 睡着 |
| `cc.VideoPlayer` | `clip` = 片源（**换片只动这一处**）；`mute = false`、`playOnAwake = false`、`keepAspectRatio = true`、`stayOnBottom = false` —— 后三项别改 |
| `EndVideo` | `player` / `region`（**播放区域** = `Scene_BG`，现在两块同尺寸 582.39×840）/ `fallbackTime`（兜底秒数，见 [docs/TUNING.md](TUNING.md)） |
| `CtaController.endVideo` | 指上面那个节点。**留空 = 不演视频**，`END_SHOW` 一到就亮结束界面 —— 这是退路，别删那个口 |

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
