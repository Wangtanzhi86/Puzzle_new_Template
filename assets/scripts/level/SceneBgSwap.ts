import { _decorator, Component, EffectAsset, Material, Sprite, Tween, UITransform, Vec4, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';

const { ccclass, property } = _decorator;

/**
 * 全部修完之后，把拼图区背景换成「完成背景」—— 从中心长出一个圆、边缘羽化，向外扩散盖住原来的底图。
 * 挂在本节点（`GameLayer/Scene_BG`）自己身上。
 *
 * 扩散靠本节点下一个同尺寸的子节点（`revealView`，贴图就是完成背景那张）加 `bg-reveal.effect`：
 * 圈外它什么都不画，露出底下的底图；圈内画自己。扩散跑完把它的贴图挪到本节点上、把它收掉 ——
 * 最终画面就是一个节点、一张不透明的完成背景，不留一层常驻的透明覆盖。
 *
 * 走的时机不是 `LEVEL_COMPLETE`：最后一格吸上那一刻总修复就抛了，而胶带那格还要等胶带刷完
 * + 序列帧播完才露脸（demo 里两秒多）—— 背景先扩散就是「完成背景配着一块还没出现的缺口」。
 * 所以和总修复扫光同一套判断：等最后一格的 `PIECE_SHOWN` 到了再扩散。
 *
 * 扩散跑完（`finish()`）抛 `END_SHOW` —— 这就是「结束事件」：到这一刻底图才真的换完，
 * 结束界面可以亮出来了。
 */
@ccclass('SceneBgSwap')
export class SceneBgSwap extends Component {
    @property({ type: EffectAsset, displayName: '扩散材质' })
    revealEffect: EffectAsset = null;

    @property({ type: Sprite, displayName: '完成背景（扩散用）', tooltip: '本节点下的一个同尺寸子节点，贴图就是修完那张。扩散完它的贴图会挪到本节点上、自己被收掉' })
    revealView: Sprite = null;

    @property({ displayName: '扩散时长（秒）' })
    revealTime = 0.9;

    @property({ displayName: '羽化半宽（相对半径）', tooltip: '越大边越虚。0.35 约等于软边占半径的三分之一' })
    feather = 0.35;

    private _total = 0;
    private _shown = 0;
    private _mat: Material = null;
    private _state = { p: 0 };
    private _params = new Vec4();
    private _edge = new Vec4();

    protected onLoad(): void {
        if (this.revealView) this.revealView.node.active = false;
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        if (this._mat) this.abort();
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._total = data.length;
        this._shown = 0;
    }

    private onShown(): void {
        this._shown++;
        if (this._shown < this._total) return;
        this.reveal();
    }

    private reveal(): void {
        const view = this.revealView;
        if (!view || !this.revealEffect) {
            // 没配扩散材质就直接进结束界面：卡在这儿等于整条广告永远不出 CTA
            EventBus.emit(GameEvent.END_SHOW);
            return;
        }
        view.node.active = true;

        // 圆心和跨度按扩散节点自己的世界矩形手算（§14 那条：`getBoundingBoxToWorld()` 会把活着的
        // 子节点一并进来）。跨度取到四角。
        const ut = view.node.getComponent(UITransform);
        const scale = view.node.worldScale;
        const at = view.node.worldPosition;
        const w = ut.width * scale.x;
        const h = ut.height * scale.y;
        this._params.set(
            at.x + (0.5 - ut.anchorX) * w,
            at.y + (0.5 - ut.anchorY) * h,
            0,
            1 / (Math.hypot(w, h) * 0.5),
        );
        this._edge.set(this.feather, 0, 0, 0);

        const mat = new Material();
        mat.initialize({ effectAsset: this.revealEffect, defines: { USE_TEXTURE: true } });
        mat.setProperty('revealEdge', this._edge);
        view.customMaterial = mat;
        this._mat = mat;

        this._state.p = 0;
        this.paint();
        // 走到 1 只够实心部分盖住四角，软边那一段还得再走一个 feather —— 不然收尾时四个角
        // 会各留一点没铺满的渐隐
        tween(this._state)
            .to(this.revealTime, { p: 1 + this.feather }, { onUpdate: () => this.paint() })
            .call(() => this.finish())
            .start();
    }

    private paint(): void {
        this._params.z = this._state.p;
        this._mat.setProperty('revealParams', this._params);
    }

    private finish(): void {
        const view = this.revealView;
        this.getComponent(Sprite).spriteFrame = view.spriteFrame;
        this.abort();
        EventBus.emit(GameEvent.END_SHOW);
    }

    /** 收摊。材质必须显式销毁：引擎只销毁 MaterialInstance，shared material 没人管（见 §14）。 */
    private abort(): void {
        Tween.stopAllByTarget(this._state);
        this.revealView.customMaterial = null;
        this._mat.destroy();
        this._mat = null;
        this.revealView.node.active = false;
    }
}
