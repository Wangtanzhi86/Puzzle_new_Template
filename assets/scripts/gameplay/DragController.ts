import { _decorator, Component, EventTouch, Node, NodeEventType, Tween, tween, v3, Vec2, Vec3, UITransform } from 'cc';
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
 * 跟手是**两段**的（对齐 CopyPuzzle `PuzzleItem`）：
 * 1. 按下 → 只记「按下那一刻手指在哪、碎片在哪」，碎片原地不动（放大照旧演）。
 * 2. 手指移动超过 `moveStartDistance` → 起拖。位置不是直接贴到手指上，而是先用
 *    `catchTime` 把碎片从原地**追**到「按下时的碎片位置 + 手指位移」（linear）——
 *    这样按下的瞬间不跳、起拖的瞬间也不瞬移。补间期间只更新终点，位置由插值算；
 *    补间跑完才是 1:1 跟手。
 *
 * 用「相对跟手」而不是「绝对跟手」（碎片世界坐标 = 手指 UI 坐标），原版就是这么做的：
 * 碎片和指肚之间始终隔着按下时那点距离，玩家抓哪儿就是哪儿。
 */
@ccclass('DragController')
export class DragController extends Component {
    @property({ type: PiecePool, displayName: '碎片池' }) pool: PiecePool = null;

    @property({ displayName: '拿起放大时长（秒）' }) pickScaleTime = 0.14;

    @property({ displayName: '起拖判定距离（px）', tooltip: '手指移动超过这个距离才开始拖（原版 20px @414 宽，本工程 720 宽折合 35）。0 = 按下即跟手。⚠️ 原版只判向上位移（托盘在屏幕下方），本工程横屏时托盘会跑到侧面，所以这里按总位移判' })
    moveStartDistance = 35;

    @property({ displayName: '追手时长（秒）', tooltip: '起拖时碎片从原地追到手指位置的时长，linear。0 = 直接贴上（旧行为）' })
    catchTime = 0.14;

    @property({ displayName: '碎片离手指的纵向偏移（px）', tooltip: '正数把碎片抬到手指上方，模拟原版「手指底下留出画面」—— 原版 80px @414 宽，本工程折合 139。0 = 碎片就在指肚底下（本工程原来的样子）' })
    touchOffsetY = 0;

    private _entry: PieceEntry = null;
    private _guided = false;

    /** 按下那一刻的手指位置（UI 空间） */
    private _pressAt = new Vec2();
    /** 按下那一刻的碎片位置（世界空间，takeOut 之前记的） */
    private _pressPiece = new Vec3();
    /** 追手补间的起点 / 终点 */
    private _from = new Vec3();
    private _to = new Vec3();
    private _catch = { t: 0 };
    private _catching = false;
    private _dragging = false;
    /** 滑动模式下的「还没判方向」：按下了但还没决定是滚池子还是拿碎片，此时没有 spacer、也没 takeOut */
    private _pending = false;

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
        // 世界坐标必须在 takeOut **之前**记：换父节点只保留本地坐标，dragRoot 和 content
        // 不在同一处时世界坐标就变了
        this._pressAt.set(at.x, at.y);
        this._pressPiece.set(entry.piece.worldPosition);
        this._dragging = false;
        this._catching = false;
        Tween.stopAllByTarget(this._catch);

        // 滑动模式下这一下可能只是玩家想滚池子 —— 等方向定了再拿起（见 onMove）
        this._pending = this.pool.scrollMode;
        if (!this._pending) this.hold();
    }

    /** 真正拿起：换父、锁滚动、放大、广播。滑动模式下要等方向判定完才走到这儿。 */
    private hold(): void {
        const entry = this._entry;
        const piece = entry.piece;
        this.pool.takeOut(entry);
        this.pool.lockScroll();
        // 换父之后把世界坐标补回去 —— 按下那一瞬间碎片不许跳
        piece.setWorldPosition(this._pressPiece);
        const scale = this.pool.carryScaleOf(entry);
        Tween.stopAllByTarget(piece);
        // 和追手同一时长、同为 linear：原版这两件事是同一条 tween，节奏必须一致
        tween(piece).to(this.pickScaleTime, { scale: v3(scale, scale, 1) }, { easing: 'linear' }).start();
        EventBus.emit(GameEvent.PIECE_PICK, piece);
    }

    private onMove(e: EventTouch): void {
        if (!this._entry) return;
        const at = e.getUILocation();
        const piece = this._entry.piece;

        if (!this._dragging) {
            const dx = at.x - this._pressAt.x;
            const dy = at.y - this._pressAt.y;
            if (this.moveStartDistance > 0 && Math.sqrt(dx * dx + dy * dy) <= this.moveStartDistance) return;

            if (this._pending) {
                this._pending = false;
                // 位移主要落在池子的滑动轴上 = 玩家在滚池子，这一下不算拿起，后面的 MOVE 也别再捡回来。
                // 不能写死横轴：横屏那根竖栏是纵向滑的（`scrollAlongX` 看 Layout 主轴）
                const alongX = Math.abs(dx) >= Math.abs(dy);
                const scrolling = this.pool.scrollAlongX ? alongX : !alongX;
                if (scrolling) {
                    this._entry = null;
                    return;
                }
                // 纵向为主 = 拿碎片。判定前那段位移已经被池子滚掉了，从当前这一点重新起算，
                // 否则碎片会在拿起的瞬间往右下角窜一下
                this._pressAt.set(at.x, at.y);
                this._pressPiece.set(piece.worldPosition);
                this.hold();
            }

            this._dragging = true;
            this._from.set(piece.worldPosition);
            this._catching = this.catchTime > 0;
            if (this._catching) {
                this._catch.t = 0;
                Tween.stopAllByTarget(this._catch);
                tween(this._catch)
                    .to(this.catchTime, { t: 1 }, { onUpdate: () => this.follow() })
                    .call(() => {
                        this._catching = false;
                        this.follow();
                    })
                    .start();
            }
        }

        this.aim(at);
        if (this._catching) {
            // 补间在跑：只更新终点，位置由 `follow()` 插值写，别在这里再写一次
            this.follow();
        } else {
            piece.setWorldPosition(this._to);
        }
        EventBus.emit(GameEvent.PIECE_DRAG, piece, piece.worldPosition, this._entry.slotIndex);
    }

    /** 终点 = 按下时的碎片位置 + 手指位移 + 纵向偏移 */
    private aim(at: Vec2): void {
        this._to.set(
            this._pressPiece.x + (at.x - this._pressAt.x),
            this._pressPiece.y + (at.y - this._pressAt.y) + this.touchOffsetY,
            0,
        );
    }

    /** 追手补间的插值：起点 → 终点，linear */
    private follow(): void {
        if (!this._entry) return;
        const k = this._catch.t;
        this._entry.piece.setWorldPosition(
            this._from.x + (this._to.x - this._from.x) * k,
            this._from.y + (this._to.y - this._from.y) * k,
            0,
        );
    }

    private onEnd(): void {
        if (!this._entry) return;
        if (this._pending) {
            // 滑动模式下还没判方向就松手：这一下根本没拿起，直接作废（没有 spacer 可回）
            this._pending = false;
            this._entry = null;
            return;
        }
        const entry = this._entry;
        const started = this._dragging;
        this.release();
        // 松手没吸附：越过门限的才「插回最近的位置并推开邻居」，只是点了一下的原地归位
        if (started && this.pool.insertOnFail) this.pool.insertNearest(entry);
        else this.pool.sendHome(entry, false);
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
        if (!this._entry) return;
        if (this._pending) {
            this._pending = false;
            this._entry = null;
            return;
        }
        const entry = this._entry;
        this.release();
        // 等这一轮转屏的监听都跑完再回位：`LandscapeLayout` 会重排池子，
        // 此刻读到的 `spacer` 世界位置还不是最终那一个（下一帧起飞的 tween 会落在错的地方）
        this.scheduleOnce(() => this.pool.sendHome(entry, true), 0);
    }

    /** 收工：终局（`GAME_OVER`）或系统接管（`AUTO_PLAY`），拖拽都到此为止。
     *  监听已经摘了，手上那块就得自己放回去（不走 `release()`，
     *  免得把 `PiecePool` 刚锁上的滚动又解回来 —— 两条监听谁先跑不由这里决定）。
     *  放回去的这块正是 `AutoPlayer` 接下来第一个要飞的（它排在池子最前面）。 */
    private takeOver(): void {
        this.unbindContent();
        if (!this._entry) return;
        if (this._pending) {
            // 还没拿起，池子里的节点原地不动就行
            this._pending = false;
            this._entry = null;
            return;
        }
        const entry = this._entry;
        this._entry = null;
        this._dragging = false;
        this._catching = false;
        Tween.stopAllByTarget(this._catch);
        this.pool.sendHome(entry, true);
    }

    private release(): void {
        Tween.stopAllByTarget(this._catch);
        this._catching = false;
        this._dragging = false;
        this._pending = false;
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
