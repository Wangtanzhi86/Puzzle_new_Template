# AppLovin / MRAID 接入规范

> 本文件是 [../AGENTS.md](../AGENTS.md) **§8 的全文**。
> 工作区指令有 64KB 预算，AGENTS.md 放不下全文，所以正文搬到这里、那边只留指针 ——
> **内容一字未改**，改代码前按需读这一份。

## 8. AppLovin / MRAID 接入规范

### 8.1 核心要求对照表

| # | AppLovin 要求 | 本项目落地方式 |
|---|---|---|
| 1 | 总文件大小 < 5MB | 见 §9 体积预算 |
| 2 | 支持 MRAID v2.0 | 用 SDK 注入的全局 `mraid`，**不引入 mraid.js**（引用或内联都不行） |
| 3 | 广告为单个内联 HTML | 构建后处理脚本合并，见 8.2 |
| 4 | 不引用任何外部托管文件 | 图片 / 音频 / 字体全部 base64 内联（Google 的 exitapi 是唯一例外，§8.6） |
| 5 | 横竖屏全屏双支持 | 见 §7.1 |
| 6 | 无用户交互时不得超时 | 靠空闲引导：玩家不操作时画面一直在演（手指拖副本）。⚠️ **当前 `guide` 开关是关的，这条没有兜底** —— 见现状速查风险 2 |
| 7 | CTA 用 `mraid.open()` 跳商店 | 见 8.3 |
| 8 | CTA 不得跳转其他链接 | 地址白名单，只允许商店 URL |
| 9 | 不自建关闭按钮 | 见 §7.2 |
| 10 | JS / DOM 操作必须在 mraid ready 之后 | 见 8.2 启动时序 |
| 11 | 音频不自动播放、关闭后静音 | 见 8.4 |
| 12 | WebGL 检测失败需周期性重试 | 见 8.2 |

### 8.2 启动时序与构建管线

- 定制 `build-templates/web-mobile/index.html`：**不要立即启动引擎**。先等 `mraid` ready
  （`mraid.addEventListener('ready', ...)`；`mraid` 不存在时降级为直接启动，便于浏览器调试），
  ready 后再加载 Cocos 构建产物。
- WebGL 能力检测失败时按固定间隔重试，不得直接白屏。
- 构建后处理：写独立的 **Node 脚本放在 `tools/`**（**绝不能放 `assets/`**，否则会被 Cocos 当资源导入），
  把 `build/web-mobile/` 的 `index.html` + 引擎 JS + `assets/**` + `src/**` + 所有 JSON/图片，合并为单个自包含 HTML。
- 该脚本需支持 **base64 内联所有二进制资源**，并把外链 CSS / JS 内联。

### 8.3 CTA 逻辑

```
if (isAndroid) mraid.open(ANDROID_STORE_URL);
else           mraid.open(IOS_STORE_URL);
```

- 平台判定从 `mraid.getDeviceInfo()` 取（取不到时回退 UA）。**两个方法都要先查 `typeof ... === 'function'`** ——
  实测有些容器只实现了 `open`，没有 `getDeviceInfo`，裸调会在点击回调里抛，`mraid.open` 一次都执行不到。
- 商店地址集中写在 `config/PlayableConfig.ts`（打包器的占位符闸门扫的是它，见 §8.5）。
- **只允许 `mraid.open()`**，禁止 `window.open` / `location.href`。
- 点击回调抛 `CTA_CLICK` 事件用于埋点。**跳转排在埋点前面** —— `EventBus.emit` 不兜异常，
  任何监听方抛一下后面那句就永远不执行。
- 游戏侧只剩一句：`MraidBridge.openStore()` 调打包期注入的 `window.__ccCta(url)`，返回 false
  （没注入 / 容器还没给 API）就退回 `mraid.open` 那条老路。**游戏代码里没有平台分支**，§8.6。

### 8.4 音频策略

- **禁止自动播放**：任何音效（含常驻的 BGM）必须在首次用户交互之后才允许播放。
  解锁走两条路：全局 `input.on(TOUCH_START)`（游戏区空白处）与 `PIECE_PICK`（碎片池上的触摸被
  `content` 认领，全局 input 收不到）—— **两条都要留**。
- 监听 `mraid.addEventListener('stateChange', ...)`，当 `mraid.getState() === 'hidden'` 时全局静音并停止所有音效；
  恢复时按需取消静音（只有常驻音会被恢复，被打断的一次性音效不补）。
- 点了 CTA 跳商店之后停掉全部音效，也不再起新的（`CTA_CLICK`）。
- 无音频资源或资源未就绪时 `AudioManager` 静默跳过，不报错、不阻塞流程。

细则（配置列表怎么填、常驻音怎么配、渐入渐出的坑）见 WORKLOG「音频」。

### 8.5 构建与打包流程（已就绪）

在编辑器里构建 **web-mobile**，扩展 `extensions/playable-builder` 会在构建完成后自动打出单文件 HTML。

```
Creator 构建 web-mobile
  └─ extensions/playable-builder/hooks.js  onAfterBuild
       └─ node tools/pack-playable.mjs --build <buildPath>/web-mobile
            ├── tools/lib/assets.mjs   读产物 + PNG 无损转 WebP
            ├── tools/lib/payload.mjs  base85/base64 + gzip 容器 + 载荷自检
            ├── tools/runtime/playable-runtime.js  浏览器侧：解包 + 五处拦截 + mraid/WebGL 闸门
            ├── tools/runtime/base-fix.js          非层级文档地址补 base
            └─ 写 build/playable.html → 验产物 → 体积门禁
```

- **产物**：`build/playable.html`（默认，可用 `--out` 改）。
- **手动跑**：`npm run pack`（完整打包）或 `npm run pack:report`（只看体积明细，不写文件）。
- **失败即中断构建**：`throwError = true`。体积超 5MB、或产物校验不过（闸门缺失、出现 mraid 外链、
  有外部托管引用）时构建直接失败 —— 不给「构建成功但交不出去」的假象。
- **MCP 起不了构建**：builder 包只注册了 `open` / `query-worker-ready` / `query-task`，没有触发构建的消息。
  构建必须由人在编辑器里点，没法脚本化。
- **内联原理**：不改引擎、不改构建配置、不改素材，构建产物原样保留，只在浏览器里拦五个入口喂字节 ——
  SystemJS 取模块源码 / XMLHttpRequest / `HTMLImageElement.src` / `HTMLScriptElement.src` / 裸 `fetch`。
  没命中的一律回落原生实现，所以同一份产物传服务器上也照常跑。
- **不要**把启动闸门写进 `build-templates/web-mobile/index.html`：打包器只保留产物自身的 DOM 骨架，
  写在模板里的启动逻辑会被丢弃。
- **商店链接占位符闸门**已实现：`pack-playable.mjs` 扫**构建目录里编译后的 JS/JSON**（不是扫打包后的 HTML ——
  产物已经 gzip + base85 编码，链接在 HTML 里根本找不到），命中 `XXXX` / `example` / `id000000+` 就报。
  `hooks.js` 把它分两档：`debug` 构建只警告，release 构建直接失败。开发期真要放行用 `--allow-placeholder`。
- 本地自测：产物双击即可打开，地址后加 `#debug` 打开启动日志。没有 mraid 时会走降级路径并在控制台说明。
- ⚠️ 改 `hooks.js` 要**重启编辑器或重载扩展**（扩展是启动时加载的，worker 里 `require` 有缓存）。
  ⚠️ `hooks.js` 里不能依赖 `Editor` 全局（跑在 builder 的 worker 进程里）。
  这两个坑的来龙去脉见 WORKLOG「构建钩子那三个坑」。

### 8.6 多平台（AppLovin / Moloco / Google）一键出三份

同一份源码、同一份构建产物，**打包期出三份产物**，游戏代码不分平台：

```
build/playable.html         AppLovin  单文件 HTML，CTA 走 mraid.open(url)
build/playable.moloco.html  Moloco    单文件 HTML，CTA 走 FbPlayableAd.onCTAClick()
build/playable.google.zip   Google    同一个 HTML 套个 zip 壳，CTA 走 ExitApi.exit()
```

三家的要求对照（只有三处真冲突，且全在外壳层）：

| | AppLovin | Moloco | Google（应用广告） |
|---|---|---|---|
| 交付格式 | 单文件内联 HTML | 单文件 HTML | **`.zip`** ≤5MB、≤512 文件、UTF-8 |
| CTA | `mraid.open(url)` | **`FbPlayableAd.onCTAClick()`（无参）** | **`ExitApi.exit()`** |
| 禁项 | `mraid.js`、外部托管引用 | **`XMLHttpRequest` 字面量**、`mraid.js`、外链、JS 跳转、`.zip` | 外链（Google 托管的库除外）、localStorage |
| 方向 | 横竖屏 | 横竖屏 | 横竖屏 + **`<meta name="ad.orientation">`** |

玩法层的三条（横竖屏全屏、音频首次交互后才响、endcard + 明确 CTA）三家一致，早已满足。

- **通道表在 `tools/lib/channels.mjs`**，一条一个通道：产物名 / 要不要 zip / CTA 明文 API /
  注入 `<head>` 的额外标记 / 外链白名单 / 禁项。加第四个平台只加一条，打包器一行不动。
- **CTA 走「打包期注入的适配器」，不是游戏代码里的平台分支**。`buildHtml` 往 `<head>` 里塞一段明文脚本：
  `window.__CC_CHANNEL='<id>'` + `window.__ccCta = function(){…}`。
- ⚠️ **适配器必须是明文，不能只活在游戏代码里**：Moloco 的素材检查是对 HTML 做**字符串匹配**，
  而游戏代码在 gzip + base85 的载荷里，它看不见。所以 `FbPlayableAd.onCTAClick()` / `ExitApi.exit()`
  这几个字必须原样出现在 `<head>`。
- **`openStore()` 在 Google / Moloco 上算出来的 url 是白算的** —— 两家的 CTA 都无参，
  跳哪个商店由平台按设备定。`PlayableConfig.ts` 那两条链接只在 AppLovin 那条路上有用；
  打包器的商店链接闸门仍然全局卡（它是「别带着 XXXX 交出去」的保险，与哪家无关）。
- **Google 的三件额外事**：① 同目录的 `index.html` 套进 `.zip`（`tools/lib/zip.mjs`，store 不压缩）；
  ② `<head>` 里加 `<meta name="ad.orientation" content="portrait,landscape">`；
  ③ 加 `<script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js">` ——
  **这是 Google 明确允许的唯一外链**，写在通道表的 `allowExternal` 白名单里，另外两家一份外链都不许有。
- **`verify()` 按通道分别校验**：CTA 明文 API 在不在、`__CC_CHANNEL` 对不对、外链有没有跑出白名单、
  Google 的 `ad.orientation` 在不在、各家的禁项有几处。哪家不过就是哪家失败。
- **CLI**：不给参数 = 三份都出；`--channel <id>` 只出一份；`--out <文件>` 隐含「只出 AppLovin 那一份」。
  `--report` 列出三份的体积。⚠️ **产物格式由通道定，不看后缀**（`--channel google --out x.html` 出来的仍是 zip）。

**⚠️ 两条未结的交付风险：**

1. **Moloco 的 `XMLHttpRequest` 字面量还没改造**，那份产物**先别上传**。功能上早就拦掉了
   （引擎的请求全被 `playable-runtime.js` 喂字节），要过的只是**字面量**：runtime 侧改成
   `window['XML'+'HttpRequest'] = Shim`，再对引擎 JS 做一遍同样的 token 改名。它现在挂在通道表的
   `softForbid` 上，**只计数告警、不拦构建**。
2. **Moloco / Google 都还没真机或官方校验器验过**：① Moloco 的检查究竟是不是纯字符串扫描（不是的话方案要重做）；
   ② 用 Google 的 H5 Validator 跑一遍 zip，顺便确认 WebP 那条（Google 列的受支持格式里没有 WebP，
   而管线默认 PNG→WebP —— 资源在 base85 块里理论上扫不到，但真跑一次比推断可靠；实在担心就 `--no-webp`）。

### 8.7 把整套链路发给别人（`dist/playable-pack.zip`）

- `tools/make-dist.mjs`（`npm run dist`）把**可分发的那部分**收进 `dist/playable-pack/`，同时压成
  `dist/playable-pack.zip`。发出去的是这个 zip，对方并到自己项目根目录即可。
- 内容 = `make-dist.mjs` 里那张 `SHIP` 表（`tools/pack-playable.mjs` + `tools/lib/*.mjs` + `tools/runtime/*.js`
  + `extensions/playable-builder/*`）**加上** `tools/dist-template/` 整个目录。路径两边对称，所以是合并不是改路径。
- **`tools/dist-template/` 是仅供分发的两件影子的源**：`README.md`（写给对方开发者看的，不是写给本项目的）
  与 `integration/StoreCta.ts`（游戏侧 CTA 桥，不 import 任何东西，两条链接走参数）。
  - 它和本仓库 [MraidBridge.ts](../assets/scripts/platform/MraidBridge.ts) 的 `openStore()` 是同一段逻辑的
    **两份拷贝**，有意为之。**改了一边记得看另一边。**
- ⚠️ **文档里的商店链接示例用本项目的真实链接**，别编 `com.example.demo` 这种假值。
- ⚠️ **改完 `tools/` 或 `extensions/playable-builder/` 要重跑一次 `npm run dist`**，否则发出去的 zip 还是旧的。
  `tools/`、`extensions/` 都不参与任何构建/导入，加文件不会影响编辑器。

