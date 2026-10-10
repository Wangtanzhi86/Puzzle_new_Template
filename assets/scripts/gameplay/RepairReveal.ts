import { _decorator, Component, Node, Sprite, SpriteFrame, Tween, UITransform, Vec3, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { OverlayMode } from '../data/LevelTypes';
import { RepairedSlot } from '../level/RepairedSlot';

const { ccclass, property } = _decorator;

/**
 * `PieceSlot` 正好满足这个结构。故意写成接口而不是 import 它 —— 两边互相 import 会成环，
 * `@property` 的类型在模块初始化时就变成 undefined。
 */
export interface RevealHost {
    node: Node;
    /** `PieceSlot.showView` —— 这一格这次修复该展示的那张「修复后」（达标 / 未达标是两张不同的图），不是那个固定的 @property */
    showView: RepairedSlot;
    overlayMode: OverlayMode;
    worldCenter: Vec3;
    width: number;
}

interface RevealHandle {
    host: RevealHost;
    onRevealed: () => void;
    /** false = 只播序列帧，修复图一个字都不碰（毛衣那格：实物不出场，换帧才是它的露面） */
    showItem: boolean;
    /** 序列帧节点。播完就销毁 —— 之后这个句柄只剩「放大还在跑」这一件事 */
    node: Node | null;
    sprite: Sprite;
    /** 放大开始前记下的修复图尺寸（编辑器里那个），收摊时还原用 */
    base: Vec3 | null;
    elapsed: number;
    index: number;
}

/**
 * 单块修复的揭晓：先在缺口位置播一遍序列帧，再把修复后的图从 0 放大出来，
 * 放大跑完才回调 —— 调用方（`PieceSlot`）在那一下才抛 `PIECE_SHOWN`。
 * 毛衣那格（配了换帧目标的槽位）不吃放大这一步，只借序列帧那点时间，播完直接换帧（`showItem = false`）。
 *
 * 挂在 EffectLayer 上，和 RepairSweep / TrailEmitter 并列，全局一份，四个槽位共用。
 * 序列帧节点是运行时建的（§3 允许代码生成特效实例），挂在槽位节点下、排在修复图后面。
 */
@ccclass('RepairReveal')
export class RepairReveal extends Component {
    @property({ type: [SpriteFrame], displayName: '序列帧', tooltip: '按下标播一次；在资源管理器里框选后拖进来' })
    frames: SpriteFrame[] = [];

    @property({ displayName: '每帧时长（秒）', tooltip: '7 帧填 0.06 约 0.42 秒' })
    frameInterval = 0.06;

    @property({ displayName: '序列帧尺寸（相对缺口宽度）', tooltip: '按整张原始画布算 —— 图里留了透明边，实际那东西比这个数小' })
    sizeRatio = 1.2;

    @property({ displayName: '修复图放大时长（秒）' })
    revealTime = 0.35;

    private _live = new Map<Node, RevealHandle>();

    /**
     * 播一遍序列帧再回调 `onRevealed`；`showItem` 为 true 时中间还要把这一格的修复图从 0 放大出来。
     * 返回 false 表示这次不接管（开关关了 / 没配序列帧 / 没修复图），调用方照旧走自己那套。
     */
    play(host: RevealHost, onRevealed: () => void, showItem = true): boolean {
        if (!FeatureFlags.revealOnRepair || !this.frames.length || !host.showView) return false;

        const parent = this.node;
        const first = this.frames[0];
        const node = new Node('RevealFrames');
        // 挂特效层（本组件所在节点），不挂槽位下面：GameLayer 那个 RECT Mask 会把出框的截掉，
        // 而特效层是刻意留在 Mask 外面「可以盖过边界」的（§3 / §14 的 Mask 那条）。
        node.setParent(parent);
        node.addComponent(UITransform);
        const sprite = node.addComponent(Sprite);
        // RAW + 关 trim 才对得上：RAW 把框钉在原画布尺寸上（这几帧 trim 从 742×830 到 960×960），
        // trim 关掉才是「按原画布坐标画裁出来那一块」，而不是把它拉伸填满整个框。
        sprite.sizeMode = Sprite.SizeMode.RAW;
        sprite.trim = false;
        sprite.spriteFrame = first;
        const scale = this.sizeRatio * host.width / (first.originalSize.width * parent.worldScale.x);
        node.setScale(scale, scale, 1);
        node.setPosition(parent.getComponent(UITransform).convertToNodeSpaceAR(host.worldCenter));

        this._live.set(host.node, { host, onRevealed, showItem, node, sprite, base: null, elapsed: 0, index: 0 });
        return true;
    }

    protected update(dt: number): void {
        for (const handle of Array.from(this._live.values())) {
            if (!handle.node) continue;
            handle.elapsed += dt;
            const i = Math.min(Math.floor(handle.elapsed / this.frameInterval), this.frames.length - 1);
            if (i !== handle.index) {
                handle.index = i;
                handle.sprite.spriteFrame = this.frames[i];
            }
            if (handle.elapsed < this.frameInterval * this.frames.length) continue;
            handle.node.removeFromParent();
            handle.node.destroy();
            handle.node = null;
            this.reveal(handle);
        }
    }

    protected onDisable(): void {
        for (const handle of Array.from(this._live.values())) this.discard(handle);
        this._live.clear();
    }

    /** 序列帧播完：把修复图放出来，从 0 放大到编辑器里的尺寸。
     *  放大跑完才算「露脸」—— 缩到 0 的那一下抛 PIECE_SHOWN 的话，扫光会拿一个退化的包围盒去算扫描轴（跨度 0 → Infinity）。 */
    private reveal(handle: RevealHandle): void {
        if (!handle.showItem) {
            this.done(handle);
            return;
        }
        const view = handle.host.showView;
        const base = view.node.scale.clone();
        handle.base = base;
        view.show(handle.host.overlayMode === OverlayMode.IMMEDIATE);
        view.node.setScale(0, 0, base.z);
        tween(view.node)
            .to(this.revealTime, { scale: base }, { easing: 'backOut' })
            .call(() => this.done(handle))
            .start();
    }

    private done(handle: RevealHandle): void {
        this._live.delete(handle.host.node);
        handle.onRevealed();
    }

    /** 收摊：序列帧节点销毁，放大跑一半的修复图还原成编辑器里的尺寸 */
    private discard(handle: RevealHandle): void {
        if (handle.node) {
            handle.node.removeFromParent();
            handle.node.destroy();
            handle.node = null;
        }
        if (handle.base) {
            Tween.stopAllByTarget(handle.host.showView.node);
            handle.host.showView.node.setScale(handle.base);
        }
    }
}
