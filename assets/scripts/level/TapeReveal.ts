import { _decorator, Component, Node, Sprite, Tween, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 一格的特殊表现：几条胶带依次从左到右刷出来，全部刷完再收起场上的东西，
 * 由调用方（`PieceSlot`）把这一格修复后的图放出来。
 *
 * 挂在槽位节点上，由 `PieceSlot.tapeReveal` 指过来 —— 没配的槽位完全不碰。
 *
 * 胶带的 Sprite 类型必须是 FILLED + HORIZONTAL：`fillRange` 0→1 就是「从左到右逐渐显现」，
 * 真裁剪不是拉伸。开演之前 `fillRange` 归 0 —— 编辑模式不跑生命周期，所以场景面板里
 * 它们照旧整条可见，方便摆位。
 */
@ccclass('TapeReveal')
export class TapeReveal extends Component {
    @property({ type: [Sprite], displayName: '胶带（数组顺序即揭晓顺序）' })
    tapes: Sprite[] = [];

    @property({ type: [Node], displayName: '揭晓结束后隐藏' })
    hideOnDone: Node[] = [];

    @property({ displayName: '开始前延迟（秒）', tooltip: '对齐扫光时长，默认 0.45' })
    startDelay = 0.45;

    @property({ displayName: '每条渐显时长（秒）' })
    revealTime = 0.25;

    @property({ displayName: '相邻胶带间隔（秒）' })
    gap = 0.12;

    @property({ displayName: '最后一条刷完后停顿（秒）' })
    endHold = 0.15;

    private _live: Tween<Sprite>[] = [];

    protected onLoad(): void {
        this.hideTapes();
    }

    /** 依次刷出所有胶带；全刷完之后收起 hideOnDone，再回调。
     *  第一条胶带真正开始刷的那一下抛 `TAPE_REVEAL` —— 是 `startDelay` 之后、不是吸附那一刻。 */
    play(onDone: () => void, slotIndex: number): void {
        for (const tw of this._live) tw.stop();
        this._live.length = 0;
        this.unscheduleAllCallbacks();
        this.hideTapes();

        this.scheduleOnce(() => EventBus.emit(GameEvent.TAPE_REVEAL, slotIndex), this.startDelay);

        let at = this.startDelay;
        let last = at;
        for (const tape of this.tapes) {
            this._live.push(
                tween(tape).delay(at).to(this.revealTime, { fillRange: 1 }, { easing: 'quadOut' }).start(),
            );
            last = at + this.revealTime;
            at += this.gap;
        }
        this.scheduleOnce(() => this.finish(onDone), last + this.endHold);
    }

    private hideTapes(): void {
        for (const tape of this.tapes) tape.fillRange = 0;
    }

    private finish(onDone: () => void): void {
        this._live.length = 0;
        for (const tape of this.tapes) tape.node.active = false;
        for (const n of this.hideOnDone) n.active = false;
        onDone();
    }

    protected onDisable(): void {
        for (const tw of this._live) tw.stop();
        this._live.length = 0;
        this.unscheduleAllCallbacks();
    }
}
