import { _decorator, Component, Node, Tween, UIOpacity, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceSlot } from '../level/PieceSlot';

const { ccclass, property } = _decorator;

/**
 * 某一格修好之后，把一组节点平滑换成另一组（交叉淡入淡出）。
 *
 * 两个用法：
 * - **填了「触发槽位」**：那一格修好（PIECE_REPAIRED）时切换。局开局预填的那格补发事件时也会触发。
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

    @property({ displayName: '延迟（秒）' })
    delay = 0;

    @property({ displayName: '过渡时长（秒）', tooltip: '0 = 硬切' })
    fadeTime = 0.35;

    @property({ displayName: '淡入时轻轻放大', tooltip: '从 1.04 收到 1，给换图一点「贴上去」的手感' })
    pop = true;

    private _index = -1;
    private _played = false;

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
    }

    private onLevelBuilt(data: SlotData[]): void {
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
        if (this._played || slotIndex !== this._index) return;
        this.play();
    }

    private play(): void {
        if (this._played) return;
        this._played = true;
        if (this.delay > 0) this.scheduleOnce(this.swap, this.delay);
        else this.swap();
    }

    private swap = (): void => {
        const fade = this.fadeTime;
        for (const n of this.showNodes) {
            if (!n) continue;
            n.active = true;
            const op = this.opacityOf(n);
            op.opacity = 255;
            if (fade <= 0) continue;
            Tween.stopAllByTarget(op);
            op.opacity = 0;
            tween(op).to(fade, { opacity: 255 }, { easing: 'quadOut' }).start();
            if (this.pop) {
                const to = n.scale.clone();
                n.setScale(to.x * 1.04, to.y * 1.04, to.z);
                Tween.stopAllByTarget(n);
                tween(n).to(fade, { scale: to }, { easing: 'quadOut' }).start();
            }
        }
        for (const n of this.hideNodes) {
            if (!n) continue;
            const op = this.opacityOf(n);
            Tween.stopAllByTarget(op);
            if (fade <= 0) {
                n.active = false;
                op.opacity = 255;
                continue;
            }
            tween(op)
                .to(fade, { opacity: 0 }, { easing: 'quadIn' })
                .call(() => {
                    n.active = false;
                    op.opacity = 255;
                })
                .start();
        }
    };

    private opacityOf(n: Node): UIOpacity {
        return n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
    }
}
