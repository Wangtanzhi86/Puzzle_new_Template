import { _decorator, Component, EffectAsset, Material, Node, Sprite, Tween, UITransform, Vec4, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { OverlayMode } from '../data/LevelTypes';
import { RevealHost } from './RepairReveal';

const { ccclass, property } = _decorator;

interface RevealHandle {
    sprite: Sprite;
    mat: Material;
    /** 圆心 / 进度 / 1÷跨度。每格一份，两个槽位同时扩散时互不踩 */
    params: Vec4;
    state: { p: number };
    onRevealed: () => void;
}

/**
 * 单块修复的「圆形扩散」揭晓：修复图从缺口中心长出一个圆、边缘羽化，向外扩散盖住破损区。
 * 用的就是结束背景那一份 `bg-reveal.effect`，区别只是这里直接把材质挂在这一格「修复后的图」上 ——
 * 要盖住的东西就是它自己，不用像结束背景那样另建一层子节点再交接贴图。
 *
 * 破损图得留在底下垫着，`PieceSlot.repair()` 对配了本组件的槽位不立刻收它，扩完由
 * `PieceSlot.circleShown()` 收掉。所以这一格是整格接管：胶带 / 序列帧 / 换节点都不会发生。
 *
 * 材质是这一格自己的：扩散跑完 `customMaterial = null` 再销毁，最终画面就是一个普通 Sprite。
 *
 * 挂在 EffectLayer 上（和 RepairSweep / RepairReveal 并列），全局一个实例，各槽位填
 * `PieceSlot.circleReveal` 指过来。开关是 `FeatureFlags.circleReveal` —— 关掉就整条回退到原来的揭晓。
 */
@ccclass('CircleReveal')
export class CircleReveal extends Component {
    @property({ type: EffectAsset, displayName: '扩散材质', tooltip: '和结束背景是同一份 bg-reveal.effect' })
    revealEffect: EffectAsset = null;

    @property({ displayName: '扩散时长（秒）' })
    revealTime = 0.6;

    @property({ displayName: '羽化半宽（相对半径）', tooltip: '越大边越虚。0.35 约等于软边占半径的三分之一' })
    feather = 0.35;

    private _live = new Map<Node, RevealHandle>();
    private _edge = new Vec4();

    /** 这一格该不该走圆形扩散（开关开着 + 拖了材质 + 有修复图）。false 时调用方照旧走自己那套 */
    handles(host: RevealHost): boolean {
        return FeatureFlags.circleReveal && !!this.revealEffect && !!host.showView;
    }

    play(host: RevealHost, onRevealed: () => void): void {
        const view = host.showView;
        const node = view.node;
        // 先把修复图亮起来：圈还是 0 大，材质把它整个挡掉，画面上仍旧是底下那张破损图
        view.show(host.overlayMode === OverlayMode.IMMEDIATE);

        // 圆心和跨度按修复图自己的世界矩形手算（§14：`getBoundingBoxToWorld()` 会把活着的子节点
        // 一并进来）。跨度取半对角线 —— 进度走到 1 正好够到四角。
        const ut = node.getComponent(UITransform);
        const scale = node.worldScale;
        const at = node.worldPosition;
        const w = ut.width * scale.x;
        const h = ut.height * scale.y;
        const params = new Vec4(
            at.x + (0.5 - ut.anchorX) * w,
            at.y + (0.5 - ut.anchorY) * h,
            0,
            1 / (Math.hypot(w, h) * 0.5),
        );
        this._edge.set(this.feather, 0, 0, 0);

        const mat = new Material();
        mat.initialize({ effectAsset: this.revealEffect, defines: { USE_TEXTURE: true } });
        mat.setProperty('revealEdge', this._edge);
        mat.setProperty('revealParams', params);

        const sprite = node.getComponent(Sprite);
        sprite.customMaterial = mat;

        const handle: RevealHandle = { sprite, mat, params, state: { p: 0 }, onRevealed };
        this._live.set(node, handle);
        // 走到 1 只够实心部分盖住四角，软边那一段还得再走一个 feather —— 不然收尾时四个角
        // 会各留一点没铺满的渐隐
        tween(handle.state)
            .to(this.revealTime, { p: 1 + this.feather }, { onUpdate: () => this.paint(handle) })
            .call(() => this.stop(node, true))
            .start();
    }

    private paint(handle: RevealHandle): void {
        handle.params.z = handle.state.p;
        handle.mat.setProperty('revealParams', handle.params);
    }

    protected onDisable(): void {
        for (const node of Array.from(this._live.keys())) this.stop(node, false);
    }

    /** 收摊。材质必须显式销毁：引擎只销毁 MaterialInstance，shared material 没人管（见 §14）。
     *  `revealed` 为 false（onDisable 半路收）时不回调 —— 那一格算没露面，别去推进度、别触发总修复。 */
    private stop(node: Node, revealed: boolean): void {
        const handle = this._live.get(node);
        if (!handle) return;
        this._live.delete(node);
        Tween.stopAllByTarget(handle.state);
        handle.sprite.customMaterial = null;
        handle.mat.destroy();
        if (revealed) handle.onRevealed();
    }
}
