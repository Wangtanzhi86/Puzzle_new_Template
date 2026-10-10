import { _decorator, Component, Sprite, Tween, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 地上那摊脏水：平时不出现，Slot_04 修错（`REPAIR_FAILED`）时从上到下刷出来。
 *
 * 挂在 `Canvas/GameLayer/Scene_BG/地上脏水` 自己身上，Sprite 类型必须是 FILLED + VERTICAL。
 * ⚠️ 竖向填充的方向是「从 `fillStart` 那一头长到 `fillEnd`」：`fillStart = 1` 就是顶边，
 * 所以「从上往下」要 tween 一个 **0 → −1** 的 `fillRange`（引擎对负值的处理是「起点往反方向走」，
 * `bar-filled.ts:57`）。`fillRange = 0` 时 quad 退化成零高，什么都不画 —— 这就是「默认隐藏」，
 * 场景里存的是 1（编辑模式不跑 onLoad，得看得见才好摆位）。
 */
@ccclass('GroundWater')
export class GroundWater extends Component {
    @property({ displayName: '失败后延迟（秒）', tooltip: '失败那一刻起先等这么久再开始渐显' })
    delay = 0;

    @property({ displayName: '渐显时长（秒）' })
    revealTime = 0.5;

    private _sprite: Sprite = null;

    protected onLoad(): void {
        this._sprite = this.getComponent(Sprite);
        const frame = this._sprite.spriteFrame;
        // 动态图集默认开着：FILLED 裁切边上的线性采样会吃到图集里紧挨着的邻居像素
        if (frame) frame.packable = false;
        this._sprite.fillRange = 0;
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.REPAIR_FAILED, this.onFailed, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.REPAIR_FAILED, this.onFailed, this);
        Tween.stopAllByTarget(this._sprite);
    }

    private onFailed = (): void => {
        Tween.stopAllByTarget(this._sprite);
        this._sprite.fillRange = 0;
        tween(this._sprite).delay(this.delay).to(this.revealTime, { fillRange: -1 }, { easing: 'quadOut' }).start();
    };
}
