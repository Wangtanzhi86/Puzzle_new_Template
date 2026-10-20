import { _decorator, Button, Component, Node, Tween, Vec3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { ANDROID_STORE_URL, IOS_STORE_URL } from '../config/PlayableConfig';
import { MraidBridge } from '../platform/MraidBridge';

const { ccclass, property } = _decorator;

/** 结束界面的 Google / App Store 徽标：点了直接跳对应商店（不按设备判断，跟徽标一致）。 */
@ccclass('StoreButton')
export class StoreButton extends Component {
    @property({ type: MraidBridge, displayName: 'MRAID 桥' }) bridge: MraidBridge = null;
    @property({ displayName: '跳 Android 商店', tooltip: '不勾就跳 App Store' }) android = false;
    @property({ displayName: '按下缩放到', tooltip: '1 = 不缩放' }) pressScale = 0.9;

    private _base = new Vec3(1, 1, 1);

    protected onEnable (): void {
        this._base = this.node.scale.clone();
        this.node.on(Button.EventType.CLICK, this.onClick, this);
        this.node.on(Node.EventType.TOUCH_START, this.onDown, this);
        this.node.on(Node.EventType.TOUCH_END, this.onUp, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onUp, this);
    }

    protected onDisable (): void {
        this.node.off(Button.EventType.CLICK, this.onClick, this);
        this.node.off(Node.EventType.TOUCH_START, this.onDown, this);
        this.node.off(Node.EventType.TOUCH_END, this.onUp, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onUp, this);
        Tween.stopAllByTarget(this.node);
        this.node.setScale(this._base);
    }

    private onDown (): void {
        this.scaleTo(this.pressScale, 0.07);
    }

    private onUp (): void {
        this.scaleTo(1, 0.14);
    }

    private scaleTo (k: number, dur: number): void {
        Tween.stopAllByTarget(this.node);
        const target = this._base.clone().multiplyScalar(k);
        tween(this.node).to(dur, { scale: target }).start();
    }

    private onClick (): void {
        if (this.bridge) this.bridge.openStoreUrl(this.android ? ANDROID_STORE_URL : IOS_STORE_URL);
        EventBus.emit(GameEvent.CTA_CLICK);
    }
}
