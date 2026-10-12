/**
 * 商店跳转（游戏侧）。放进你的项目，在 CTA 按钮的点击回调里调 `openStore(安卓链接, iOS链接)`。
 *
 * 调哪个平台的 API 由打包时注入的 `window.__ccCta` 决定，游戏代码不用分平台：
 *   AppLovin → mraid.open(url)
 *   Moloco   → FbPlayableAd.onCTAClick()   无参，跳哪个商店由平台按设备定
 *   Google   → ExitApi.exit()              同上
 * 没有注入时（编辑器预览、直接拿浏览器打开构建产物）退回 mraid，仍会打日志说明。
 *
 * 本文件不 import 任何东西，整个丢进你的项目即可。
 */
declare const mraid: any;

/** 平台判定：优先问 mraid，问不到退回 UA */
export function isAndroid(): boolean {
    const m = api();
    // 容器注入的 mraid 可能没有 getDeviceInfo（实测有这种半成品），
    // 裸调用会在点击回调里抛 TypeError，那一跳连 mraid.open 都走不到
    const info = m && typeof m.getDeviceInfo === 'function' ? m.getDeviceInfo() : null;
    if (info && info.os) return String(info.os).toLowerCase() === 'android';
    return /android/i.test(navigator.userAgent);
}

/**
 * CTA 入口。`url` 只在 AppLovin 那条路上有用 —— 另两家要求无参调用，
 * 跳哪个商店由平台按设备决定（所以传进去会被忽略，不是 bug）。
 */
export function openStore(androidUrl: string, iosUrl: string): void {
    const url = isAndroid() ? androidUrl : iosUrl;
    const cta = (window as any).__ccCta;
    if (typeof cta === 'function' && cta(url)) {
        console.log('[StoreCta] ' + ((window as any).__CC_CHANNEL || 'adapter') + ' CTA → ' + url);
        return;
    }
    open(url);
}

function open(url: string): void {
    const m = api();
    if (!m || typeof m.open !== 'function') {
        console.log('[StoreCta] 环境里没有可用的 mraid.open，不跳转：' + url);
        return;
    }
    console.log('[StoreCta] mraid.open(' + url + ')');
    m.open(url);
}

function api(): any {
    return typeof mraid !== 'undefined' ? mraid : null;
}
