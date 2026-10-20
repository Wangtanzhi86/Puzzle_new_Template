import { _decorator, Component, Node, Sprite, Tween, UIOpacity, UITransform, v3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceSlot } from '../level/PieceSlot';

const { ccclass, property } = _decorator;

/**
 * 预填槽位的「补演」：开场（`GAME_START`）之后，把已预填的那格先退回破损态，
 * 再让一块碎片从池子的位置飞进缺口，落到中心才走这一格的揭晓（金色烟花 + 圆形扩散）。
 *
 * 为什么不在 `LEVEL_BUILT` 当场演：那会儿 `IntroLayer` 还盖着整屏，演了也没人看见。
 * 为什么由这一份组件统一管：碎片要在 `EffectLayer` 里飞（不能被拼图框的 Mask 裁掉），
 * 而 `PieceSlot` 不持有层引用；槽位只负责「退回破损态 / 开演 / 演完发事件」。
 *
 * 挂在 `EffectLayer` 上，全局一个实例。`from` 建议拖 `PiecePoolLayer`。
 */
@ccclass('PrefillFlight')
export class PrefillFlight extends Component {
    @property({ type: Node, displayName: '起飞位置', tooltip: '碎片从这里飞向缺口，一般拖碎片池；留空 = 从缺口正下方起飞' })
    from: Node = null;

    @property({ displayName: '开场延迟（秒）', tooltip: '`GAME_START` 之后等这么久再起飞，让开场收尾先落定' })
    delay = 0.15;

    @property({ displayName: '飞行时长（秒）' })
    flyTime = 0.55;

    @property({ displayName: '多格错开（秒）', tooltip: '同时有多个预填槽位时，一块接一块起飞' })
    stagger = 0.2;

    @property({ displayName: '起飞淡入（秒）' })
    fadeTime = 0.12;

    private _data: SlotData[] = [];
    private _started = false;
    private _ghosts: Node[] = [];

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.GAME_START, this.onGameStart, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.GAME_START, this.onGameStart, this);
        this.unscheduleAllCallbacks();
        for (const node of this._ghosts) this.destroyGhost(node);
        this._ghosts.length = 0;
        this._started = false;
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._data = data;
        this._started = false;
    }

    private onGameStart(): void {
        if (this._started) return;
        this._started = true;
        let at = this.delay;
        for (const d of this._data) {
            if (!d.slot.prefilled) continue;
            const slot = d.slot;
            // 先同步退回破损态：GameIntro.finish 是「藏掉开场层 → 立刻发 GAME_START」，
            // 这一句必须赶在同一帧渲染前跑完，否则玩家先看到修好的图再看到它碎回去
            slot.resetPrefill();
            this.scheduleOnce(() => this.fly(slot), at);
            at += this.stagger;
        }
    }

    private fly(slot: PieceSlot): void {
        const frame = slot.pieceFrame;
        if (!frame) {
            slot.playPrefill();
            return;
        }
        const node = new Node('PrefillGhost');
        const ut = node.addComponent(UITransform);
        const k = Math.min(1, 200 / Math.max(frame.rect.width, frame.rect.height));
        const w = frame.rect.width * k;
        const h = frame.rect.height * k;
        ut.setContentSize(w, h);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        const op = node.addComponent(UIOpacity);
        op.opacity = 0;
        this.node.addChild(node);
        this._ghosts.push(node);

        const to = slot.worldCenter;
        const from = this.from ? this.from.worldPosition : v3(to.x, -h, 0);
        node.setWorldPosition(from);
        const end = slot.carryHeight / h;

        tween(op).to(this.fadeTime, { opacity: 255 }).start();
        tween(node)
            .to(this.flyTime, { worldPosition: v3(to.x, to.y, 0), scale: v3(end, end, 1) }, { easing: 'quadIn' })
            .call(() => {
                this.destroyGhost(node);
                slot.playPrefill();
            })
            .start();
    }

    private destroyGhost(node: Node): void {
        const i = this._ghosts.indexOf(node);
        if (i >= 0) this._ghosts.splice(i, 1);
        Tween.stopAllByTarget(node);
        const op = node.getComponent(UIOpacity);
        if (op) Tween.stopAllByTarget(op);
        if (node.isValid) node.destroy();
    }
}
