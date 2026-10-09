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
    snapRadius: number;
    overlays: Sprite[];
    overlayMode: OverlayMode;
}
