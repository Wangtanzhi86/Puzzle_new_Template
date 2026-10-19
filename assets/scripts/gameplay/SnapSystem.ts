import { _decorator, Component, Node, Vec3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';

const { ccclass, property } = _decorator;

/** 只做一件事：碎片进入**它自己那个**未修复缺口的吸附范围，就判成功。
 *  碎片与缺口一一对应（`PiecePool` 按 `data[i]` 顺序建碎片，也就是 `PieceSlot.pieceId` 的顺序），
 *  所以只量自己那一格 —— 遍历全部槽位会让拖过别的缺口时被就近抢走。
 *
 *  范围有两种形状（`snapMode`）：
 *  - 圆：`dx² + dy² <= snapRadius²`。本工程原来的行为，半径可以逐格填（`PieceSlot.snapRadius`），
 *    不填就按缺口短边 × `snapRadiusRatio`（默认 0.25）。
 *  - 按轴矩形：`|dx| <= 修复图宽 × r && |dy| <= 修复图高 × r`，两轴各自独立判。
 *    对齐 CopyPuzzle 的 `PuzzleItem._checkSnapping()`（原版 `k = snapRadius * 面板缩放`，然后
 *    `|Δy| <= k * 碎片高 && |Δx| <= k * 碎片宽`）。手感差别在长条物件上最明显：
 *    圆判据对「又高又窄」的缺口横向给得太多、纵向给得太少，矩形则是按物件自己的宽高各给比例，
 *    于是大件松、小件紧，还能逐格微调（`PieceSlot.snapRatio`，0 = 用这里的全局值）。
 */
@ccclass('SnapSystem')
export class SnapSystem extends Component {
    @property({ displayName: '吸附范围形状', tooltip: '0 = 圆（旧行为）；1 = 按轴矩形（宽高各给一个比例，对齐 CopyPuzzle）', range: [0, 1, 1] })
    snapMode = 1;

    @property({ displayName: '矩形吸附比例', tooltip: '矩形模式下：修复图的半宽 / 半高各乘这个值就是吸附范围。0.4 表示「离缺口中心 40% 宽、40% 高以内」都算吸附' })
    snapRatio = 0.4;

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
        if (!d || d.slot.repaired) return;
        // 缺口中心现读：画布尺寸会随转屏 / 撑满屏幕变，建关卡时存下来的那份世界坐标会过期
        const at = d.slot.worldCenter;
        const dx = at.x - worldPos.x;
        const dy = at.y - worldPos.y;

        if (this.snapMode === 0) {
            // 半径现读（PieceSlot.radius 自己也是现算的）：建关卡时存快照的话，转屏 / 撑满之后
            // 判据还是按旧画布算的 —— 见 data/LevelTypes.ts 里那条注记
            const old = d.slot.radius;
            if (dx * dx + dy * dy <= old * old) {
                EventBus.emit(GameEvent.PIECE_SNAP_SUCCESS, piece, d.index);
            }
            return;
        }

        // 逐格的比例优先；宽高取「修复后那张图」的世界尺寸 —— 碎片拿在手上时已经长到它那么大了，
        // 所以这里量出来的就是玩家眼前那块碎片的大小，不是缺口框
        const slot = d.slot;
        const r = slot.snapRatio > 0 ? slot.snapRatio : this.snapRatio;
        if (Math.abs(dx) <= slot.carryWidth * r && Math.abs(dy) <= slot.carryHeight * r) {
            EventBus.emit(GameEvent.PIECE_SNAP_SUCCESS, piece, d.index);
        }
    }
}
