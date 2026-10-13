import { _decorator, Component, EffectAsset, Material, Node, Sprite, Tween, UITransform, Vec4, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceSlot } from './PieceSlot';

const { ccclass, property } = _decorator;

/**
 * 一组槽位「全修完 **且** 各自动画也演完」（都抛过 `PIECE_SHOWN`）之后，把 `nodes` 里那几个节点
 * 用圆形扩散亮出来 —— 每个从**自己的中心**铺开，共用一条进度。
 *
 * 时机不是 `LEVEL_COMPLETE`，和 `SceneBgSwap` 同一套判断：那条事件在最后一格吸上那一刻就抛了，
 * 而它自己可能还有一整段收尾动作要演。等这一组每一格的 `PIECE_SHOWN` 都到齐再扩散。
 *
 * 槽位号从 `LEVEL_BUILT` 现算（`LevelFactory` 按 `pieceId` 排过序，不能写死 0..3）。
 * 本组件**不抛任何事件** —— 终局那条路（`END_SHOW` / 结束界面）仍然只归 `SceneBgSwap`。
 *
 * 挂在一个常驻节点上（`GameLayer/Scene_BG`，和 `SceneBgSwap` 并列）。
 */
@ccclass('GroupReveal')
export class GroupReveal extends Component {
    @property({ type: [PieceSlot], displayName: '这一组的槽位', tooltip: '这些槽位全部露面（PIECE_SHOWN）之后，下面的节点才亮出来' })
    slots: PieceSlot[] = [];

    @property({ type: [Node], displayName: '要亮出的节点', tooltip: '每个从自己的中心扩散出场，都要挂 Sprite' })
    nodes: Node[] = [];

    @property({ type: EffectAsset, displayName: '扩散材质', tooltip: '和圆形扩散 / 完成背景同一份 bg-reveal.effect' })
    revealEffect: EffectAsset = null;

    @property({ displayName: '扩散时长（秒）' })
    revealTime = 0.7;

    @property({ displayName: '羽化半宽（相对半径）', tooltip: '越大边越虚。0.35 约等于软边占半径的三分之一' })
    feather = 0.35;

    private _indexes: number[] = [];
    private _shown = 0;
    private _mats: Material[] = [];
    private _params: Vec4[] = [];
    private _state = { p: 0 };
    private _edge = new Vec4();

    protected onLoad(): void {
        for (const n of this.nodes) n.active = false;
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        if (this._mats.length) this.abort();
    }

    /** 这一组的槽位在关卡里的下标 —— `PieceSlot` 抛的 `PIECE_SHOWN` 带的是这个下标 */
    private onLevelBuilt(data: SlotData[]): void {
        this._indexes = data.filter((d) => this.slots.indexOf(d.slot) >= 0).map((d) => d.index);
        this._shown = 0;
    }

    private onShown(slotIndex: number): void {
        if (this._indexes.indexOf(slotIndex) < 0) return;
        if (++this._shown < this._indexes.length) return;
        this.reveal();
    }

    private reveal(): void {
        // 开关关掉 / 没配材质就直接亮出来 —— 这一组的节点照旧要出现，只是不演扩散
        if (!FeatureFlags.circleReveal || !this.revealEffect) {
            for (const n of this.nodes) n.active = true;
            return;
        }
        this._edge.set(this.feather, 0, 0, 0);
        for (const n of this.nodes) {
            n.active = true;
            // 圆心和跨度按节点自己的世界矩形手算（§14：`getBoundingBoxToWorld()` 会把活着的子节点一并进来）
            const ut = n.getComponent(UITransform);
            const scale = n.worldScale;
            const at = n.worldPosition;
            const w = ut.width * scale.x;
            const h = ut.height * scale.y;
            const params = new Vec4(
                at.x + (0.5 - ut.anchorX) * w,
                at.y + (0.5 - ut.anchorY) * h,
                0,
                1 / (Math.hypot(w, h) * 0.5),
            );
            const mat = new Material();
            mat.initialize({ effectAsset: this.revealEffect, defines: { USE_TEXTURE: true } });
            mat.setProperty('revealEdge', this._edge);
            mat.setProperty('revealParams', params);
            n.getComponent(Sprite).customMaterial = mat;
            this._mats.push(mat);
            this._params.push(params);
        }
        this._state.p = 0;
        this.paint();
        // 走到 1 只够实心部分盖住四角，软边那一段还得再走一个 feather（同圆形扩散 / 完成背景）
        tween(this._state)
            .to(this.revealTime, { p: 1 + this.feather }, { onUpdate: () => this.paint() })
            .call(() => this.abort())
            .start();
    }

    private paint(): void {
        for (let i = 0; i < this._params.length; i++) {
            this._params[i].z = this._state.p;
            this._mats[i].setProperty('revealParams', this._params[i]);
        }
    }

    /** 收摊。材质必须显式销毁：引擎只销毁 MaterialInstance，shared material 没人管（见 §14）。 */
    private abort(): void {
        Tween.stopAllByTarget(this._state);
        for (let i = 0; i < this._mats.length; i++) {
            this.nodes[i].getComponent(Sprite).customMaterial = null;
            this._mats[i].destroy();
        }
        this._mats.length = 0;
        this._params.length = 0;
    }
}
