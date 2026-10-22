import { _decorator, Component, Node } from 'cc';
import { EDITOR } from 'cc/env';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceSlot } from '../level/PieceSlot';
import { TypewriterLabel } from './TypewriterLabel';

const { ccclass, property } = _decorator;

/**
 * 剧情气泡的先后顺序：
 *  - 第一个触发槽位修好（`PIECE_SHOWN`，即这一格整段揭晓演完）→ 气泡 1 打字 → 藏起来 → 气泡 2 打字 → 藏起来。
 *  - 第二个触发槽位修好 → 气泡 3 打字 → 藏起来。
 *
 * 槽位用场景节点拖进来，运行时按 `LEVEL_BUILT` 广播的槽位列表找到它的下标，
 * 和 `SlotSwap` 同一套接线，不依赖节点名。
 */
@ccclass('BubbleSequence')
export class BubbleSequence extends Component {
    @property({ type: TypewriterLabel, displayName: '气泡 1（第一段先出）' }) bubble1: TypewriterLabel = null;
    @property({ type: TypewriterLabel, displayName: '气泡 2（气泡 1 藏好后出）' }) bubble2: TypewriterLabel = null;
    @property({ type: TypewriterLabel, displayName: '气泡 3（第二段）' }) bubble3: TypewriterLabel = null;

    @property({ type: Node, displayName: '第一段触发槽位', tooltip: '这一格修复演完后，依次播气泡 1 → 气泡 2' })
    firstSlot: Node = null;

    @property({ type: Node, displayName: '第二段触发槽位', tooltip: '这一格修复演完后，播气泡 3' })
    secondSlot: Node = null;

    @property({ displayName: '触发后延迟（秒）' }) delay = 0;

    private _firstIndex = -1;
    private _secondIndex = -1;
    private _firstPlayed = false;
    private _secondPlayed = false;
    private _guideHolds = 0;

    protected onEnable (): void {
        // 编辑器里保持作者摆好的 active = true，方便看位置；运行时进关前先收掉，避免选关 / 开场露出来。
        if (!EDITOR) this.hideAll();
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
    }

    protected onDisable (): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        this.unscheduleAllCallbacks();
        this.releaseAllGuide();
    }

    private onLevelBuilt (data: SlotData[]): void {
        this._firstPlayed = false;
        this._secondPlayed = false;
        this.releaseAllGuide();
        this.hideAll();
        this._firstIndex = this.indexOf(data, this.firstSlot);
        this._secondIndex = this.indexOf(data, this.secondSlot);
        this.setSecondBrokenVisible(true);
    }

    private onShown (slotIndex: number): void {
        if (slotIndex === this._firstIndex && !this._firstPlayed) {
            if (!this.bubble1) return;
            this._firstPlayed = true;
            this.holdGuide();
            this.scheduleOnce(this.playFirstPair, this.delay);
        } else if (slotIndex === this._secondIndex && !this._secondPlayed) {
            if (!this.bubble3) return;
            this._secondPlayed = true;
            this.holdGuide();
            this.scheduleOnce(this.playSecond, this.delay);
        }
    }

    private playFirstPair = (): void => {
        if (!this.bubble1) {
            this.releaseGuide();
            return;
        }
        EventBus.emit(GameEvent.BUBBLE_SHOW, 1);
        this.bubble1.play(() => {
            this.bubble1.hide(() => {
                if (!this.bubble2) {
                    this.releaseGuide();
                    return;
                }
                this.setSecondBrokenVisible(false);
                EventBus.emit(GameEvent.BUBBLE_SHOW, 2);
                this.bubble2.play(() => this.bubble2.hide(() => {
                    this.setSecondBrokenVisible(true);
                    this.releaseGuide();
                }));
            });
        });
    };

    private playSecond = (): void => {
        if (!this.bubble3) {
            this.releaseGuide();
            return;
        }
        EventBus.emit(GameEvent.BUBBLE_SHOW, 3);
        this.bubble3.play(() => this.bubble3.hide(() => this.releaseGuide()));
    };

    /** 整段对话期间按住空闲引导与拖动：不让引导扫出第二格白线，也不让玩家拿走下一块。 */
    private holdGuide (): void {
        this._guideHolds++;
        EventBus.emit(GameEvent.GUIDE_HOLD);
        EventBus.emit(GameEvent.DRAG_HOLD);
    }

    private releaseGuide (): void {
        if (this._guideHolds <= 0) return;
        this._guideHolds--;
        EventBus.emit(GameEvent.GUIDE_RESUME);
        EventBus.emit(GameEvent.DRAG_UNLOCK);
    }

    private releaseAllGuide (): void {
        while (this._guideHolds > 0) this.releaseGuide();
    }

    /** 气泡 2 起播前把第二触发槽位的破损图（Slot_04 的白线）收起来；气泡 2 藏好、且这格还没修好再放出来。 */
    private setSecondBrokenVisible (visible: boolean): void {
        const slot = this.secondSlot ? this.secondSlot.getComponent(PieceSlot) : null;
        if (!slot || !slot.brokenView) return;
        if (visible && (slot.repaired || slot.prefilled)) return;
        slot.brokenView.node.active = visible;
    }

    private hideAll (): void {
        for (const bubble of [this.bubble1, this.bubble2, this.bubble3]) {
            if (bubble) bubble.node.active = false;
        }
    }

    private indexOf (data: SlotData[], slot: Node): number {
        if (!slot) return -1;
        for (let i = 0; i < data.length; i++) {
            if (data[i].node === slot) return i;
        }
        return -1;
    }
}
