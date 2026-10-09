import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 挂在缺口下 Repaired 节点上。只管「修复后长什么样、什么时候露出来」，
 * 不关心关卡，也不关心进度。overlays 数组顺序即 z 序。
 */
@ccclass('RepairedSlot')
export class RepairedSlot extends Component {
    @property({ type: [Sprite], displayName: '遮挡层（数组顺序即 z 序）' }) overlays: Sprite[] = [];

    private _view: Sprite = null;

    protected onLoad(): void {
        this._view = this.getComponent(Sprite);
    }

    /** 没在 PieceSlot 上配 repairedSprite 时，退回读节点上 Sprite 已经拖好的图 */
    get frame(): SpriteFrame {
        return this._view ? this._view.spriteFrame : null;
    }

    setArt(frame: SpriteFrame, overlayFrames: SpriteFrame[]): void {
        if (this._view && frame) this._view.spriteFrame = frame;
        for (let i = 0; i < this.overlays.length; i++) {
            this.overlays[i].spriteFrame = overlayFrames[i] || null;
        }
    }

    /** withOverlays 为 false 时先藏着遮挡层，等总修复再放出来 */
    show(withOverlays: boolean): void {
        this.node.active = true;
        for (let i = 0; i < this.overlays.length; i++) {
            const o = this.overlays[i];
            o.node.active = withOverlays;
            o.node.setSiblingIndex(i);
        }
    }

    showOverlays(): void {
        for (let i = 0; i < this.overlays.length; i++) {
            const o = this.overlays[i];
            o.node.active = true;
            o.node.setSiblingIndex(i);
        }
    }

    hide(): void {
        this.node.active = false;
        for (let i = 0; i < this.overlays.length; i++) this.overlays[i].node.active = false;
    }
}
