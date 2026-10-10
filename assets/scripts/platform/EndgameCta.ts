import { _decorator, Button, Component, Input, Node, UIOpacity, input, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { MraidBridge } from './MraidBridge';

const { ccclass, property } = _decorator;

/**
 * 终局跳转。两条路，都要「等这一格的修复动画演完」（`PIECE_SHOWN`）才动手：
 *
 * - 修满 `winCount` 个 → 不弹任何界面，直接跳商店；
 * - 修错（`REPAIR_FAILED`）→ 先把 `Fail` 整棵淡入，再跳。
 *
 * 跳完抛 `GAME_OVER`，玩法各模块收到就把输入收掉（拖拽 / 滚动 / 引导 / 常驻按钮），
 * 然后挂一条全局触摸监听 —— 玩家从商店回来之后点屏幕任意处再跳一次。
 *
 * 为什么不做一块全屏遮罩去接点击：节点处理器**只看 `hitTest` 就认领触摸**，跟有没有监听器无关，
 * 而深节点优先 —— 全屏遮罩挡不住池子里的 `content`，只会让全局 `input` 一起收不到。
 * 所以是「让玩法不要认领」，见 CLAUDE.md §14。
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

    /** 终局那一格的槽位号，-1 = 还没定。等它露面（`PIECE_SHOWN`）才动手 */
    private _endIndex = -1;
    private _fail = false;
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

    private onRepaired(slotIndex: number, done: number): void {
        if (this.winCount <= 0 || done < this.winCount || this._endIndex >= 0) return;
        this._endIndex = slotIndex;
        this._fail = false;
    }

    /** 修错是独立终局，不等凑满 `winCount`。它比 `PIECE_REPAIRED` 先抛（`PieceSlot.repair()` 里那句在前面），
     *  所以「第 3 块恰好修错」时失败赢 —— 那时 `_endIndex` 已经占了，上面那条会跳过。 */
    private onFailed(slotIndex: number): void {
        this._endIndex = slotIndex;
        this._fail = true;
    }

    private onShown(slotIndex: number): void {
        if (slotIndex !== this._endIndex) return;
        this._endIndex = -1;
        if (this._fail) this.showFail();
        this.finish(this._fail ? this.failFadeTime : 0);
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
