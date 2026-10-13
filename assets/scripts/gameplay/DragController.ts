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
 *
 * **一格在演修复动画时不许再拿起别的碎片**：`PieceSlot` 那一对 `GUIDE_HOLD` / `GUIDE_RESUME`
 * 正好框住这一格从吸附到整段表现演完（揭晓 + 收尾动作），拿它当闸用 —— 不另加事件。
 */
@ccclass('DragController')
export class DragController extends Component {
    @property({ type: PiecePool, displayName: '碎片池' }) pool: PiecePool = null;

    @property({ displayName: '拿起放大时长（秒）' }) pickScaleTime = 0.12;

    private _entry: PieceEntry = null;
    private _guided = false;
    /** 正在演修复动画的格数（一格一个来回）。> 0 时碎片池锁着 —— 上一块的表现没演完，谁都不许再拿 */
    private _holds = 0;

    protected onEnable(): void {
        const content = this.pool.content;
        content.on(NodeEventType.TOUCH_START, this.onStart, this);
        content.on(NodeEventType.TOUCH_MOVE, this.onMove, this);
        content.on(NodeEventType.TOUCH_END, this.onEnd, this);
        content.on(NodeEventType.TOUCH_CANCEL, this.onEnd, this);
        EventBus.on(GameEvent.PIECE_SNAP_SUCCESS, this.onSnapSuccess, this);
        EventBus.on(GameEvent.GUIDE_HOLD, this.onHold, this);
        EventBus.on(GameEvent.GUIDE_RESUME, this.onResume, this);
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        EventBus.on(GameEvent.GAME_OVER, this.onGameOver, this);
    }

    protected onDisable(): void {
        this.unbindContent();
        EventBus.off(GameEvent.PIECE_SNAP_SUCCESS, this.onSnapSuccess, this);
        EventBus.off(GameEvent.GUIDE_HOLD, this.onHold, this);
        EventBus.off(GameEvent.GUIDE_RESUME, this.onResume, this);
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        EventBus.off(GameEvent.GAME_OVER, this.onGameOver, this);
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
        if (this._entry || this._holds > 0) return;
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

    /** 某格开演（吸附当刻，在揭晓之前）：锁住碎片池 */
    private onHold(): void {
        this._holds++;
    }

    /** 这一格整段演完（`PIECE_SHOWN` 同一刻）：放行 */
    private onResume(): void {
        if (this._holds > 0) this._holds--;
    }

    private onOrientation(): void {
        if (this._entry) {
            const entry = this._entry;
            this.release();
            this.pool.sendHome(entry, true);
        }
    }

    /** 终局：拖拽到此为止。监听已经摘了，手上那块就得自己放回去（不走 `release()`，
     *  免得把 `PiecePool` 刚锁上的滚动又解回来 —— 两条监听谁先跑不由这里决定）。 */
    private onGameOver(): void {
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
