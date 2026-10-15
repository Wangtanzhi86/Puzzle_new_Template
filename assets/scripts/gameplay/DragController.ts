import { _decorator, Component, EventTouch, Node, NodeEventType, tween, v3, Vec2, UITransform } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { PieceEntry, PiecePool } from './PiecePool';

const { ccclass, property } = _decorator;

/**
 * 触摸 → 碎片跟手 → 松手判定。吸附判定不在这里，交给 SnapSystem。
 *
 * 监听挂在碎片池的 content 节点上，不是全局 input：碎片躺在 ScrollView 里，
 * ScrollView 的节点处理器会先把触摸吞掉，于是 PointerEventDispatcher 返回 false，
 * 全局 input 的监听器一个都收不到。content 比 ScrollView 深，排序靠前抢得到触摸；
 * 拿起后碎片被挪到 dragRoot，但触摸已被 content 认领，MOVE / END 照常派发。
 */
@ccclass('DragController')
export class DragController extends Component {
    @property({ type: PiecePool, displayName: '碎片池' }) pool: PiecePool = null;

    @property({ displayName: '拿起放大时长（秒）' }) pickScaleTime = 0.12;

    private _entry: PieceEntry = null;
    private _guided = false;

    protected onEnable(): void {
        const content = this.pool.content;
        content.on(NodeEventType.TOUCH_START, this.onStart, this);
        content.on(NodeEventType.TOUCH_MOVE, this.onMove, this);
        content.on(NodeEventType.TOUCH_END, this.onEnd, this);
        content.on(NodeEventType.TOUCH_CANCEL, this.onEnd, this);
        EventBus.on(GameEvent.PIECE_SNAP_SUCCESS, this.onSnapSuccess, this);
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        EventBus.on(GameEvent.GAME_OVER, this.takeOver, this);
        EventBus.on(GameEvent.AUTO_PLAY, this.takeOver, this);
    }

    protected onDisable(): void {
        this.unbindContent();
        EventBus.off(GameEvent.PIECE_SNAP_SUCCESS, this.onSnapSuccess, this);
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        EventBus.off(GameEvent.GAME_OVER, this.takeOver, this);
        EventBus.off(GameEvent.AUTO_PLAY, this.takeOver, this);
    }

    /** 摘掉 `content` 上的触摸监听。最后一个监听被移除时引擎会把整个节点处理器移出派发表，
     *  这一格这才不再「认领」落在池子上的触摸 —— 终局后那些点击要留给全局 `input`（`EndgameCta`）。 */
    private unbindContent(): void {
        const content = this.pool.content;
        content.off(NodeEventType.TOUCH_START, this.onStart, this);
        content.off(NodeEventType.TOUCH_MOVE, this.onMove, this);
        content.off(NodeEventType.TOUCH_END, this.onEnd, this);
        content.off(NodeEventType.TOUCH_CANCEL, this.onEnd, this);
    }

    get holding(): boolean {
        return !!this._entry;
    }

    private onStart(e: EventTouch): void {
        if (this._entry) return;
        const at = e.getUILocation();
        const entry = this.pick(at);
        if (!entry) return;

        this._entry = entry;
        this.pool.takeOut(entry);
        this.pool.lockScroll();

        const piece = entry.piece;
        const scale = this.pool.carryScaleOf(entry);
        tween(piece).to(this.pickScaleTime, { scale: v3(scale, scale, 1) }, { easing: 'quadOut' }).start();
        piece.setWorldPosition(at.x, at.y, 0);

        EventBus.emit(GameEvent.PIECE_PICK, piece);
    }

    private onMove(e: EventTouch): void {
        if (!this._entry) return;
        const at = e.getUILocation();
        const piece = this._entry.piece;
        piece.setWorldPosition(at.x, at.y, 0);
        EventBus.emit(GameEvent.PIECE_DRAG, piece, piece.worldPosition, this._entry.slotIndex);
    }

    private onEnd(): void {
        if (!this._entry) return;
        const entry = this._entry;
        this.release();
        this.pool.sendHome(entry, false);
        EventBus.emit(GameEvent.PIECE_SNAP_FAIL, entry.piece);
        this.markGuided();
    }

    private onSnapSuccess(piece: Node, _slotIndex: number): void {
        if (!this._entry || this._entry.piece !== piece) return;
        const entry = this._entry;
        this.release();
        this.pool.consume(entry);
        this.markGuided();
    }

    private onOrientation(): void {
        if (this._entry) {
            const entry = this._entry;
            this.release();
            this.pool.sendHome(entry, true);
        }
    }

    /** 收工：终局（`GAME_OVER`）或系统接管（`AUTO_PLAY`），拖拽都到此为止。
     *  监听已经摘了，手上那块就得自己放回去（不走 `release()`，
     *  免得把 `PiecePool` 刚锁上的滚动又解回来 —— 两条监听谁先跑不由这里决定）。
     *  放回去的这块正是 `AutoPlayer` 接下来第一个要飞的（它排在池子最前面）。 */
    private takeOver(): void {
        this.unbindContent();
        if (!this._entry) return;
        const entry = this._entry;
        this._entry = null;
        this.pool.sendHome(entry, true);
    }

    private release(): void {
        this._entry = null;
        this.pool.unlockScroll();
    }

    private markGuided(): void {
        if (this._guided) return;
        this._guided = true;
        EventBus.emit(GameEvent.GUIDE_HIDE);
    }

    private pick(at: Vec2): PieceEntry {
        const entries = this.pool.entries;
        for (let i = entries.length - 1; i >= 0; i--) {
            const ut = entries[i].piece.getComponent(UITransform);
            if (ut.getBoundingBoxToWorld().contains(at)) return entries[i];
        }
        return null;
    }

}
