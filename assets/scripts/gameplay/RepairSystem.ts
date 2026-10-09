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

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_SNAP_SUCCESS, this.onSnap, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_SNAP_SUCCESS, this.onSnap, this);
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
    }

    private onSnap(_piece: Node, slotIndex: number): void {
        if (!this._data[slotIndex].slot.repair(slotIndex)) return;
        this._done++;
        EventBus.emit(GameEvent.PIECE_REPAIRED, slotIndex, this._done);
        EventBus.emit(GameEvent.REPAIR_PROGRESS, this._done, this._data.length);
        if (this._done < this._data.length) return;
        for (let i = 0; i < this._data.length; i++) this._data[i].slot.revealOverlays();
        EventBus.emit(GameEvent.LEVEL_COMPLETE);
    }
}
