import { _decorator, Button, Component, Tween, Vec3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { MraidBridge } from './MraidBridge';

const { ccclass, property } = _decorator;

/**
 * 游戏中的常驻下载按钮（结束界面那个是 `CtaController`）。一直呼吸；`END_SHOW` 一到就收掉 ——
 * 那一屏有自己的按钮，两个一起摆着反而像坏掉了。
 *
 * 位置不归它管：竖屏是节点上那个「贴下沿 + 水平居中」的 Widget，横屏由 `LandscapeLayout`
 * 挪到左边空位的中点（见 §7.1 / §14）。
 */
@ccclass('GameCta')
export class GameCta extends Component {
    @property({ type: MraidBridge, displayName: 'MRAID 桥' }) bridge: MraidBridge = null;

    @property({ displayName: '呼吸放大比', tooltip: '在编辑器里摆的缩放之上再放大这么多，0 = 不呼吸' }) breathScale = 0.06;
    @property({ displayName: '呼吸单程时长（秒）' }) breathTime = 0.9;

    private _base = new Vec3(1, 1, 1);

    protected onLoad(): void {
        this._base = this.node.scale.clone();
    }

    protected onEnable(): void {
        this.node.on(Button.EventType.CLICK, this.onClick, this);
        EventBus.on(GameEvent.END_SHOW, this.hide, this);
        this.breathe();
    }

    protected onDisable(): void {
        this.node.off(Button.EventType.CLICK, this.onClick, this);
        EventBus.off(GameEvent.END_SHOW, this.hide, this);
        Tween.stopAllByTarget(this.node);
    }

    hide(): void {
        Tween.stopAllByTarget(this.node);
        this.node.setScale(this._base);
        this.node.active = false;
    }

    private breathe(): void {
        if (this.breathScale <= 0) return;
        const low = this._base.clone();
        const high = low.clone().multiplyScalar(1 + this.breathScale);
        tween(this.node)
            .to(this.breathTime, { scale: high }, { easing: 'sineInOut' })
            .to(this.breathTime, { scale: low }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    private onClick(): void {
        this.bridge.openStore();
        EventBus.emit(GameEvent.CTA_CLICK);
    }
}
