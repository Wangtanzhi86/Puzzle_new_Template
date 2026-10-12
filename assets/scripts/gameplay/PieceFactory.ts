import { _decorator, Component, EffectAsset, Node, Sprite, SpriteFrame, UIOpacity, UITransform } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { PoolManager } from '../core/PoolManager';
import { GlowConfig, PieceGlow } from './PieceGlow';
import { PeelConfig, StickerPeel } from './StickerPeel';

const { ccclass, property } = _decorator;

/**
 * 一块碎片要建出来需要的东西。`PieceSlot` 正好满足这个结构 —— 故意写成接口而不是 import 它：
 * `level/` 本来就 import `gameplay/`，反过来引一次就成环了（同 `RevealHost`）。
 */
export interface PieceSource {
    pieceFrame: SpriteFrame;
    /** `PieceSlot.peel` —— 这一格单独配的揭角参数；没配是 null（那就用工厂上那份全局的） */
    peel: PeelConfig | null;
}

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

    @property({ type: PeelConfig, displayName: '揭角参数（全局）', tooltip: '各槽位没勾「本格单独配揭角」时用的那一份' })
    peelParams: PeelConfig = new PeelConfig();

    @property({ type: EffectAsset, displayName: '揭角材质：正面', tooltip: '碎片自己的 Sprite 用它，折线外侧那半不画。全局一对 —— 池里的碎片节点是复用的，逐格换材质会「先到先得、后来不生效」，所以不按格配' })
    peelFrontEffect: EffectAsset = null;

    @property({ type: EffectAsset, displayName: '揭角材质：背面', tooltip: '折过去那半（顶点镜像 + 平色），挂在碎片下一个同尺寸子节点上' })
    peelBackEffect: EffectAsset = null;

    private static readonly KEY = 'piece';
    private _pool = new PoolManager();

    protected onLoad(): void {
        this._pool.register(PieceFactory.KEY, () => {
            const node = new Node('Piece');
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            node.addComponent(UIOpacity);   // 换批时的淡入用（`PiecePool.buildBatch`）
            if (FeatureFlags.pieceGlow) node.addComponent(PieceGlow);
            if (FeatureFlags.stickerPeel) node.addComponent(StickerPeel);
            return node;
        });
    }

    create(src: PieceSource, parent: Node): Node {
        const frame = src.pieceFrame;
        const node = this._pool.get(PieceFactory.KEY);
        const sprite = node.getComponent(Sprite);
        sprite.spriteFrame = frame;

        // 动态图集会把碎片重新排版，亮边 shader 往轮廓外采样就会读到隔壁图的像素
        if (frame) frame.packable = false;

        const k = frame ? Math.min(1, this.maxPieceSize / Math.max(frame.rect.width, frame.rect.height)) : 1;
        const w = frame ? frame.rect.width * k : this.maxPieceSize;
        const h = frame ? frame.rect.height * k : this.maxPieceSize;
        node.getComponent(UITransform).setContentSize(w, h);
        node.getComponent(UIOpacity).opacity = 255;
        if (FeatureFlags.pieceGlow) node.getComponent(PieceGlow).apply(this.glowEffect, frame, w, h, this.glowParams);
        // 排在亮边之后：`PeelBack` 是后加的子节点，压在光晕上面，折起来那半才盖得住
        if (FeatureFlags.stickerPeel) {
            node.getComponent(StickerPeel).apply(this.peelFrontEffect, this.peelBackEffect, frame, w, h, src.peel || this.peelParams);
        }

        node.setParent(parent);
        node.setScale(1, 1, 1);
        node.active = true;
        return node;
    }

    recycle(node: Node): void {
        this._pool.put(PieceFactory.KEY, node);
    }
}
