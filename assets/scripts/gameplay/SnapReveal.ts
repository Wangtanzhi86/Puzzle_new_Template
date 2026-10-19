import { _decorator, Component, EffectAsset, Material, Node, Sprite, Tween, UIOpacity, UITransform, Vec3, Vec4, tween, v3 } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { OverlayMode } from '../data/LevelTypes';
import { RevealHost } from './RepairReveal';

const { ccclass, property } = _decorator;

interface SnapHandle {
    onRevealed: () => void;
    sprite: Sprite;
    mat: Material;
    /** xy 圆心（世界坐标）/ z 进度半径 / w 1÷跨度 */
    params: Vec4;
    /** x 边缘提亮 / y 水平波纹开关 */
    look: Vec4;
    opacity: UIOpacity;
    /** 修复图在编辑器里的原始缩放 —— 冲击那三下都是相对它乘的 */
    base: Vec3;
    state: { p: number };
}

/**
 * 「吸附瞬间」的时序，1:1 抄 CopyPuzzle 的 `PuzzleItem._reveal()` / `_playSnapAnimation()` /
 * `_startFader()`（原版不是动画文件，是三条纯 tween —— `assets` 下没有任何 .anim）。
 *
 * 时间轴（以 `punchTime` = 0.6 秒为一段，下面都是它的固定比例，所以调一个数整段等比缩放）：
 *   0           修复图整张亮在缺口上（材质已经挂上，但进度先给到「全开」= 1 + 羽化）
 *   0    → 1/3  压成 0.96 × 1.0256（横向收、纵向撑一点，像被按了一下）
 *   1/3  → 0.639 鼓到 1.1（回弹过冲）
 *   0.639→ 0.667 收回 1
 *   0.417→ 0.972 不透明度 255 → 0（碎片「化掉」，底下那张破损图重新露出来）
 *   0.972       不透明度回到 255，同时**把扩散进度重置成 0** —— 于是它重新从圆心长出来
 *   0.972 → 0.972+revealTime   径向扩散，expoOut
 *   扩散跑完     回调 `covered()`：收掉破损图、抛 `PIECE_SHOWN`
 *
 * 三处细节是原版的「手感」，别顺手改掉：
 * 1. **冲击只演 0.417 秒就被淡化吞掉** —— 玩家看到的是「弹一下、化掉、再从中心长出来」，
 *    不是「弹一下然后完整地待在那儿」。
 * 2. 淡化归零的那一刻正好是扩散启动的那一刻，所以「整张突然消失 → 从圆心出现」这个跳变
 *    被 0 不透明度盖住了，玩家看不到。
 * 3. 扩散不是等速圆：`bg-reveal.effect` 的 `revealLook.y` 按 `cos²(0.5 - uv0.x)` 给每一列
 *    不同的半径（中缝慢、两侧快），`revealLook.x` 再把软边那一圈提亮 —— 原版 Fader 的
 *    brightness = 5。结束背景那套不填这两个值，行为不变。

 * 挂在 EffectLayer 上，和 RepairReveal / CircleReveal / RepairSweep 并列，全局一份，多个槽位共用。
 * 开关是 `FeatureFlags.snapReveal` —— 关掉就整条回退到槽位原来那套揭晓（`PieceSlot.repair()`
 * 里本组件的分支排在最前面，`handles()` 一返 false 就直接落到下面的分支）。
 */
@ccclass('SnapReveal')
export class SnapReveal extends Component {
    @property({ type: EffectAsset, displayName: '扩散材质', tooltip: '和结束背景 / 圆形扩散是同一份 bg-reveal.effect' })
    revealEffect: EffectAsset = null;

    @property({ displayName: '冲击时长（秒）', tooltip: '原版 0.6：弹一下（0.2）→ 鼓到 1.1（0.38333）→ 收回 1（1/60），同时淡出到 0' })
    punchTime = 0.6;

    @property({ displayName: '扩散时长（秒）', tooltip: '原版 8 秒（expoOut，前两秒走掉八成）。目标工程一行 23 格，想快一点先试 1.2' })
    revealTime = 8;

    @property({ displayName: '羽化半宽（相对半径）', tooltip: '越大边越虚。0.35 约等于软边占半径的三分之一' })
    feather = 0.35;

    @property({ displayName: '边缘提亮', tooltip: '原版 Fader 的 brightness = 5：刚扫到的那一圈按 (1-a)² 叠亮。0 = 不提亮' })
    brightness = 5;

    @property({ displayName: '水平波纹', tooltip: '原版 Fader 的 cos²(0.5 - uv0.x)：左右两侧扩得比中缝快，扫过时不是正圆。关掉就是标准同心圆' })
    waveOn = true;

    private _live = new Map<Node, SnapHandle>();

    /** 这一格该不该走吸附瞬间时序（开关开着 + 拖了材质 + 有修复图）。false 时调用方照旧走它自己那套 */
    handles(host: RevealHost): boolean {
        return FeatureFlags.snapReveal && !!this.revealEffect && !!host.showView;
    }

    play(host: RevealHost, onRevealed: () => void): void {
        const view = host.showView;
        const node = view.node;
        const sprite = node.getComponent(Sprite);
        if (!sprite) {
            onRevealed();
            return;
        }
        // 同一格被重复调（转屏重排之类的极端情况）：先把旧的收干净，但不算「已露面」
        if (this._live.has(node)) this.stop(node, false);

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
            // 起始给「全开」：冲击那一下修复图必须是整张可见的，扩散等 0.583 秒才开始
            1 + this.feather,
            1 / (Math.hypot(w, h) * 0.5),
        );
        const look = new Vec4(this.brightness, this.waveOn ? 1 : 0, 0, 0);

        const mat = new Material();
        mat.initialize({ effectAsset: this.revealEffect, defines: { USE_TEXTURE: true } });
        mat.setProperty('revealEdge', new Vec4(this.feather, 0, 0, 0));
        mat.setProperty('revealParams', params);
        mat.setProperty('revealLook', look);
        sprite.customMaterial = mat;

        // 修复图原来可能挂着 UIOpacity（编辑器里配的），没有就补一个 —— 只加组件、不建节点
        let opacity = node.getComponent(UIOpacity);
        if (!opacity) opacity = node.addComponent(UIOpacity);
        opacity.opacity = 255;

        const base = node.scale.clone();
        const handle: SnapHandle = {
            onRevealed,
            sprite,
            mat,
            params,
            look,
            opacity,
            base,
            state: { p: 0 },
        };
        this._live.set(node, handle);

        // ── 冲击：三段缩放 ──────────────────────────────────────────────
        const T = this.punchTime;
        Tween.stopAllByTarget(node);
        tween(node)
            .to(T / 3, { scale: v3(base.x * 0.96, base.y * 1.0256, base.z) }, { easing: 'cubicInOut' })
            .to(T * 0.638889, { scale: v3(base.x * 1.1, base.y * 1.1, base.z) }, { easing: 'cubicInOut' })
            .to(T * 0.027778, { scale: v3(base.x, base.y, base.z) }, { easing: 'cubicInOut' })
            .start();

        // ── 淡化：0.417T 起，到 0.972T 归零（正好是扩散启动那一刻），再用 1/60 秒跳回 255 ──
        Tween.stopAllByTarget(opacity);
        tween(opacity)
            .delay(T * 0.416667)
            .to(T * 0.555556, { opacity: 0 })
            .to(T * 0.027778, { opacity: 255 })
            .start();

        // ── 扩散：0.972T 才启动；`state.p` 从 0 起，所以视觉上是「从圆心重新长出来」 ──
        this.scheduleOnce(() => {
            if (this._live.get(node) !== handle) return;
            handle.state.p = 0;
            this.paint(handle);
            tween(handle.state)
                .to(this.revealTime, { p: 1 + this.feather }, { onUpdate: () => this.paint(handle) })
                .call(() => this.stop(node, true))
                .start();
        }, T * 0.972222);
    }

    private paint(handle: SnapHandle): void {
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
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(handle.opacity);
        node.setScale(handle.base);
        handle.opacity.opacity = 255;
        handle.sprite.customMaterial = null;
        handle.mat.destroy();
        if (revealed) handle.onRevealed();
    }
}
