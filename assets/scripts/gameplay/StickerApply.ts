import { _decorator, Color, Component, EffectAsset, Material, Node, Sprite, Tween, UIOpacity, UITransform, Vec2, Vec3, Vec4, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { OverlayMode } from '../data/LevelTypes';
import { RevealHost } from './RepairReveal';
import { peelLine } from './StickerPeel';

const { ccclass, property } = _decorator;

interface ApplyHandle {
    sprite: Sprite;
    mat: Material;
    back: Sprite;
    backMat: Material;
    state: { r: number };
    line: Vec4;
    param: Vec4;
    /** 这一格这一下的姿势，`play()` 时定死。**不能每帧现读组件自己的字段** ——
     *  多格同时在飞时各自的覆盖不一样，`paint` 由 tween 推着跑，读组件就是互相踩 */
    corner: Vec2;
    openRatio: number;
    creaseWidth: number;
    creaseGlow: number;
    onApplied: () => void;
}

interface PulseHandle {
    state: { g: number };
    /** 编辑器里那个缩放，脉冲跑完还原用 */
    base: Vec3;
    /** 编辑器里那个颜色 —— 收摊时连着每帧改的 alpha 一起还回去 */
    tint: Color;
    sprite: Sprite;
    /** 边缘高亮那个子节点；没配 `pulseEffect` 时是 null */
    glow: Node | null;
    glowMat: Material | null;
    onDone: () => void;
}

/**
 * 单块修复的「贴纸贴上去」揭晓：这一格的修复图整张直接出现在缺口上、一角还翘着（翘起来那半
 * 露的是贴纸背面），再把折线从那个角推向对边、一路按平（`assets/effects/sticker-peel-*.effect`，
 * 和碎片揭角是同一对材质，只是反着演）。
 *
 * 破损图在吸附那一刻就被 `PieceSlot.repair()` 收掉 —— 修复图整张铺满缺口，翘起来那个角露的是
 * 贴纸背面，底下不用垫图。整格接管 —— 胶带 / 序列帧 / 换节点 / 圆形扩散都不会发生。
 *
 * 推平之后还有一下**收尾脉冲**：修复图先缩一点、同时淡下去，再放大回原尺寸、把不透明度收回来。
 * 它跟圆形扩散不是一回事 —— 圆形扩散是「揭晓」，要有张破损图垫在底下可揭；这一刻修复图早就完整
 * 铺好了，脉冲不揭任何东西，纯粹是「贴好了」那一下的反馈。所以它俩不冲突、也不用抢，
 * 收尾这一下就长在贴平自己的流程末尾。
 *
 * 背面是修复图下面一个运行时建的同尺寸子节点（子节点画在父节点之上，翘起来那半正好压住画面；
 * 顶点着色器把那一半镜像过去，片元里涂平色 + 折线上一圈高光）。贴平后材质和背面节点都销毁，
 * 最终画面就是一个普通 Sprite。材质必须显式销毁 —— 引擎只销毁 MaterialInstance，shared material
 * 没人管（见 §14）。
 *
 * 挂在 EffectLayer 上（和 RepairSweep / RepairReveal / CircleReveal 并列），全局一个实例，
 * 各槽位填 `PieceSlot.stickerApply` 指过来。开关是 `FeatureFlags.stickerApply`。
 *
 * 姿势现读 `PieceSlot.peel`（那一格单独配的揭角）：配了就用它的，没配才用组件自己那 6 个字段
 * （那几个是接线脚本按全局 `PieceFactory.peelParams` 抄来的）。所以覆盖过的槽位不用再同步，
 * 手上翘着的角天然就是缺口上翘着的角。
 */
@ccclass('StickerApply')
export class StickerApply extends Component {
    @property({ type: EffectAsset, displayName: '正面材质', tooltip: '和揭角是同一份 sticker-peel-front.effect：折线外侧那半不画' })
    frontEffect: EffectAsset = null;

    @property({ type: EffectAsset, displayName: '背面材质', tooltip: '翘起来那半（顶点镜像 + 平色），挂在修复图下一个同尺寸子节点上' })
    backEffect: EffectAsset = null;

    @property({ type: Vec2, displayName: '翘哪个角', tooltip: '归一化坐标：(0,0) 左下 / (1,0) 右下 / (0,1) 左上 / (1,1) 右上。配成和碎片揭角同一个角，拿下那一刻才接得上' })
    corner = new Vec2(0, 0);

    @property({ displayName: '翘起来的比例', tooltip: '折线推过「角到对角」这条线多少。1 = 推过整条对角线；配成和碎片那个「掀起的比例」一样，吸附那一刻不会跳一下' })
    openRatio = 0.28;

    @property({ displayName: '贴平时长（秒）' })
    applyTime = 0.35;

    @property({ type: Color, displayName: '背面底色' })
    backColor = new Color(153, 153, 153, 255);

    @property({ displayName: '折线高光带宽度（相对修复图高）' })
    creaseWidth = 0.22;

    @property({ displayName: '折线高光强度', tooltip: '0 = 背面是一整块平色' })
    creaseGlow = 0.5;

    @property({ type: EffectAsset, displayName: '收尾脉冲材质', tooltip: '贴平推完紧跟着那一下「缩小淡出 → 放大淡入」途中的边缘高亮材质，复用 piece-glow.effect（和拖动亮边同一份）。留空 = 只做缩放和不透明度，不亮边' })
    pulseEffect: EffectAsset = null;

    @property({ displayName: '收尾缩小比', tooltip: '贴平推完先缩到原尺寸的多少（0–1），再放回原大小。1 = 完全不缩，只剩淡出淡入' })
    pulseShrinkScale = 0.86;

    @property({ displayName: '收尾最低不透明度', tooltip: '缩小那半程淡到多少（0–255），放大那半程再回到 255。⚠️ 调成 0 时这一格整个消失一下 —— 破损图在吸附那一刻就收了，淡到 0 的那一瞬这一格是空的（露 Scene_BG）；要留个底就调到 60 往上' })
    pulseMinOpacity = 0;

    @property({ displayName: '收尾缩小 + 淡出时长（秒）' })
    pulseDownTime = 0.1;

    @property({ displayName: '收尾放大 + 淡入时长（秒）' })
    pulseUpTime = 0.1;

    @property({ displayName: '收尾高亮外扩比', tooltip: '相对修复图高。光晕得画在 quad 外面，不留余量的话贴着边那圈会被裁平' })
    pulseMarginRatio = 0.03;

    @property({ displayName: '收尾高亮边宽比', tooltip: '相对修复图高' })
    pulseRimRatio = 0.01;

    private _live = new Map<Node, ApplyHandle>();
    private _pulses = new Map<Node, PulseHandle>();

    /** 这一格该不该走贴纸贴平（开关开着 + 两个材质都拖了 + 有修复图）。false 时调用方照旧走自己那套 */
    handles(host: RevealHost): boolean {
        return FeatureFlags.stickerApply && !!this.frontEffect && !!this.backEffect && !!host.showView;
    }

    play(host: RevealHost, onApplied: () => void): void {
        const view = host.showView;
        const node = view.node;
        const src = node.getComponent(Sprite);
        const ut = node.getComponent(UITransform);
        // 这一格单独配了揭角就用它的那份 —— 「手上翘着的角」和「缺口上翘着的角」天然是同一个姿势，
        // 不用再靠接线脚本两边抄（见 §14）。没配就走组件自己那套（＝原来的行为）
        const p = host.peel;
        // 修复图整张直接亮出来：从第一帧起它就盖住破损图了，翘起来那个角露的是贴纸背面
        view.show(host.overlayMode === OverlayMode.IMMEDIATE);

        // 背面节点：尺寸模式 / trim / type 全抄正面那个 Sprite，翻转过去的 quad 才对得齐
        const backNode = new Node('ApplyBack');
        backNode.setParent(node);
        backNode.addComponent(UITransform).setAnchorPoint(ut.anchorX, ut.anchorY);
        const back = backNode.addComponent(Sprite);
        back.type = src.type;
        back.sizeMode = Sprite.SizeMode.CUSTOM;
        back.trim = src.trim;
        back.spriteFrame = src.spriteFrame;
        backNode.getComponent(UITransform).setContentSize(ut.width, ut.height);
        const c = p ? p.backColor : this.backColor;
        const backMat = new Material();
        backMat.initialize({ effectAsset: this.backEffect, defines: { USE_TEXTURE: true } });
        backMat.setProperty('peelTint', new Vec4(c.r / 255, c.g / 255, c.b / 255, 1));
        back.customMaterial = backMat;

        const mat = new Material();
        mat.initialize({ effectAsset: this.frontEffect, defines: { USE_TEXTURE: true } });
        src.customMaterial = mat;

        const handle: ApplyHandle = {
            sprite: src, mat, back, backMat,
            state: { r: 1 }, line: new Vec4(), param: new Vec4(),
            corner: p ? p.corner : this.corner,
            openRatio: p ? p.liftRatio : this.openRatio,
            creaseWidth: p ? p.creaseWidth : this.creaseWidth,
            creaseGlow: p ? p.creaseGlow : this.creaseGlow,
            onApplied,
        };
        this._live.set(node, handle);
        this.paint(handle);
        tween(handle.state)
            .to(p ? p.stickTime : this.applyTime, { r: 0 }, { easing: 'sineInOut', onUpdate: () => this.paint(handle) })
            .call(() => this.settle(node))
            .start();
    }

    private paint(handle: ApplyHandle): void {
        peelLine(handle.sprite.node, handle.corner, handle.state.r * handle.openRatio, handle.creaseWidth, handle.creaseGlow, handle.line, handle.param);
        handle.mat.setProperty('peelLine', handle.line);
        handle.backMat.setProperty('peelLine', handle.line);
        handle.backMat.setProperty('peelParam', handle.param);
    }

    /** 贴平推到位：收起贴纸那套（材质 / 背面节点），紧接着演收尾脉冲。没配 `pulseEffect`
     *  就当场收摊 —— 这也是单独关掉这一下的口子。 */
    private settle(node: Node): void {
        const handle = this.peelOff(node);
        if (!handle) return;
        if (this.pulseEffect) this.runPulse(node, handle.onApplied);
        else handle.onApplied();
    }

    /** 收起贴纸那套。正常演完（`settle`）和半路收摊（`onDisable`）都走这一句 */
    private peelOff(node: Node): ApplyHandle | null {
        const handle = this._live.get(node);
        if (!handle) return null;
        this._live.delete(node);
        Tween.stopAllByTarget(handle.state);
        handle.sprite.customMaterial = null;
        handle.mat.destroy();
        handle.back.node.destroy();
        handle.backMat.destroy();
        return handle;
    }

    /**
     * 贴平之后那一下收尾：修复图先缩一点、同时淡下去（`g` 0 → 1），再放大回原尺寸、把不透明度
     * 收回来（1 → 0）。两半程都走 `sineInOut`，中间那一瞬间最暗最小。
     *
     * 不透明度走 `Sprite.color` 的 alpha，不走 `UIOpacity` —— 不用往这一格上加组件、也不用管它本来
     * 有没有 `UIOpacity`，收摊时把原色还回去就行。
     *
     * 边缘高亮（`pulseEffect`，可留空）是修复图下一个比它大一圈的子节点：贴着 quad 边的那段轮廓
     * 得有地方画，不留余量会被裁平；uvScale 把 uv 缩回修复图自己的坐标系 —— 和 `PieceGlow` 同一个
     * 套路、同一份材质。它的亮度走 `g` 自己那条 0 → 255 → 0 的包络：两端都不亮，跟画面一起收干净，
     * 不会在收摊那一帧「啪」地掉一下。
     *
     * 整个跑完才轮到 `onApplied`（这一格真正算露面的那一下，扫光和总修复计数都按它走）。
     */
    private runPulse(node: Node, onDone: () => void): void {
        const ut = node.getComponent(UITransform);
        const w = ut.width;
        const h = ut.height;

        let glow: Node = null;
        let glowMat: Material = null;
        if (this.pulseEffect) {
            const margin = h * this.pulseMarginRatio;
            const gw = w + margin * 2;
            const gh = h + margin * 2;
            const rim = h * this.pulseRimRatio;
            glow = new Node('ApplyPulse');
            glow.setParent(node);
            const glowUt = glow.addComponent(UITransform);
            // 子节点的 (0,0) 落在父节点的锚点上，所以要自己挪到父节点的中心去
            glow.setPosition((0.5 - ut.anchorX) * w, (0.5 - ut.anchorY) * h);
            const glowView = glow.addComponent(Sprite);
            glowView.sizeMode = Sprite.SizeMode.CUSTOM;
            glowView.spriteFrame = node.getComponent(Sprite).spriteFrame;
            // ⚠️ 尺寸必须排在赋 spriteFrame **之后**：CUSTOM 的 Sprite 一换帧就把节点尺寸改成
            // 贴图尺寸，先设的那次会被冲掉（同 `PieceGlow.apply`）。
            glowUt.setContentSize(gw, gh);
            glowMat = new Material();
            glowMat.initialize({ effectAsset: this.pulseEffect, defines: { USE_TEXTURE: true } });
            glowMat.setProperty('uvScale', new Vec2(w / gw, h / gh));
            glowMat.setProperty('glowParams', new Vec4(1, rim / w, rim / h, 0.6));
            glowView.customMaterial = glowMat;
        }
        const glowOpacity = glow ? glow.addComponent(UIOpacity) : null;

        const sprite = node.getComponent(Sprite);
        const base = node.scale.clone();
        const tint = sprite.color.clone();
        const live = tint.clone();
        const shrink = this.pulseShrinkScale;
        const low = this.pulseMinOpacity;
        const state = { g: 0 };
        const paint = (): void => {
            const g = state.g;
            const k = 1 + (shrink - 1) * g;
            node.setScale(base.x * k, base.y * k, base.z);
            live.a = 255 + (low - 255) * g;
            sprite.color = live;
            if (glowOpacity) glowOpacity.opacity = 255 * g;
        };
        this._pulses.set(node, { state, base, tint, sprite, glow, glowMat, onDone });
        paint();
        tween(state)
            .to(this.pulseDownTime, { g: 1 }, { easing: 'sineInOut', onUpdate: paint })
            .to(this.pulseUpTime, { g: 0 }, { easing: 'sineInOut', onUpdate: paint })
            .call(() => this.endPulse(node, true))
            .start();
    }

    /** 收脉冲：缩放与颜色还原、高亮节点与材质销毁（材质必须显式销毁，见 §14）。
     *  `done` 为 false（onDisable 半路收）时不回调 —— 那一格算没露面，别去推进度、别触发总修复 */
    private endPulse(node: Node, done: boolean): void {
        const handle = this._pulses.get(node);
        if (!handle) return;
        this._pulses.delete(node);
        Tween.stopAllByTarget(handle.state);
        node.setScale(handle.base);
        handle.sprite.color = handle.tint;
        if (handle.glow) {
            handle.glow.destroy();
            handle.glowMat.destroy();
        }
        if (done) handle.onDone();
    }

    protected onDisable(): void {
        for (const node of Array.from(this._live.keys())) this.peelOff(node);
        for (const node of Array.from(this._pulses.keys())) this.endPulse(node, false);
    }
}
