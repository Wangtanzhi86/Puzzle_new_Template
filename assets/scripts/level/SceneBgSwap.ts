import { _decorator, Component, EffectAsset, Material, Node, ParticleSystem2D, Sprite, Tween, UIOpacity, UITransform, Vec3, Vec4, gfx, tween, v3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { makeDotFrame } from '../core/DotTexture';
import { SlotData } from '../data/LevelTypes';

const { ccclass, property } = _decorator;

/** 和 `brush-reveal.effect` 里 `BRUSH_MAX_ROWS` 同一个上限，改要两边一起改 */
const BRUSH_MAX_ROWS = 12;

/**
 * 全部修完之后把拼图区背景换成「完成背景」。两种模式，`instant` 选：
 *
 * - **`instant = true`（现在走的）**：分两拍走 ——
 *   ① **最后一块吸附成功当刻**（`LEVEL_COMPLETE`，这时所有碎片都已落位，只剩最后那几格的「贴纸按平」还在演）
 *      就**当刻把完成图亮出来**：不建材质、不起 tween、不撒仙尘，只是把 `完成背景` 的贴图挪到本节点上；
 *   ② **最后一格露面**（最后一个 `PIECE_SHOWN`，= 放置那一段演完）才抛 `END_SHOW`（下一拍是结尾视频 → 结束界面）。
 * - `instant = false`：一支圆头画笔从左上角起笔斜着来回刷到右下角（和单块修复同一份
 *   `brush-reveal.effect`），刷过的地方才露出完成图；笔头走到哪 `dust`（`魔法仙尘`）撒到哪。
 *   这条路**不提前**：等最后一格露面才落笔，涂完立刻抛 `END_SHOW`。
 *
 * 两种模式**收尾状态一模一样**（贴图挪到本节点上、`完成背景` 睡着），所以下游（结尾视频、结束界面）
 * 不必知道走的是哪条。
 *
 * `delay` 是「等多久再亮／再落笔」：instant 模式下从 `LEVEL_COMPLETE` 起算，画笔模式下从最后一格露面起算。
 * 前面那道横扫的扫光关掉之后它该是 0（见 §15 `sweepOnComplete`）。
 */
@ccclass('SceneBgSwap')
export class SceneBgSwap extends Component {
    @property({ displayName: '直接亮出来', tooltip: '勾上（现在）：最后一块落位当刻就把完成图亮出来、最后一格演完再抛 END_SHOW；不走画笔、不起 tween、不撒仙尘。取消勾选退回画笔涂色那一套（等最后一格露面才落笔）' })
    instant = true;

    @property({ type: EffectAsset, displayName: '画笔材质', tooltip: '和六格修复同一份 brush-reveal.effect。⚠️「直接亮出来」勾着时不起作用' })
    brushEffect: EffectAsset = null;

    @property({ type: Sprite, displayName: '完成背景（画笔涂色用）', tooltip: '本节点下的一个同尺寸子节点，贴图就是修完那张。收尾时它的贴图会挪到本节点上、自己被收掉' })
    revealView: Sprite = null;

    @property({ type: ParticleSystem2D, displayName: '魔法仙尘', tooltip: '笔头走到哪撒到哪。参数全在这个粒子节点上；⚠️ 把它的「加载时播放」关掉（起停由本组件管）。留空就不撒粒子。⚠️「直接亮出来」勾着时不起作用' })
    dust: ParticleSystem2D = null;

    @property({ displayName: '开演前等待（秒）', tooltip: '⚠️ 只对「直接亮出来」生效：最后一块落位之后先等这么久再亮。画笔模式不读它（最后一个 PIECE_SHOWN 当刻就落笔）。它和 `RepairSweep` 的「总修复：开演前定格 + 时长」是一对，改一边要看另一边；扫光开关关着时填 0' })
    delay = 0;

    @property({ displayName: '涂完时长（秒）', tooltip: '⚠️「直接亮出来」勾着时不起作用' })
    revealTime = 1.5;

    @property({ displayName: '笔触行数', tooltip: '来回刷几笔、从左上角推到右下角。⚠️ 材质里循环上界封的是 12。⚠️「直接亮出来」勾着时不起作用' })
    rows = 12;

    @property({ displayName: '笔触半径（相对高度）', tooltip: '⚠️ 半径有下限，低于它相邻笔迹之间会露底：本方图比例下实测 ≈ 0.75÷行数（12 笔即 0.062）。起笔那一瞬是半径 = 本值×高度 的圆，调大糊得越大。⚠️「直接亮出来」勾着时不起作用' })
    radius = 0.08;

    @property({ displayName: '笔触羽化（相对半径）', tooltip: '越大笔迹边越虚；0 = 硬边。⚠️「直接亮出来」勾着时不起作用' })
    feather = 0.25;

    @property({ type: [Node], displayName: '完成图出现时收掉的节点', tooltip: '成图里已经画好的那些活节点（换人的 Spine、破损图替身之类）—— 完成图一亮它们就盖在成图上，看起来像「穿模」。留空不影响' })
    hideAtComplete: Node[] = [];

    @property({ type: [Node], displayName: '开演前收掉的节点', tooltip: '亮图 / 落笔之前先淡出这些节点（例：BrokenLayer 的破损碎片、碎片池、进度条）—— 免得画笔刷过去时底下还露着它们。两种模式都生效。⚠️ 留空会自动按名字收：GameLayer/BrokenLayer、Canvas/PiecePoolLayer、DragRoot、GameCta、UILayer/GuideLayer、UILayer/ProgressLayer（编辑器存盘时把这里清空也不至于整场露底）' })
    hideBeforeReveal: Node[] = [];

    @property({ displayName: '收场淡出时长（秒）', tooltip: '「开演前收掉的节点」淡出多久；填 0 = 当场收掉' })
    hideFadeTime = 0.3;

    private _total = 0;
    private _shown = 0;
    /** 完成图已经亮出来了（只亮一次） */
    private _revealed = false;
    /** `END_SHOW` 已经抛过了（只抛一次：instant 模式下可能两条路都到这儿） */
    private _ended = false;
    private _mat: Material = null;
    private _state = { p: 0 };
    private _params = new Vec4();
    private _edge = new Vec4();
    private _ut: UITransform = null;
    private _aspect = 1;
    private _head = new Vec3();

    protected onLoad(): void {
        if (this.revealView) this.revealView.node.active = false;
        // 仙尘贴图没配就用代码画的白点兜底（和拖尾同一个）。美术出了仙尘图，
        // 直接拖到那个粒子节点的「SpriteFrame」上即可 —— 这儿只在空着时才塞
        if (this.dust && !this.dust.spriteFrame) this.dust.spriteFrame = makeDotFrame();
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.LEVEL_COMPLETE, this.onLevelComplete, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.LEVEL_COMPLETE, this.onLevelComplete, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        this.unschedule(this.reveal);
        this.unschedule(this.startBrush);
        if (this._mat) this.abort();
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._total = data.length;
        this._shown = 0;
        this._revealed = false;
        this._ended = false;
    }

    /** 最后一块**吸附成功**当刻（`LEVEL_COMPLETE`）：走「直接亮出来」时就在这一拍亮图 ——
     *  这一拍所有碎片都已经落位（计数到齐才抛），还在演的只有最后那几格的「贴纸按平」，
     *  它们演在已经完整的画面上，不会有缺口。画笔模式不接这一拍（它等最后一格露面再落笔）。 */
    private onLevelComplete(): void {
        if (!this.instant) return;
        if (this.delay > 0) this.scheduleOnce(this.reveal, this.delay);
        else this.reveal();
    }

    /** 最后一格露面（= 放置那一段演完） */
    private onShown(): void {
        this._shown++;
        if (this._shown < this._total) return;
        this.unschedule(this.reveal);   // 已经提前亮过了（画笔模式没提前亮，这句是空转）
        this.reveal();                  // 兜底：`LEVEL_COMPLETE` 没来 / 来晚了，至少别把线稿带去结束界面
        if (this.instant) this.endShow();
    }

    /** 没在 Inspector 上填「开演前收掉的节点」时的兜底：按层级名字现找，免得场景存盘把数组清掉就整场露底 */
    private layersByName(): Node[] {
        const game = this.node.parent;
        const canvas = game ? game.parent : null;
        const ui = canvas ? canvas.getChildByName('UILayer') : null;
        const pick: (Node | null)[] = [
            game ? game.getChildByName('BrokenLayer') : null,
            canvas ? canvas.getChildByName('PiecePoolLayer') : null,
            canvas ? canvas.getChildByName('DragRoot') : null,
            canvas ? canvas.getChildByName('GameCta') : null,
            ui ? ui.getChildByName('GuideLayer') : null,
            ui ? ui.getChildByName('ProgressLayer') : null,
        ];
        return pick.filter((n): n is Node => !!n);
    }

    /** 收场：让这些节点在 time 秒里淡到 0 再隐藏（time ≤ 0 当刻收）—— 硬收会「啪」一下，淡出跟画笔同拍更顺 */
    private fadeOut(nodes: Node[], time: number): void {
        for (const n of nodes) {
            if (!n || !n.active) continue;
            if (time <= 0) {
                n.active = false;
                continue;
            }
            let op = n.getComponent(UIOpacity);
            if (!op) op = n.addComponent(UIOpacity);
            Tween.stopAllByTarget(op);
            tween(op).to(time, { opacity: 0 }).call(() => { n.active = false; }).start();
        }
    }

    /** 亮出完成图。两种模式都走这儿，`_revealed` 保证只做一次 */
    private reveal(): void {
        if (this._revealed) return;
        this._revealed = true;
        this.fadeOut(this.hideBeforeReveal.length > 0 ? this.hideBeforeReveal : this.layersByName(), this.hideFadeTime);
        if (this.instant || !this.brushEffect || !this.revealView) {
            // 「直接亮出来」（或没配画笔材质 / 没收尾节点）：当刻收尾。
            // 没配画笔材质那条**也要收尾**，否则完成图根本不会出现，玩家看到的还是线稿
            this.complete();
            if (this.instant) return;   // 收场留给最后一格露面那一拍
            this.endShow();
            return;
        }
        // 收场淡出走完才起笔 —— 画笔落下的那一刻，破损碎片已经收干净了
        if (this.hideFadeTime > 0) {
            this.scheduleOnce(this.startBrush, this.hideFadeTime);
            return;
        }
        this.startBrush();
    }

    private startBrush(): void {
        if (!this.revealView) return;
        const view = this.revealView;
        view.node.active = true;

        this._ut = view.node.getComponent(UITransform);
        this._aspect = this._ut.width / this._ut.height;
        this._params.set(this._aspect, Math.min(this.rows, BRUSH_MAX_ROWS), this.radius, 0);
        this._edge.set(this.feather, 0, 0, 0);

        const mat = new Material();
        mat.initialize({ effectAsset: this.brushEffect, defines: { USE_TEXTURE: true } });
        mat.setProperty('brushParams', this._params);
        mat.setProperty('brushEdge', this._edge);
        view.customMaterial = mat;
        this._mat = mat;

        if (this.dust) {
            this.glow();
            this.dust.resetSystem();
        }

        this._state.p = 0;
        this.paint();
        tween(this._state)
            .to(this.revealTime, { p: 1 }, { onUpdate: () => this.paint() })
            .call(() => this.finish())
            .start();
    }

    private paint(): void {
        this._params.w = this._state.p;
        this._mat.setProperty('brushParams', this._params);
        if (this.dust) this.dust.node.setPosition(this.headOf(this._state.p));
    }

    /**
     * 加色混合：仙尘叠在一起越叠越亮（普通 alpha 混合叠出来是灰的）。
     * `ParticleSystem2D` 的混合模式没有 Inspector 口、也不是 `@property`（和 `Layout` 的对齐勾一样
     * 存不进场景），所以只能运行期改材质实例的混合状态 —— 和 `UIRenderer._updateBlendFunc()` 同一个写法。
     */
    private glow(): void {
        const state = this.dust.getMaterialInstance(0).passes[0].blendState;
        const target = state.targets[0];
        target.blend = true;
        target.blendSrc = gfx.BlendFactor.SRC_ALPHA;
        target.blendDst = gfx.BlendFactor.ONE;
        state.setTarget(0, target);
    }

    /**
     * 笔头在第 p 段进度时落在哪（`revealView` 的局部坐标）。
     * 照抄 `brush-reveal.effect` 的那套几何：把节点的 uv 按长宽比 A 拉成「像素坐标」、原点挪到左上角，
     * 第 i 笔是 `u + t = d` 这条 45° 斜线的一段（`d = (i + 0.5) × 2 ÷ K`），各笔依次首尾相接。
     * 材质在 GPU 上算「哪些像素刷过了」，这儿只复述「笔尖在哪」—— 两边用的是同一组数，改一边要改另一边。
     */
    private headOf(p: number): Vec3 {
        const a = this._aspect;
        const k = Math.min(this.rows, BRUSH_MAX_ROWS);
        const dd = 2 / k;
        const diag = Math.hypot(a, 1);

        let total = 0;
        for (let i = 0; i < k; i++) total += Math.min((i + 0.5) * dd, 2 - (i + 0.5) * dd) * diag;

        let done = p * total;
        for (let i = 0; i < k; i++) {
            const d = (i + 0.5) * dd;
            const len = Math.min(d, 2 - d) * diag;
            if (done > len) {
                done -= len;
                continue;
            }
            // d ≤ 1 的两端落在「上边」「左边」，d ≥ 1 落在「右边」「下边」
            const near = d <= 1;
            let ax = (near ? d : 1) * a, ay = near ? 0 : d - 1;
            let bx = (near ? 0 : d - 1) * a, by = near ? d : 1;
            // 奇数笔从后一个端点划回前一个 —— 笔头不必跨过整块跳到下一笔的起笔处
            if (i % 2 === 1) {
                const sx = ax, sy = ay;
                ax = bx; ay = by;
                bx = sx; by = sy;
            }
            const tau = len > 0 ? done / len : 0;
            return this._head.set(
                ((ax + (bx - ax) * tau) / a - this._ut.anchorX) * this._ut.width,
                (1 - (ay + (by - ay) * tau) - this._ut.anchorY) * this._ut.height,
                0,
            );
        }
        return this._head.set(0, 0, 0);
    }

    private finish(): void {
        this.complete();
        this.abort();
        this.endShow();
    }

    /** 抛 `END_SHOW`（只抛一次）。instant 模式下两条路都可能到这儿：最后一格露面那一拍、
     *  以及「没配画笔材质」那条兜底。 */
    private endShow(): void {
        if (this._ended) return;
        this._ended = true;
        EventBus.emit(GameEvent.END_SHOW);
    }

    /** 把完成背景那张贴图挪到本节点上、把 `完成背景` 收掉 —— 两种模式的收尾都走这儿，
     *  最终画面就是一个节点、一张不透明的底图，不留一层常驻的透明覆盖。 */
    private complete(): void {
        for (const n of this.hideAtComplete) if (n) n.active = false;
        const view = this.revealView;
        if (!view) return;
        this.getComponent(Sprite).spriteFrame = view.spriteFrame;
        view.node.active = false;
    }

    /** 收摊。材质必须显式销毁：引擎只销毁 MaterialInstance，shared material 没人管（见 §14）。 */
    private abort(): void {
        Tween.stopAllByTarget(this._state);
        if (this.dust) this.dust.stopSystem();
        this.revealView.customMaterial = null;
        this._mat.destroy();
        this._mat = null;
        this.revealView.node.active = false;
    }
}
