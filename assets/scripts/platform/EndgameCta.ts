import { _decorator, Button, Component, Input, Node, UIOpacity, input, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { FailVideo } from './FailVideo';
import { MraidBridge } from './MraidBridge';

const { ccclass, property } = _decorator;

/**
 * 终局跳转。两条路，时机不同：
 *
 * - 修满 `winCount` 个 → **吸附成功那一刻就跳**（`PIECE_REPAIRED`，不等这一格的揭晓动画），不弹任何界面；
 * - 修错（`REPAIR_FAILED`）→ 等这一格露面（`PIECE_SHOWN`），**先冻玩法 + 停掉游戏那盘音**，
 *   再演一遍失败动画（配了 `failVideo` 的话）—— 演完或玩家点一下跳过 —— 才把 `Fail` 整棵淡入，最后跳。
 *
 * `GAME_OVER` 一抛，玩法各模块收到就把输入收掉（拖拽 / 滚动 / 引导 / 常驻按钮）；等界面出场，再挂一条
 * 全局触摸监听 —— 玩家从商店回来之后点屏幕任意处再跳一次。两件事分在两处：**冻玩法要早**（失败路在
 * 视频起播前就冻），**「点哪都能跳」要等界面真的出现**，见 `freeze()` / `finish()` 的注释。
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
    @property({ type: FailVideo, displayName: '失败动画（视频）', tooltip: '留空 = 不演，直接淡入失败界面。见 §18' }) failVideo: FailVideo = null;

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

    /** 只有失败路会走到这儿 —— `_endIndex` 只有 `onFailed` 会写：等终局那一格露面，演失败动画、再弹失败界面 */
    private onShown(slotIndex: number): void {
        if (slotIndex !== this._endIndex) return;
        this._endIndex = -1;
        if (!this.failVideo) {
            this.endFail();
            return;
        }
        // 冻玩法 + 停掉游戏那盘音，都排在**起播之前**：
        // ① 视频只盖着「播放区域」，区域外的画布照旧收得到触摸，这会儿不冻住，玩家摸到的是底下那盘还在跑的拼图；
        // ② 视频自带音轨，游戏里那三条常驻音得先让位（`GAME_OVER` → `AudioManager.stopAll()`），见 §18
        this.freeze();
        if (!this.failVideo.play(this.endFail)) this.endFail();
    }

    /** 失败动画演完（或被玩家点掉）：这才轮到失败界面，再跳商店 */
    private endFail = (): void => {
        this.showFail();
        this.finish(this.failFadeTime);
    };

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

    /** 只冻玩法。失败路要在**视频起播之前**就冻（`onShown` 里），所以单独一句 ——
     *  视频那几秒里玩家点什么都不会有反应，不冻住的话他摸到的是底下那盘还在跑的拼图。 */
    private freeze(): void {
        if (this._over) return;
        this._over = true;
        EventBus.emit(GameEvent.GAME_OVER);
    }

    /** 终局收尾：冻玩法 + 挂「点哪都能跳」+ 到点跳。
     *
     *  ⚠️ 「点哪都能跳」挂在**界面出场这一刻**，不跟 `freeze()` 一起：失败动画只盖着「播放区域」，
     *  区域外的画布照旧收得到触摸，那会儿就把监听挂上，玩家点一下背景就直接跳商店、失败界面根本来不及出场。
     *
     *  `GAME_OVER` 当场抛、`mraid.open` 落到下一帧：这一帧的收尾（碎片回收 / 补位 tween / 埋点）
     *  先落定，而且 `EventBus.emit` 不兜异常 —— 哪个监听方抛一下，同一帧里排在后面的跳转就没了。 */
    private finish(delay: number): void {
        this.freeze();
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
