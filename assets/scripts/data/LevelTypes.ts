import { Enum, Node, Sprite } from 'cc';
import type { PieceSlot } from '../level/PieceSlot';

export enum OverlayMode {
    IMMEDIATE = 0,
    ON_COMPLETE = 1,
}
Enum(OverlayMode);

export interface SlotData {
    index: number;
    node: Node;
    slot: PieceSlot;
    // 注意：**不要**在这里存吸附半径 / 缺口世界坐标这类派生量。画布尺寸会随转屏变，
    // 建关卡时算一次的快照立刻就过期了 —— 一律现读 slot.radius / slot.worldCenter
    overlays: Sprite[];
    overlayMode: OverlayMode;
}
