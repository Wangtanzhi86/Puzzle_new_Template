import { _decorator, Component, EffectAsset, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { PoolManager } from '../core/PoolManager';
import { GlowConfig, PieceGlow } from './PieceGlow';

const { ccclass, property } = _decorator;

/**
 * 碎片是运行时实例（§3 允许），所以这里代码建节点，不用 prefab。
 * 高度固定，宽度按图片自身比例算 —— 碎片永远不会被拉变形。
 */
@ccclass('PieceFactory')
export class PieceFactory extends Component {
    @property({ displayName: '池内碎片高度（px）', tooltip: '宽度按图片比例自动算，不会被拉变形' })
    pieceHeight = 190;

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

        const ratio = frame ? frame.rect.width / frame.rect.height : 1;
        const w = this.pieceHeight * ratio;
        node.getComponent(UITransform).setContentSize(w, this.pieceHeight);
        if (FeatureFlags.pieceGlow) node.getComponent(PieceGlow).apply(this.glowEffect, frame, w, this.pieceHeight, this.glowParams);

        node.setParent(parent);
        node.setScale(1, 1, 1);
        node.active = true;
        return node;
    }

    recycle(node: Node): void {
        this._pool.put(PieceFactory.KEY, node);
    }
}
