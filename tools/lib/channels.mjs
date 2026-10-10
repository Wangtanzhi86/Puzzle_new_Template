// 投放通道表。三家用的是同一份构建产物、同一套玩法代码，差别全在外壳：
// 交付格式（单文件 HTML / ZIP）、CTA 调哪个 API、各自禁什么、允不允许外链。
// 打包期按这张表出三份产物，游戏代码一行都不用分平台。
//
// CTA 那一条是这套做法的关键：把「平台要调哪个 API」从游戏代码里挪到 <head> 里
// 注入的一段明文脚本，游戏侧只剩一句 `window.__ccCta(url)`。三家的调用都以明文
// 出现 —— Moloco 的素材检查是对 HTML 做字符串匹配，藏在 gzip 载荷里的调用它看不见。

export const CHANNELS = [
  {
    id: 'applovin',
    label: 'AppLovin',
    out: 'playable.html',
    zip: false,
    /** 产物里必须有这个明文串，缺了就是装错了适配器 —— 点了会静默不跳 */
    ctaApi: 'mraid.open(',
    adapter: `window.__ccCta = function (url) {
    if (window.mraid && typeof window.mraid.open === 'function') { window.mraid.open(url); return true; }
    return false;
};`,
    extraHead: '',
    allowExternal: [],
    forbid: [],
    softForbid: [],
  },
  {
    id: 'moloco',
    label: 'Moloco',
    out: 'playable.moloco.html',
    zip: false,
    /** Moloco 要求无参调用，跳哪个商店由平台按设备决定 —— 传进去的 url 用不上 */
    ctaApi: 'FbPlayableAd.onCTAClick()',
    adapter: `window.__ccCta = function () {
    if (window.FbPlayableAd && typeof window.FbPlayableAd.onCTAClick === 'function') { window.FbPlayableAd.onCTAClick(); return true; }
    return false;
};`,
    extraHead: '',
    allowExternal: [],
    forbid: [],
    // Moloco 禁的是「HTML 里出现 XMLHttpRequest 这个字面量」。功能上早就拦掉了
    // （引擎的请求全被运行时喂字节），要做的只是把字面量换掉，那一步单独做。
    softForbid: [{ text: 'XMLHttpRequest', why: '字面量中和还没做（计划中的单独一步）—— 先别传 Moloco' }],
  },
  {
    id: 'google',
    label: 'Google',
    out: 'playable.google.zip',
    zip: true,
    ctaApi: 'ExitApi.exit()',
    adapter: `window.__ccCta = function () {
    if (window.ExitApi && typeof window.ExitApi.exit === 'function') { window.ExitApi.exit(); return true; }
    return false;
};`,
    // exitapi.js 是 Google 托管、Google 明确允许的唯一外链，另外两家都不许有外链，
    // 所以它只出现在这一份产物里。外链是同步加载，我们那句适配器只定义函数、
    // 调的时候才探测 ExitApi，先后顺序不影响。
    extraHead: '<meta name="ad.orientation" content="portrait,landscape">\n' +
      '<script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>',
    allowExternal: [/^https:\/\/tpc\.googlesyndication\.com\//],
    forbid: [],
    softForbid: [],
    requireOrientation: true,
  },
];

/** 注入 <head> 的那段：先挂通道名（真机调试时一眼看出手上是哪份产物），再挂适配器 */
export function ctaHeadScript(channel) {
  return `<script>window.__CC_CHANNEL=${JSON.stringify(channel.id)};\n${channel.adapter}</script>`;
}
