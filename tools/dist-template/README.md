# 试玩一次构建出三份产物（AppLovin / Moloco / Google）

Cocos Creator 的 web-mobile 产物，在打包阶段按投放平台出三份投放文件。**玩法代码、场景、美术一份都不用分平台。**

| 产物 | 平台 | 交付格式 | CTA 调什么 |
|---|---|---|---|
| `playable.html` | AppLovin | 单文件内联 HTML | `mraid.open(url)` |
| `playable.moloco.html` | Moloco | 单文件内联 HTML | `FbPlayableAd.onCTAClick()`（无参） |
| `playable.google.zip` | Google 应用广告 | zip（内含 `index.html`） | `ExitApi.exit()`（无参） |

三家用的是**同一份构建产物**，差别全在外壳：交付格式、CTA 调哪个 API、各自禁什么、允不允许外链。

---

## 1. 它是怎么做到「一套代码三平台」的

Cocos 的 web-mobile 产物本身是极好的多平台底子 —— 引擎、脚本、图片全在本地，本来就没有任何外链。三家的冲突**只在外壳层**：

1. **交付格式**：AppLovin / Moloco 要单个 HTML，Google 要 zip。
2. **CTA API**：三家各调各的，而且后两家**要求无参调用**。
3. **禁用串**：Moloco 的素材检查会在 HTML 里扫 `XMLHttpRequest` 这个字面量。

第 2 条是唯一的硬骨头。做法是把「平台要调哪个 API」从游戏代码里挪出来，变成打包时注入到 `<head>` 的一段**明文**脚本：

```html
<script>window.__CC_CHANNEL="moloco";
window.__ccCta = function () {
    if (window.FbPlayableAd && typeof window.FbPlayableAd.onCTAClick === 'function') { window.FbPlayableAd.onCTAClick(); return true; }
    return false;
};</script>
```

游戏侧只剩一句 `window.__ccCta(url)`，不必知道自己在哪个平台。

**为什么不塞进载荷里藏起来**：Moloco 的检查是对 HTML 做字符串匹配 —— 藏进 gzip 里的调用它看不见，等于自欺欺人。明文放在 `<head>` 里反而正好过检。

**为什么不 polyfill 一个假 `mraid`**（那样游戏代码一行都不用改）：那样 Moloco 那份产物里会出现 `mraid` 字样，说不清是哪家的东西，而且 `FbPlayableAd.onCTAClick()` 无参、`mraid.open(url)` 有参，语义对不齐。显式一个 `__ccCta` 更干净。

---

## 2. 环境要求

- **Cocos Creator 3.8.x**（3.8.8 上验证过；3.x 的 web-mobile 产物结构一致，理论上都行）
- **Node.js 18+**（打包器用的是 `node:` 前缀的 ESM）
- 玩法代码里**没有**任何你想保留的外部资源请求（图片 / 音频 / 字体都要在包内）

可选（能显著压体积）：

```bash
npm i -D @jsquash/png @jsquash/webp    # PNG 无损转 WebP，实测省下近 1MB
```

没装也不会报错，打包器会跳过这一步并说明。

---

## 3. 安装

把包里的两个目录并进你的项目根目录（同名目录直接合并）：

```
你的项目/
├── tools/                          ← 并进去
│   ├── pack-playable.mjs
│   ├── lib/
│   │   ├── assets.mjs              找产物、PNG → WebP
│   │   ├── payload.mjs             base85/base64 + gzip 容器
│   │   ├── channels.mjs            ★ 通道表，要加平台就改这里
│   │   └── zip.mjs                 极简 ZIP 写入（Google 用）
│   └── runtime/
│       ├── playable-runtime.js     浏览器侧：解包 + 五处拦截 + 启动闸门
│       └── base-fix.js             非层级文档地址补 base
├── extensions/                     ← 并进去（可选，见 §6）
│   └── playable-builder/
└── integration/StoreCta.ts         ← 拖进你的 assets/scripts/ 里，见 §4
```

`tools/` 和 `extensions/` 都不会被 Cocos 当资源导入（只有 `assets/` 会），放哪儿都行。

---

## 4. 游戏侧要改的唯一一处：CTA

**这一步不做，Moloco / Google 两份产物点了不会有反应。**

把 `integration/StoreCta.ts` 拖进你的 `assets/scripts/`，把两条商店链接填成你自己的（下面是我这个项目在用的，照着换成你的）：

```ts
import { openStore } from './StoreCta';

const IOS_STORE_URL = 'https://apps.apple.com/us/app/art-story-jigsaw-puzzle-game/id6757786318';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.zyhw.art.puzzle';

button.node.on(Button.EventType.CLICK, () => {
    openStore(ANDROID_STORE_URL, IOS_STORE_URL);
});
```

`openStore(安卓链接, iOS链接)` 内部自己判平台、自己挑 SDK。两条链接只在 AppLovin 那份产物里真的用得上 —— 另两家无参调用，跳哪个商店由平台按设备决定。

**别自己写死 `mraid.open()`**，那样只有 AppLovin 那份能跳。

⚠️ **链接填错不会有任何报错**，只是点了跳 404 商店页。打包器扫得到这两条串（它读的是构建产物里编译后的 JS/JSON，不是源码），链接里还留着 `XXXX` 占位符时会拦住不让出产物 —— 开发期用 `--allow-placeholder` 放行。

---

## 5. 跑一次

```bash
# 1. 在 Creator 里构建 web-mobile（默认落到 build/web-mobile）
# 2. 打包
node tools/pack-playable.mjs
```

产物落在项目根的 `build/` 下：

```
build/playable.html
build/playable.moloco.html
build/playable.google.zip
```

只想出其中一份：

```bash
node tools/pack-playable.mjs --channel google
```

### 命令行参数

| 参数 | 说明 |
|---|---|
| `--build <dir>` / `--in <dir>` | 构建产物目录，默认 `build/web-mobile` |
| `--out <file>` | 指定输出路径（**只在 `--channel` 指定了单一平台时有效**，否则三份会互相覆盖） |
| `--channel <id>` | 只出这一个平台：`applovin` / `moloco` / `google` |
| `--no-webp` | 关掉 PNG → WebP 转换 |
| `--base64` | 用 base64 代替 base85（体积大 ~6%，兼容性略好） |
| `--report` | 只打印体积明细，不写文件 |
| `--allow-placeholder` | 商店链接还是占位符时放行（只该在 debug 构建里用） |

---

## 6. 构建完自动打包（可选）

把 `extensions/playable-builder/` 并进项目后重启 Creator，扩展会在**每次 web-mobile 构建完成后**自动跑一遍打包器。

- 它是挂在 `'*'` 上的，`hooks.js` 里自己判断平台，非 web-mobile 直接跳过。
- `throwError = true` —— 体积超 5MB 或产物校验不过会**直接中断构建**，不给「构建成功却交不出去」的假象。
- debug 构建自动带上 `--allow-placeholder`，release 构建不会 —— 堵的是「带着 `XXXX` 交出去」。

⚠️ **改完 `hooks.js` 必须重启 Creator**：扩展是启动时加载的，构建钩子跑在 builder 的 worker 里，`require` 有缓存。

---

## 7. 体积：这是最容易翻车的地方

AppLovin / Moloco 单文件上限 **5MB**，Google zip 也是 **5MB**。而且资源转 base64/base85 后还要**涨约 33%**。

实测参考（一个中等体量的拼图玩法）：6.12MB 的原始产物 → 单文件 **4.18MB**，其中 PNG → WebP 省了 0.89MB。**余量并不宽裕。**

控制手段，按收益排序：

1. **裁引擎模块**（收益最大）。编辑器 → 项目设置 → 功能裁剪。
   - 必关：`spine-3.8`、`spine-4.2`、`dragon-bones`、`tiled-map`、`video`、`webview`、`physics-2d`、`profiler`、`geometry-renderer`、`terrain`、`light-probe`、`xr`、`intersection-2d`
   - **必留 `mask` + `graphics`** —— 只要你用了 `Mask` 组件（RECT / ELLIPSE 内部会建 `cc.Graphics`），关掉就是运行期报错。这一条踩过：漏配时白带了 568KB 的 spine，占产物 13%。
   - ⚠️ `settings/v2/packages/engine.json` 里 `modules.configs.defaultConfig.cache.<模块>._value` 和同级的 `includeModules` 数组是**分开写的**，面板不保证帮你同步。改完 `grep includeModules` 对一遍。两处都对了产物里却还有，那是**引擎没重编**（用了 `temp/` 里的旧的）—— 回面板改一次并保存，逼它重编。
2. **`npm i -D @jsquash/webp`** 开 WebP。
3. **美术图降分辨率**。展示尺寸 480 的图没必要存 960。
4. **减帧**：序列帧是体积刺客，14 张 960×960 就是 1MB+。

---

## 8. 每个平台的坑（上线前必做）

### 通用

- **音频不许自动播放**。引擎的 web 播放器会拦，但你的音频闸门（首次用户交互后才放）要自己保证。用 `AudioManager` 那套的话，注意碎片池上的触摸会被 `ScrollView` 认领，全局 `input.on(TOUCH_START)` 收不到 —— 得再挂一条业务事件当解锁路径。
- **横竖屏都要支持，且中途转屏不能中断玩法**。别锁方向，别提示用户转屏。
- **不许自建关闭按钮**。AppLovin 自己在右上角画 X，自建一个会和它打架。右上角 ≥120×120 当安全区，别放可交互内容。
- **看不见的按钮必须点不到**。三家 QA 都专门查这个。推荐做法：整棵结束界面子树起播前 `active = false`。
- **`Button` 的 `zoomScale` 要缩子节点，不能缩按钮自己**。引擎的 `_handleTouchEnd` 拿**当前缩放后**的矩形做 hitTest，缩到 0.9 之后贴着边按下再松手会被判 `TOUCH_CANCEL`，`Button` 收不到 `TOUCH_END` 就不发 `CLICK` —— **CTA 点击会丢**。给按钮加个 Sprite 子节点，把缩放目标指过去。

### AppLovin

- `mraid.open(url)` 是唯一允许的跳转方式。`window.open` / `location.href` 一律禁止。
- **平台判定别裸调 `mraid.getDeviceInfo()`**。实测有容器没实现这个方法，裸调用会在点击回调里抛 `TypeError`，那一跳连 `mraid.open` 都走不到（真实踩过，线上只报这一条错）。`StoreCta.ts` 里已经用 `typeof === 'function'` 兜住了。
- 交付单个 HTML，**不引用任何外部托管文件**。

### Moloco ⚠️

- 调 `FbPlayableAd.onCTAClick()`，**无参**。
- **禁用 `XMLHttpRequest` 这个字面量**（它对 HTML 做字符串匹配）。引擎和运行时代码里都有，**这份产物在字面量中和完成之前先别上传**。打包器会打这个警告：

  ```
  ⚠️ Moloco 产物里有 4 处 XMLHttpRequest：字面量中和还没做 —— 先别传 Moloco
  ```

- 中和方案（还没做）：把 `tools/runtime/playable-runtime.js` 里的 `window.XMLHttpRequest = Shim` 改写成 `window['XML'+'HttpRequest'] = Shim`，引擎产物里的同名字面量一并换 —— 都是把字符串拼起来，功能不变。
- ⚠️ **Moloco 的检查到底是不是纯字符串扫描，需要在它后台真传一个最小产物验一次**。不是的话这套做法要返工。

### Google（应用广告）

- **交付 zip**，上限 5MB / ≤512 个文件 / UTF-8。
- CTA 调 `ExitApi.exit()`，**无参**。它来自外链脚本：

  ```html
  <script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>
  ```

  这是 Google 托管、Google 明确允许的唯一外链，**只出现在这一份产物里**（另两家都不许有外链，打包器按通道白名单管这件事）。
- 加方向标签：`<meta name="ad.orientation" content="portrait,landscape">`。不加的话 Google 会当成锁方向，转屏时广告可能被停。
- **上传前跑一次官方验证器**：https://h5validator.appspot.com/adwords/asset
- ⚠️ Google 的 zip **不接受 WebP**（只认 HTML/CSS/JS/GIF/PNG/JPEG/SVG）。打包器默认会把 PNG 转成 WebP —— 交 Google 前确认一下官方文档的当前状态，不接受就给它单独出 `--no-webp`。

---

## 9. 加一个新平台

改 `tools/lib/channels.mjs` 里那张表，加一条，其余全部自动跟上（出产物、校验、体积报告）。一条长这样：

```js
{
  id: 'unity',
  label: 'Unity Ads',
  out: 'playable.unity.html',
  zip: false,
  ctaApi: 'unityAdsCta(',          // 产物里必须有这个明文串，缺了就是装错了适配器
  adapter: `window.__ccCta = function (url) {
    if (window.unityAdsCta) { window.unityAdsCta(url); return true; }
    return false;
};`,
  extraHead: '',
  allowExternal: [],               // 允许出现的外链正则，空数组 = 一个都不许
  forbid: [],                      // 命中就构建失败
  softForbid: [],                  // 命中只警告（用于已知但还没修的问题）
}
```

字段意思：

| 字段 | 作用 |
|---|---|
| `out` / `zip` | 输出文件名与交付格式 |
| `adapter` | 注入到 `<head>` 的明文适配器，就是这段决定游戏点击跳哪儿 |
| `ctaApi` | 校验用：产物里必须能明文找到它，否则说明适配器没装上 |
| `extraHead` | 只往这一份产物里塞的 `<meta>` / `<script>` |
| `allowExternal` | 外链白名单（正则数组），不在白名单里的外部引用 = 构建失败 |
| `forbid` / `softForbid` | 硬失败 / 只警告的禁用串 |

---

## 10. 打包器校验了什么

每次打包都会逐份产物理一遍，**任何一条不过就构建失败**（`throwError = true`）：

- 启动闸门在不在（`__ccAdEnv`）—— 缺了说明运行时没装好；
- **没有任何 mraid 外链**（`src` / `href`）；
- 该通道的 CTA 明文调用在不在（`ctaApi`）；
- `__CC_CHANNEL` 与当前通道是否一致（装错适配器会立刻暴露）；
- 外链是否全在白名单里；
- 方向标签该有的有、不该有的没有（可能锁方向的产物会被拦）；
- `forbid` 里的禁用串一个都没出现；
- 载荷自检（base85 解码回来和 gzip 原字节一致）；
- 体积门禁（5MB）。

产物本身也做了自检：打包器把编好的 HTML 再解一次包，确认拿回来的字节和源产物逐字节相同。

---

## 11. 自测

- **产物双击就能开**，不需要服务器。地址后加 `#debug` 打开启动日志。
- 本机没有 mraid，会走降级路径并在控制台说明 —— 玩法应该完整跑得通，只有 CTA 不跳。
- 想验跳转：浏览器控制台里手动造一个假 `mraid`，或者直接看 `#debug` 日志里那句 `[StoreCta] <通道> CTA → <链接>`。
- **Google 那份**：解开 zip 双击 `index.html`，再跑一遍官方验证器。

---

## 12. 常见问题

**产物里找不到我的新代码？**
Creator 的预览 / 构建产物是增量编译的。改完 `.ts` 要在编辑器里刷新一次资源库，否则跑的还是旧包。产物落在 `temp/programming/packer-driver/targets/` 下，`grep` 里面的字符串就能确认新代码进没进包。

**构建一失败就只剩「退出码 1」，看不到原因？**
`hooks.js` 已经把子进程的 stdout / stderr 都 pipe 回来逐行转发了。如果你改过这里，**别用 `stdio: 'inherit'`** —— 那样打包器的输出写到编辑器自己的 stdout，`project.log` 里一个字都不留，根本没法诊断。另外别用 `console.error` 转发：Cocos 会给每一行附一段 Error 堆栈，多行消息被切碎。

**扩展好像没生效？**
改完 `hooks.js` 要重启 Creator 或重载扩展（判据：堆栈里的 `hooks.js:行号` 还是旧的行号）。另外扩展跑在 builder 的 worker 进程里，**不能依赖 `Editor` 全局**，项目根用 `path.resolve(__dirname, '..', '..')` 推。

**`project://build` 是什么？**
构建钩子拿到的 `options.buildPath` 是**编辑器内部 URL**，不是文件系统路径。直接 `path.join` 会拼出 `.\project:\build\web-mobile` 这种相对路径，打包器一看没这个目录就当场退出。`hooks.js` 里的 `resolveBuildPath()` 负责把 `project://` 前缀换成项目根，绝对路径原样透传。

**能不能把启动闸门写进 `build-templates/web-mobile/index.html`？**
不行。打包器只保留产物自身的 DOM 骨架，写在模板里的启动逻辑会被丢弃。闸门在 `tools/runtime/playable-runtime.js` 里。

**产物体积卡在 5MB 下不来？**
先看 `--report` 的体积明细，按 §7 的顺序压。资源那 33% 的膨胀跑不掉。

---

## 13. 这份包里的文件都是干什么的

| 文件 | 作用 |
|---|---|
| `tools/pack-playable.mjs` | 打包器主流程、命令行、按通道校验、体积门禁 |
| `tools/lib/assets.mjs` | 找构建产物、PNG → WebP |
| `tools/lib/branding.mjs` | **牌子**：产物页签上的游戏名 + 内联的 favicon（见下） |
| `tools/lib/payload.mjs` | 打包格式：容器 + gzip + base85/base64，含自检 |
| `tools/lib/channels.mjs` | **通道表**，要加平台就改这里 |
| `tools/lib/zip.mjs` | 极简 ZIP 写入（store 方式，因为内容是 base85 已不可压） |
| `tools/runtime/playable-runtime.js` | 浏览器侧运行时：解包 + 五处拦截 + mraid/WebGL 闸门 |
| `tools/runtime/base-fix.js` | 非层级文档地址补 `<base>` |
| `extensions/playable-builder/` | 构建后自动打包的 Creator 扩展（可选） |
| `integration/StoreCta.ts` | 游戏侧 CTA 桥，拖进 `assets/scripts/` 用 |

### 页签上的游戏名和图标

产物 HTML 的 `<title>` 和 `<link rel="icon">` 由 `tools/lib/branding.mjs` 出 ——
icon 是**内联的 data URI**，不能是外链（三家平台的校验都会拦下来）。

⚠️ 这份包里那份是**我们的**名字和 logo（`Art Story: Jigsaw Puzzle Game`），**直接拿去用就是给别人打广告**，
第一件事就是换掉它。另外浏览器上还有两处不归打包器管的副本，要一起换：

| 文件 | 管的是 |
|---|---|
| `tools/lib/branding.mjs` | 打包产物（**本包里的这份**） |
| `build-templates/web-mobile/index.html` | Creator 构建出来的 `build/web-mobile/index.html`（本项目自带一份，你的项目没有就新建这个路径） |
| `preview-template/index.ejs` | Creator 编辑器里点「预览」时那个 localhost 页面（编辑器自带的模板在 `资源管理器 → 项目 → 生成预览模板` 里能导出来一份改） |

前两个是构建/打包流程里的，第三个是编辑器自己的 —— 三份是同一段内容的**手抄副本**，import 不进来，改了一处记得看另外两处。
