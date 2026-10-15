import { _decorator, Button, Component, Input, Node, UIOpacity, input, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { MraidBridge } from './MraidBridge';

const { ccclass, property } = _decorator;

/**
 * 终局跳转。两条路，时机不同：
 *
 * - 修满 `winCount` 个 → **吸附成功那一刻就跳**（`PIECE_REPAIRED`，不等这一格的揭晓动画），不弹任何界面；
 * - 修错（`REPAIR_FAILED`）→ 等这一格露面（`PIECE_SHOWN`）先把 `Fail` 整棵淡入，再跳。
 *
 * 跳完抛 `GAME_OVER`，玩法各模块收到就把输入收掉（拖拽 / 滚动 / 引导 / 常驻按钮），
 * 然后挂一条全局触摸监听 —— 玩家从商店回来之后点屏幕任意处再跳一次。
 *
 * 为什么不做一块全屏遮罩去接点击：节点处理器**只看 `hitTest` 就认领触摸**，跟有没有监听器无关，
 * 而深节点优先 —— 全屏遮罩挡不住池子里的 `content`，只会让全局 `input` 一起收不到。
 * 所以是「让玩法不要认领」，见 AGENTS.md §14。
 */
@ccclass('EndgameCta')
export class EndgameCta extends Component {
    @property({ type: MraidBridge, displayName: 'MRAID 桥' }) bridge: MraidBridge = null;
    @property({ type: Node, displayName: '失败界面（Fail）', tooltip: '修错时先把它淡入再跳商店' }) failRoot: Node = null;
    @property({ type: Button, displayName: '失败界面按钮', tooltip: '终局后它也是跳商店，这里只是让它别静默' }) failButton: Button = null;

    @property({ displayName: '修好几个就跳商店', tooltip: '0 = 不按数量跳，退回「全部修完出结束界面」那条老路' })
    winCount = 3;

    @property({ displayName: '失败界面淡入时长（秒）' })
    failFadeTime = 0.25;

    /** 修错那一格的槽位号，-1 = 还没定。只有失败路等它露面（`PIECE_SHOWN`）才动手 */
    private _endIndex = -1;
    private _over = false;
    private _fade: UIOpacity = null;

    protected onLoad(): void {
        if (this.failRoot) this.failRoot.active = false;
        this._fade = this.failRoot ? this.failRoot.getComponent(UIOpacity) : null;
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
        EventBus.on(GameEvent.REPAIR_FAILED, this.onFailed, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
        if (this.failButton) this.failButton.node.on(Button.EventType.CLICK, this.jump, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
        EventBus.off(GameEvent.REPAIR_FAILED, this.onFailed, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        if (this.failButton) this.failButton.node.off(Button.EventType.CLICK, this.jump, this);
        input.off(Input.EventType.TOUCH_START, this.onTap, this);
        this.unscheduleAllCallbacks();
    }

    /** 修满 `winCount` 就收摊，不等这一格的揭晓动画 —— 玩家吸附成功那一刻就跳商店。
     *
     *  ⚠️ 这一下**推到下一帧**才做（`scheduleOnce(..., 0)`），不能同期抛 `GAME_OVER`：
     *  `PIECE_REPAIRED` 是在 `PIECE_SNAP_SUCCESS` 派发中途抛出来的，这时候 `DragController`
     *  还没收到同一条事件、手上那块碎片还没 `consume` 掉。同期冻结的话那块的 `onGameOver`
     *  会把它 `sendHome` **送回池子**（还带着揭角），池里就凭空多出一块。 */
    private onRepaired(_slotIndex: number, done: number): void {
        if (this.winCount <= 0 || done < this.winCount || this._endIndex >= 0) return;
        this.scheduleOnce(() => this.finish(0), 0);
    }

    /** 修错是独立终局，不等凑满 `winCount`。它比 `PIECE_REPAIRED` 先抛（`PieceSlot.repair()` 里那句在前面），
     *  所以「修满那一块恰好修错」时失败赢 —— 那时 `_endIndex` 已经占了，上面那条会跳过。 */
    private onFailed(slotIndex: number): void {
        this._endIndex = slotIndex;
    }

    /** 只有失败路会走到这儿 —— `_endIndex` 只有 `onFailed` 会写：等终局那一格露面，弹失败界面再跳 */
    private onShown(slotIndex: number): void {
        if (slotIndex !== this._endIndex) return;
        this._endIndex = -1;
        this.showFail();
        this.finish(this.failFadeTime);
    }

    private showFail(): void {
        if (!this.failRoot) return;
        this.failRoot.active = true;
        if (!this._fade) return;
        if (this.failFadeTime <= 0) {
            this._fade.opacity = 255;
            return;
        }
        this._fade.opacity = 0;
        tween(this._fade).to(this.failFadeTime, { opacity: 255 }).start();
    }

    /** `GAME_OVER` 当场抛、`mraid.open` 落到下一帧：这一帧的收尾（碎片回收 / 补位 tween / 埋点）
     *  先落定，而且 `EventBus.emit` 不兜异常 —— 哪个监听方抛一下，同一帧里排在后面的跳转就没了。 */
    private finish(delay: number): void {
        if (this._over) return;
        this._over = true;
        EventBus.emit(GameEvent.GAME_OVER);
        input.on(Input.EventType.TOUCH_START, this.onTap, this);
        this.scheduleOnce(this.jump, delay);
    }

    /** 终局之后点屏幕任意处：撤掉还没到点的那一跳，当场再跳一次 */
    private onTap = (): void => {
        this.unschedule(this.jump);
        this.jump();
    };

    private jump = (): void => {
        // 跳转排在埋点前面：`EventBus.emit` 不兜异常，任何监听方抛一下后面这句就永远不执行
        this.bridge.openStore();
        EventBus.emit(GameEvent.CTA_CLICK);
    };
}
