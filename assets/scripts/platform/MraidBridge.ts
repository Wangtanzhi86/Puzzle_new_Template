import { _decorator, Component } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { ANDROID_STORE_URL, IOS_STORE_URL } from '../config/PlayableConfig';

declare const mraid: any;

const { ccclass } = _decorator;

/**
 * MRAID 生命周期。mraid 是投放容器注入的全局变量 —— 不许引 mraid.js，
 * 本地浏览器里没有它就降级：不报错、不跳转，只打日志。
 */
@ccclass('MraidBridge')
export class MraidBridge extends Component {
    private _ready = false;
    private _muted = false;

    private _onReady = (): void => {
        this._ready = true;
    };

    private _onStateChange = (): void => {
        const muted = this.api.getState() !== 'visible';
        if (muted === this._muted) return;
        this._muted = muted;
        EventBus.emit(GameEvent.AUDIO_MUTE, muted);
    };

    protected onLoad(): void {
        const m = this.api;
        if (!m) {
            console.log('[MraidBridge] 没有 mraid，走降级路径');
            return;
        }
        if (m.getState() === 'ready') this._ready = true;
        else m.addEventListener('ready', this._onReady);
        m.addEventListener('stateChange', this._onStateChange);
    }

    protected onDestroy(): void {
        const m = this.api;
        if (!m) return;
        m.removeEventListener('ready', this._onReady);
        m.removeEventListener('stateChange', this._onStateChange);
    }

    get ready(): boolean {
        return this._ready;
    }

    isAndroid(): boolean {
        const m = this.api;
        // 容器注入的 mraid 可能没有 getDeviceInfo（实测 AppLovin 预览页就有这种半成品），
        // 裸调用会在点击回调里抛 TypeError，那一跳连 mraid.open 都走不到
        const info = m && typeof m.getDeviceInfo === 'function' ? m.getDeviceInfo() : null;
        if (info && info.os) return String(info.os).toLowerCase() === 'android';
        return /android/i.test(navigator.userAgent);
    }

    open(url: string): void {
        const m = this.api;
        if (!m || typeof m.open !== 'function') {
            console.log('[MraidBridge] 环境里没有可用的 mraid.open，不跳转：' + url);
            return;
        }
        console.log('[MraidBridge] mraid.open(' + url + ')');
        m.open(url);
    }

    /** 按平台跳本平台商店 —— 游戏中那个常驻按钮和结束界面那个按钮都走这儿 */
    openStore(): void {
        this.open(this.isAndroid() ? ANDROID_STORE_URL : IOS_STORE_URL);
    }

    private get api(): any {
        return typeof mraid !== 'undefined' ? mraid : null;
    }
}
