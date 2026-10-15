import { _decorator, Color, Component, EffectAsset, Material, Node, Sprite, Tween, UITransform, Vec4, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { RepairedSlot } from '../level/RepairedSlot';

const { ccclass, property } = _decorator;

/** 扫描方向：45°，左下 → 右上。改方向只改这两个数，effect 里的坐标约定跟着它走。 */
const AXIS_X = 0.7071067811865476;
const AXIS_Y = 0.7071067811865476;

interface SweepConfig {
    time: number;
    band: number;
    flash: number;
}

interface SweepHandle {
    node: Node;
    mat: Material;
    state: { p: number };
}

/**
 * 修复后的一道斜向扫光。挂在 EffectLayer 上，和 TrailEmitter 并列。
 *
 * 扫光节点是运行时建在「修复后的图」下面的（§3 允许代码生成特效实例）：同尺寸、同
 * spriteFrame，所以不用算坐标，光带和图天然对齐；贴图 alpha 顺便当裁剪，透明区不漏光。
 *
 * 单块修复扫该槽位自己的框；全部修完扫所有槽位的并集 —— 大家共用同一条世界坐标扫描轴、
 * 一起走同一个进度，读起来是一道光横扫全场，而不是 N 个各自闪一下。
 *
 * 两个触发点都挂在 `PIECE_SHOWN`（修复图真的露出来的那一下）上，不是吸附成功那一下 ——
 * 胶带那格吸附完还要等整段序列才露脸，扫光得跟着脸走。
 */
@ccclass('RepairSweep')
export class RepairSweep extends Component {
    @property({ type: EffectAsset, displayName: '扫光材质' }) sweepEffect: EffectAsset = null;

    @property({ type: Color, displayName: '光带颜色', tooltip: 'alpha 就是光带峰值强度' })
    sweepColor = new Color(255, 255, 255, 204);

    @property({ displayName: '单块：时长（秒）' })
    repairTime = 0.45;

    @property({ displayName: '单块：光带半宽比', tooltip: '相对本次扫描跨度 —— 单块扫它自己的框' })
    repairBand = 0.18;

    @property({ displayName: '单块：补光强度' })
    repairFlash = 0.16;

    @property({ displayName: '总修复：开演前定格（秒）', tooltip: '最后一格露面之后先静这么久再扫 —— 留一口白，那道光才像收尾而不是又一次反馈。⚠️ 它和 `SceneBgSwap` 的「开演前等待」是一对：那边要 ≥ 本值 + 时长' })
    completeDelay = 0.5;

    @property({ displayName: '总修复：时长（秒）' })
    completeTime = 0.9;

    @property({ displayName: '总修复：光带半宽比', tooltip: '相对本次扫描跨度 —— 总修复扫所有槽位的并集' })
    completeBand = 0.26;

    @property({ displayName: '总修复：补光强度' })
    completeFlash = 0.3;

    private _data: SlotData[] = [];
    /** 已经露过面的槽位数。普通槽位等于吸附数，胶带那格会晚一步（见 onShown） */
    private _shown = 0;
    private _completeDue = false;
    private _live = new Map<Node, SweepHandle>();
    private _color = new Vec4(1, 1, 1, 0.8);
    private _axis = new Vec4();
    private _params = new Vec4();

    private get single(): SweepConfig {
        return { time: this.repairTime, band: this.repairBand, flash: this.repairFlash };
    }

    private get complete(): SweepConfig {
        return { time: this.completeTime, band: this.completeBand, flash: this.completeFlash };
    }

    protected onLoad(): void {
        const c = this.sweepColor;
        this._color.set(c.r / 255, c.g / 255, c.b / 255, c.a / 255);
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
        EventBus.on(GameEvent.LEVEL_COMPLETE, this.onComplete, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        EventBus.off(GameEvent.LEVEL_COMPLETE, this.onComplete, this);
        this.unschedule(this.startComplete);
        for (const parent of Array.from(this._live.keys())) this.stop(parent);
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._data = data;
        this._shown = 0;
        this._completeDue = false;
    }

    /** 跟着「修复图露面」扫，不跟「吸附成功」—— 胶带那格吸附完还要 1.36s 才露脸 */
    private onShown(slotIndex: number): void {
        this._shown++;
        if (FeatureFlags.sweepOnRepair) {
            const view = this._data[slotIndex].slot.showView;
            if (view) this.sweep([view], this.single);
        }
        if (this._completeDue && this._shown >= this._data.length) {
            this._completeDue = false;
            this.runComplete();
        }
    }

    /** 还有槽位没露脸（胶带那格）就攒着，等它露面时 onShown 再补 —— 总修复的光不该扫在空处 */
    private onComplete(): void {
        if (this._shown < this._data.length) {
            this._completeDue = true;
            return;
        }
        this.runComplete();
    }

    private runComplete(): void {
        if (!FeatureFlags.sweepOnComplete) return;
        if (this.completeDelay > 0) this.scheduleOnce(this.startComplete, this.completeDelay);
        else this.startComplete();
    }

    private startComplete = (): void => {
        const views: RepairedSlot[] = [];
        for (const d of this._data) {
            if (d.slot.showView) views.push(d.slot.showView);
        }
        this.sweep(views, this.complete);
    };

    private sweep(views: RepairedSlot[], cfg: SweepConfig): void {
        if (!views.length) return;
        const axis = this.axisOf(views);
        for (const v of views) this.run(v, axis, cfg);
    }

    /** 把各槽位的世界包围盒投影到扫描轴上取 min/max，归一化成 0..1 供 shader 用 */
    private axisOf(views: RepairedSlot[]): Vec4 {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const v of views) {
            const box = v.node.getComponent(UITransform).getBoundingBoxToWorld();
            minX = Math.min(minX, box.x);
            minY = Math.min(minY, box.y);
            maxX = Math.max(maxX, box.x + box.width);
            maxY = Math.max(maxY, box.y + box.height);
        }
        // 方向分量都为正，投影的最小/最大就在这两个角上，不用试四个角
        const from = minX * AXIS_X + minY * AXIS_Y;
        return this._axis.set(AXIS_X, AXIS_Y, from, 1 / (maxX * AXIS_X + maxY * AXIS_Y - from));
    }

    private run(view: RepairedSlot, axis: Vec4, cfg: SweepConfig): void {
        const parent = view.node;
        // 同一张图上已经有一道在扫就先拆掉：最后一块露脸时 PIECE_SHOWN 和那一发的总修复扫光
        // 是同一个 tick 连着来的，两次扫光必然落在同一个节点上（单槽位关卡每次都会撞）。
        this.stop(parent);

        const mat = new Material();
        mat.initialize({ effectAsset: this.sweepEffect, defines: { USE_TEXTURE: true } });
        mat.setProperty('sweepColor', this._color);
        mat.setProperty('sweepAxis', axis);

        // 尺寸和贴图都照抄父节点那个 Sprite：同尺寸 + 同 frame，assembler 算出的 quad 一模一样。
        // 不用 RepairedSlot.frame —— 它读的是 onLoad 里缓存的 _view，取图时机多绕一层，
        // 而且一旦拿不到 frame，子 Sprite 没有贴图，引擎会直接跳过不画（静默失败）。
        const parentSprite = parent.getComponent(Sprite);
        const size = parent.getComponent(UITransform).contentSize;
        const node = new Node('Sweep');
        node.setParent(parent);
        node.addComponent(UITransform).setContentSize(size.width, size.height);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = parentSprite.spriteFrame;
        sprite.customMaterial = mat;

        const handle: SweepHandle = { node, mat, state: { p: 0 } };
        this._live.set(parent, handle);
        this.paint(handle, cfg, 0);
        tween(handle.state)
            .to(cfg.time, { p: 1 }, { onUpdate: (_t, ratio) => this.paint(handle, cfg, ratio ?? 0) })
            .call(() => this.stop(parent))
            .start();
    }

    private paint(handle: SweepHandle, cfg: SweepConfig, linear: number): void {
        // 缓动自己算：linear tween + 手算 quadOut，不指望引擎把缓动后的值传进来
        const e = 1 - (1 - linear) * (1 - linear);
        handle.mat.setProperty('sweepParams', this._params.set(
            -cfg.band + e * (1 + cfg.band * 2),
            cfg.band,
            Math.sin(linear * Math.PI) * cfg.flash,
            0,
        ));
    }

    /** 收摊。材质必须显式销毁：引擎只销毁 MaterialInstance，shared material 没人管。 */
    private stop(parent: Node): void {
        const handle = this._live.get(parent);
        if (!handle) return;
        this._live.delete(parent);
        Tween.stopAllByTarget(handle.state);
        handle.node.getComponent(Sprite).customMaterial = null;
        handle.mat.destroy();
        // destroy() 要等帧末才落地，先摘出去，免得这一帧里它顶着默认材质把图又画一遍
        handle.node.removeFromParent();
        handle.node.destroy();
    }
}
