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
    private _prefilled = 0;

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
        this._prefilled = 0;
        for (let i = 0; i < data.length; i++) if (data[i].slot.prefilled) this._prefilled++;
        // 预填那格没有吸附动作，但进度条一开始就该是「已修 1 格」——
        // 等这一帧所有 LEVEL_BUILT 监听都就位了再补发进度，别抢在别人的建关逻辑前面
        if (this._prefilled === 0) return;
        this.scheduleOnce(() => EventBus.emit(GameEvent.REPAIR_PROGRESS, this._prefilled, data.length), 0);
    }

    private onSnap(_piece: Node, slotIndex: number): void {
        if (!this._data[slotIndex].slot.repair(slotIndex)) return;
        this._done++;
        const shown = this._done + this._prefilled;
        // 预填那格不补发 PIECE_REPAIRED —— EndgameCta 是数这个事件数来跳商店的，
        // 补一发就等于开局白送一格，winCount 会提前达成
        EventBus.emit(GameEvent.PIECE_REPAIRED, slotIndex, this._done);
        EventBus.emit(GameEvent.REPAIR_PROGRESS, shown, this._data.length);
        if (this._done < this._data.length) return;
        for (let i = 0; i < this._data.length; i++) this._data[i].slot.revealOverlays();
        EventBus.emit(GameEvent.LEVEL_COMPLETE);
    }
}
