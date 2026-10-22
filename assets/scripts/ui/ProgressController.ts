import { _decorator, Component, Label, Node, Sprite, tween, Tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';

const { ccclass, property } = _decorator;

/** 进度 = 已修块数 / 总块数，填充走 tween 缓动。 */
@ccclass('ProgressController')
export class ProgressController extends Component {
    @property({ type: Node, displayName: '进度层根节点' }) root: Node = null;
    @property({ type: Label, displayName: '进度文字' }) label: Label = null;
    @property({ type: Sprite, displayName: '进度条填充（Sprite 类型需为 FILLED）' }) fill: Sprite = null;
    @property({ displayName: '填充缓动时长（秒）' }) fillTime = 0.4;

    private _tween: Tween<Sprite> = null;

    protected onEnable(): void {
        if (!FeatureFlags.progress) {
            if (this.root) this.root.active = false;
            return;
        }
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.REPAIR_PROGRESS, this.onProgress, this);
        EventBus.on(GameEvent.LEVEL_COMPLETE, this.onComplete, this);
    }

    protected onDisable(): void {
        this.stopTween();
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.REPAIR_PROGRESS, this.onProgress, this);
        EventBus.off(GameEvent.LEVEL_COMPLETE, this.onComplete, this);
    }

    private onLevelBuilt(data: SlotData[]): void {
        this.stopTween();
        if (this.fill) this.fill.fillRange = 0;
        let total = 0;
        for (let i = 0; i < data.length; i++) if (!data[i].slot.prefilled) total++;
        if (this.label) this.label.string = '0/' + total;
    }

    private onProgress(done: number, total: number): void {
        if (this.label) this.label.string = done + '/' + total;
        this.fillTo(total ? done / total : 1);
    }

    private onComplete(): void {
        if (this.label) this.label.string = '完成';
        this.fillTo(1);
    }

    private fillTo(target: number): void {
        if (!this.fill) return;
        this.stopTween();
        // fillStart 是 Sprite 上「从填充图左边往右缩」的比例；终点固定在 1，
        // 所以走到满格时 fillRange 应为 1 - fillStart，否则会提前填满、尾巴空转。
        this._tween = tween(this.fill)
            .to(this.fillTime, { fillRange: target * (1 - this.fill.fillStart) }, { easing: 'quadOut' })
            .call(() => { this._tween = null; })
            .start();
    }

    private stopTween(): void {
        if (!this._tween) return;
        this._tween.stop();
        this._tween = null;
    }
}
