import { _decorator, Component, EffectAsset, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { PoolManager } from '../core/PoolManager';
import { GlowConfig, PieceGlow } from './PieceGlow';

const { ccclass, property } = _decorator;

/**
 * 碎片是运行时实例（§3 允许），所以这里代码建节点，不用 prefab。
 * 池里按**素材原始像素**显示（不放大也不缩小），宽或高超过 `maxPieceSize` 的等比缩到它 ——
 * 尺寸完全由图片自己决定，不会被拉变形。间隔由 `PiecePool.fitSpacing` 照这些尺寸现算（一屏 4 块）。
 */
@ccclass('PieceFactory')
export class PieceFactory extends Component {
    @property({ displayName: '碎片最大边长（px）', tooltip: '池里按素材原始像素显示；宽或高超过这个值的等比缩到它（别填 0）' })
    maxPieceSize = 200;

    @property({ type: EffectAsset, displayName: '亮边材质' }) glowEffect: EffectAsset = null;

    @property({ type: GlowConfig, displayName: '亮边参数' })
    glowParams: GlowConfig = new GlowConfig();

    private static readonly KEY = 'piece';
    private _pool = new PoolManager();

    protected onLoad(): void {
        this._pool.register(PieceFactory.KEY, () => {
            const node = new Node('Piece');
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            if (FeatureFlags.pieceGlow) node.addComponent(PieceGlow);
            return node;
        });
    }

    create(frame: SpriteFrame, parent: Node): Node {
        const node = this._pool.get(PieceFactory.KEY);
        const sprite = node.getComponent(Sprite);
        sprite.spriteFrame = frame;

        // 动态图集会把碎片重新排版，亮边 shader 往轮廓外采样就会读到隔壁图的像素
        if (frame) frame.packable = false;

        const k = frame ? Math.min(1, this.maxPieceSize / Math.max(frame.rect.width, frame.rect.height)) : 1;
        const w = frame ? frame.rect.width * k : this.maxPieceSize;
        const h = frame ? frame.rect.height * k : this.maxPieceSize;
        node.getComponent(UITransform).setContentSize(w, h);
        if (FeatureFlags.pieceGlow) node.getComponent(PieceGlow).apply(this.glowEffect, frame, w, h, this.glowParams);

        node.setParent(parent);
        node.setScale(1, 1, 1);
        node.active = true;
        return node;
    }

    recycle(node: Node): void {
        this._pool.put(PieceFactory.KEY, node);
    }
}
