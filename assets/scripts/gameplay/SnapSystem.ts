import { _decorator, Component, Node, Vec3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';

const { ccclass } = _decorator;

/** 只做一件事：碎片中心进入**它自己那个**未修复缺口的吸附半径，就判成功。
 *  碎片与缺口一一对应（`PiecePool` 按 `data[i]` 顺序建碎片，也就是 `PieceSlot.pieceId` 的顺序），
 *  所以只量自己那一格 —— 遍历全部槽位会让拖过别的缺口时被就近抢走。 */
@ccclass('SnapSystem')
export class SnapSystem extends Component {
    private _data: SlotData[] = [];

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_DRAG, this.onDrag, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_DRAG, this.onDrag, this);
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._data = data;
    }

    private onDrag(piece: Node, worldPos: Vec3, slotIndex: number): void {
        const d = this._data[slotIndex];
        if (d.slot.repaired) return;
        // 缺口中心现读：画布尺寸会随转屏 / 撑满屏幕变，建关卡时存下来的那份世界坐标会过期
        const at = d.slot.worldCenter;
        const dx = at.x - worldPos.x;
        const dy = at.y - worldPos.y;
        if (dx * dx + dy * dy <= d.snapRadius * d.snapRadius) {
            EventBus.emit(GameEvent.PIECE_SNAP_SUCCESS, piece, d.index);
        }
    }
}
