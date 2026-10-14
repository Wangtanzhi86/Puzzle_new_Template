import { _decorator, Component, EffectAsset, Material, Node, Sprite, Tween, UITransform, Vec4, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { OverlayMode } from '../data/LevelTypes';
import { RevealHost } from './RepairReveal';

const { ccclass, property } = _decorator;

interface RevealHandle {
    sprite: Sprite;
    mat: Material;
    /** 长宽比 / 笔数 / 半径 / 进度。每格一份，两个槽位同时涂时互不踩 */
    params: Vec4;
    state: { p: number };
    onRevealed: () => void;
}

/**
 * 单块修复的「画笔涂色」揭晓：一块圆形笔头从左上角起笔、斜着来回刷（一笔从「上边」划到「左边」，
 * 下一笔从「左边」划回「上边」，整体一路推到右下角），刷到的地方才露出修复图 ——
 * 笔没到的地方 alpha 是 0，露出垫在底下的破损图。
 *
 * 破损图得留在底下垫着，`PieceSlot.repair()` 对配了本组件的槽位不立刻收它，涂完由
 * `PieceSlot.covered()` 收掉。所以这一格是整格接管：贴平 / 圆形扩散 / 序列帧 / 换节点都不会发生。
 * 路径与判定全在 `assets/effects/brush-reveal.effect` 里，这儿只管把尺寸和进度喂进去。
 *
 * 材质是这一格自己的：涂完 `customMaterial = null` 再销毁，最终画面就是一个普通 Sprite。
 *
 * 挂在 EffectLayer 上（和 RepairSweep / RepairReveal / CircleReveal / StickerApply 并列），
 * 全局一个实例，各槽位填 `PieceSlot.brushReveal` 指过来。开关是 `FeatureFlags.brushReveal` ——
 * 关掉就整条回退到原来的揭晓。
 */
@ccclass('BrushReveal')
export class BrushReveal extends Component {
    @property({ type: EffectAsset, displayName: '画笔材质' })
    brushEffect: EffectAsset = null;

    @property({ displayName: '涂完时长（秒）' })
    revealTime = 0.8;

    @property({ displayName: '笔触行数', tooltip: '来回刷几笔、从左上角推到右下角。笔数越多笔迹越密；⚠️ 材质里循环上界封的是 12' })
    rows = 5;

    @property({ displayName: '笔触半径（相对碎片高）', tooltip: '⚠️ 得 ≥ 1.45÷行数，否则相邻笔迹之间会留没涂到的缝（5 笔时下限 0.29）。调大 = 笔头更粗、来回的痕迹更糊' })
    radius = 0.3;

    @property({ displayName: '笔触羽化（相对半径）', tooltip: '越大笔迹边越虚；0 = 硬边' })
    feather = 0.25;

    private _live = new Map<Node, RevealHandle>();
    private _edge = new Vec4();

    /** 这一格该不该走画笔揭晓（开关开着 + 拖了材质 + 有修复图）。false 时调用方照旧走自己那套 */
    handles(host: RevealHost): boolean {
        return FeatureFlags.brushReveal && !!this.brushEffect && !!host.showView;
    }

    play(host: RevealHost, onRevealed: () => void): void {
        const view = host.showView;
        const node = view.node;
        // 先把修复图亮起来：笔还没落，材质把它整个挡掉，画面上仍旧是底下那张破损图
        view.show(host.overlayMode === OverlayMode.IMMEDIATE);

        const ut = node.getComponent(UITransform);
        const params = new Vec4(ut.width / ut.height, Math.min(this.rows, 12), this.radius, 0);
        this._edge.set(this.feather, 0, 0, 0);

        const mat = new Material();
        mat.initialize({ effectAsset: this.brushEffect, defines: { USE_TEXTURE: true } });
        mat.setProperty('brushParams', params);
        mat.setProperty('brushEdge', this._edge);

        const sprite = node.getComponent(Sprite);
        sprite.customMaterial = mat;

        const handle: RevealHandle = { sprite, mat, params, state: { p: 0 }, onRevealed };
        this._live.set(node, handle);
        tween(handle.state)
            .to(this.revealTime, { p: 1 }, { onUpdate: () => this.paint(handle) })
            .call(() => this.stop(node, true))
            .start();
    }

    private paint(handle: RevealHandle): void {
        handle.params.w = handle.state.p;
        handle.mat.setProperty('brushParams', handle.params);
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
