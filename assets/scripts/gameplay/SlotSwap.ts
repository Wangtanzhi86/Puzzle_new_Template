import { _decorator, Component, Node, Tween, UIOpacity, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceSlot } from '../level/PieceSlot';
import { FeatureFlags } from '../config/FeatureFlags';

const { ccclass, property } = _decorator;

/**
 * 某一格修好之后，把一组节点平滑换成另一组（交叉淡入淡出）。
 *
 * 三个用法：
 * - **填了「触发槽位」**：那一格修好（PIECE_REPAIRED）时切换。
 * - **填了「触发槽位」+ 勾了「等揭晓播完」**：等那一格的修复动画整个演完（PIECE_SHOWN）再切。
 * - **填了「等气泡」**：等 BUBBLE_SHOW 对应序号出现时切换（例如气泡 1 淡出、气泡 2 出现的同一刻）。
 * - **留空**：关卡一建好（LEVEL_BUILT）就切换 —— 开场演出用（比如露一下女主紧张表情）。
 *
 * 只碰填进来的节点的 active / UIOpacity / scale，不认层级、不认名字，所以槽位换图和换人都能用。
 */
@ccclass('SlotSwap')
export class SlotSwap extends Component {
    @property({ type: PieceSlot, displayName: '触发槽位', tooltip: '这一格修好时切换。留空 = 关卡建好后立刻切换（开场演出）' })
    watch: PieceSlot = null;

    @property({ type: [Node], displayName: '淡出的节点', tooltip: '过渡结束后隐藏' })
    hideNodes: Node[] = [];

    @property({ type: [Node], displayName: '淡入的节点', tooltip: '过渡开始时亮出来，从透明淡到不透明' })
    showNodes: Node[] = [];

    @property({ displayName: '等揭晓播完再切', tooltip: '勾上：等触发槽位的修复动画整段演完（PIECE_SHOWN）才切换，上面「延迟」照旧从那一刻起算' })
    waitShown = false;

    @property({ displayName: '等气泡几出现后切（0 = 不用）', tooltip: '填 2 表示气泡 2 开始出现时切换；填了以后忽略触发槽位和「等揭晓播完」，延迟照旧' })
    waitBubble = 0;

    @property({ displayName: '延迟（秒）' })
    delay = 0;

    @property({ displayName: '过渡时长（秒）', tooltip: '0 = 硬切' })
    fadeTime = 0.35;

    @property({ displayName: '淡入时轻轻放大', tooltip: '从 1.04 收到 1，给换图一点「贴上去」的手感' })
    pop = true;

    @property({ displayName: '来回切换次数', tooltip: '新旧两套先来回交叉淡入几次，再固定到新状态。0 = 只做一次普通交叉淡入' })
    alternateFlips = 4;

    @property({ displayName: '第一次切换时长（秒）', tooltip: '之后每次乘以「每次变慢倍率」' })
    alternateFirst = 0.1;

    @property({ displayName: '每次变慢倍率', tooltip: '大于 1：后一次比前一次慢，形成「频率变慢」' })
    alternateGrow = 1.5;

    private _index = -1;
    private _played = false;

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
        EventBus.on(GameEvent.BUBBLE_SHOW, this.onBubbleShow, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        EventBus.off(GameEvent.BUBBLE_SHOW, this.onBubbleShow, this);
    }

    private onLevelBuilt(data: SlotData[]): void {
        if (this.waitBubble > 0) return;
        if (!this.watch) {
            this.play();
            return;
        }
        for (let i = 0; i < data.length; i++) {
            if (data[i].slot === this.watch) {
                this._index = i;
                return;
            }
        }
    }

    private onRepaired(slotIndex: number): void {
        if (this.waitBubble > 0 || this.waitShown || this._played || slotIndex !== this._index) return;
        this.play();
    }

    private onShown(slotIndex: number): void {
        if (this.waitBubble > 0 || !this.waitShown || this._played || slotIndex !== this._index) return;
        this.play();
    }

    private onBubbleShow(index: number): void {
        if (this.waitBubble <= 0 || this._played || index !== this.waitBubble) return;
        this.play();
    }

    private play(): void {
        if (this._played) return;
        this._played = true;
        if (this.delay > 0) this.scheduleOnce(this.swap, this.delay);
        else this.swap();
    }

    private swap = (): void => {
        const show = this.showNodes.filter((n) => !!n);
        const hide = this.hideNodes.filter((n) => !!n);
        if (this.fadeTime > 0 && FeatureFlags.swapAlternate && show.length > 0 && hide.length > 0) {
            this.alternate(show, hide);
            return;
        }

        for (const n of show) {
            n.active = true;
            const op = this.opacityOf(n);
            op.opacity = 255;
            if (this.fadeTime <= 0) continue;
            Tween.stopAllByTarget(op);
            op.opacity = 0;
            tween(op).to(this.fadeTime, { opacity: 255 }, { easing: 'quadOut' }).start();
            if (this.pop) this.popIn(n, this.fadeTime);
        }
        for (const n of hide) {
            const op = this.opacityOf(n);
            Tween.stopAllByTarget(op);
            if (this.fadeTime <= 0) {
                n.active = false;
                op.opacity = 255;
                continue;
            }
            tween(op)
                .to(this.fadeTime, { opacity: 0 }, { easing: 'quadIn' })
                .call(() => {
                    n.active = false;
                    op.opacity = 255;
                })
                .start();
        }
    };

    /** 新旧两套来回交叉淡入，间隔逐次拉长，最后一次落定到 show */
    private alternate(show: Node[], hide: Node[]): void {
        for (const n of show) {
            n.active = true;
            this.opacityOf(n).opacity = 0;
        }
        for (const n of hide) {
            n.active = true;
            this.opacityOf(n).opacity = 255;
        }

        let at = 0;
        let duration = this.alternateFirst;
        let toShow = true;
        let lastShown = false;
        for (let i = 0; i < this.alternateFlips; i++) {
            const d = duration;
            const visible = toShow;
            this.scheduleOnce(() => this.mix(show, hide, visible, d), at);
            at += d;
            lastShown = visible;
            toShow = !toShow;
            duration *= this.alternateGrow;
        }
        if (!lastShown) {
            this.scheduleOnce(() => this.mix(show, hide, true, this.fadeTime), at);
            at += this.fadeTime;
        }
        this.scheduleOnce(() => this.settle(show, hide), at);
    }

    private mix(show: Node[], hide: Node[], visible: boolean, duration: number): void {
        for (const n of show) this.fadeTo(n, visible ? 255 : 0, duration);
        for (const n of hide) this.fadeTo(n, visible ? 0 : 255, duration);
    }

    private fadeTo(n: Node, value: number, duration: number): void {
        const op = this.opacityOf(n);
        Tween.stopAllByTarget(op);
        tween(op).to(duration, { opacity: value }, { easing: 'sineInOut' }).start();
    }

    private settle(show: Node[], hide: Node[]): void {
        for (const n of hide) {
            this.opacityOf(n).opacity = 255;
            n.active = false;
        }
        for (const n of show) {
            this.opacityOf(n).opacity = 255;
            n.active = true;
            if (this.pop) this.popIn(n, this.fadeTime);
        }
    }

    private popIn(n: Node, duration: number): void {
        const to = n.scale.clone();
        n.setScale(to.x * 1.04, to.y * 1.04, to.z);
        Tween.stopAllByTarget(n);
        tween(n).to(duration, { scale: to }, { easing: 'quadOut' }).start();
    }

    private opacityOf(n: Node): UIOpacity {
        return n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
    }
}
