import { _decorator, Component, Node } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceSlot } from './PieceSlot';

const { ccclass, property } = _decorator;

/**
 * 把 BrokenLayer 下美术摆好的槽位读成数据。缺口位置一律取节点的世界坐标，
 * 代码里不存任何坐标常量 —— 换关卡就是换一层节点。
 */
@ccclass('LevelFactory')
export class LevelFactory extends Component {
    @property({ type: Node, displayName: '缺口层（每个子节点一个缺口）' }) brokenLayer: Node = null;

    private _slots: PieceSlot[] = [];

    get slots(): PieceSlot[] {
        return this._slots;
    }

    get count(): number {
        return this._slots.length;
    }

    build(): SlotData[] {
        this._slots.length = 0;
        const children = this.brokenLayer.children;
        for (let i = 0; i < children.length; i++) {
            const slot = children[i].getComponent(PieceSlot);
            if (slot) this._slots.push(slot);
        }
        this._slots.sort((a, b) => a.pieceId - b.pieceId);

        const data: SlotData[] = [];
        for (let i = 0; i < this._slots.length; i++) {
            const slot = this._slots[i];
            if (slot.prefilled) slot.prefill(i);
            data.push({
                index: i,
                node: slot.node,
                slot,
                overlays: [],
                overlayMode: slot.overlayMode,
            });
        }
        EventBus.emit(GameEvent.LEVEL_BUILT, data);
        return data;
    }

    slotAt(index: number): PieceSlot {
        return this._slots[index];
    }
}
