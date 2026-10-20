import { _decorator, Component, Node } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';

const { ccclass } = _decorator;

/** 一次吸附 = 一块修好。修满就抛总修复事件。 */
@ccclass('RepairSystem')
export class RepairSystem extends Component {
    private _data: SlotData[] = [];
    private _done = 0;
    private _prefilledDone = 0;

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_SNAP_SUCCESS, this.onSnap, this);
        EventBus.on(GameEvent.PREFILL_DONE, this.onPrefillDone, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_SNAP_SUCCESS, this.onSnap, this);
        EventBus.off(GameEvent.PREFILL_DONE, this.onPrefillDone, this);
    }

    get done(): number {
        return this._done;
    }

    get total(): number {
        return this._data.length;
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._data = data;
        this._done = 0;
        this._prefilledDone = 0;
        // 预填那格不在建关时算进度：开场后 `PrefillFlight` 会把碎片飞进去、演完才抛
        // `PREFILL_DONE`。没有补演组件时那格一直停在「已铺好」，进度也就从 0 起 ——
        // 这是场景配置缺失，不是运行期要兜的分支。
    }

    /** 预填那格的补演演完：这才把它算进进度（碎片还在飞的时候进度条不该先走）。 */
    private onPrefillDone(): void {
        this._prefilledDone++;
        EventBus.emit(GameEvent.REPAIR_PROGRESS, this._done + this._prefilledDone, this._data.length);
    }

    private onSnap(_piece: Node, slotIndex: number): void {
        if (!this._data[slotIndex].slot.repair(slotIndex)) return;
        this._done++;
        const shown = this._done + this._prefilledDone;
        // 预填那格不补发 PIECE_REPAIRED —— EndgameCta 是数这个事件数来跳商店的，
        // 补一发就等于开局白送一格，winCount 会提前达成
        EventBus.emit(GameEvent.PIECE_REPAIRED, slotIndex, this._done);
        EventBus.emit(GameEvent.REPAIR_PROGRESS, shown, this._data.length);
        if (this._done < this._data.length) return;
        for (let i = 0; i < this._data.length; i++) this._data[i].slot.revealOverlays();
        EventBus.emit(GameEvent.LEVEL_COMPLETE);
    }
}
