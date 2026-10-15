import { _decorator, Component, tween, v3 } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceEntry, PiecePool } from './PiecePool';

const { ccclass, property } = _decorator;

/**
 * 自动打关：玩家自己修够 `afterPlaced` 块之后系统接管，把剩下的碎片放完。
 *
 * 节奏是**一批一批**的：每一步把池里此刻摆出来的 `batches` 屏（一屏 = `PiecePool.batchSize` 块）
 * 一起放走，块与块之间错开 `stagger` 起飞（有点错落感，别齐刷刷地弹出去），全落完再消耗、
 * 池子补下一批，隔 `gap` 秒放下一批。**一批默认摆 2 屏** —— 一屏一屏放的话 20 块要 7 轮，
 * 每轮都要重新飞一次 + 歇 `gap` 秒，整段拖得比修图本身还长。
 *
 * **最后一批不做错峰**（齐落）：前面一屏一屏错着走，收尾这一下同时飞、同时落地，节奏对比就出来了。
 * 它后面接着的那口留白与那道横扫的光不归这儿管 —— 在 `RepairSweep`（`completeDelay` / `sweepOnComplete`）。
 *
 * 每一块走的是玩家**同一条**流水线 —— 先抛 `AUTO_PLAY` 让 `DragController` 把输入收掉，
 * 然后 `takeOut` → 抛 `PIECE_PICK` → tween 到缺口中心 → 抛 `PIECE_DRAG`
 * （吸附判定照旧由 `SnapSystem` 做）→ 一批落完 `consumeAll`。所以揭晓 / 音阶 / 进度 / 埋点全部照常，
 * 最后一块修好照旧按 `EndgameCta.winCount` 跳商店 —— 这条广告一定能走到 CTA。
 *
 * 整个组件只干这一件事：开关关着、或门槛填 0，就在 `onEnable` 首行 return，一条监听都不注册。
 * 门槛与节奏全在 Inspector 里（§16），代码里不留常量。
 *
 * ⚠️ `afterPlaced` 别配到 `winCount` 以上：那样玩家自己就修满了，接管无事可做
 * （`GAME_OVER` 那一帧会把还没起飞的接管整个撤掉，见 `onGameOver`）。
 */
@ccclass('AutoPlayer')
export class AutoPlayer extends Component {
    @property({ type: PiecePool, displayName: '碎片池' }) pool: PiecePool = null;

    @property({ displayName: '玩家修够几块后接管', tooltip: '玩家自己吸附成功这么多块，剩下的由系统接着放。填 0 = 不接管' })
    afterPlaced = 2;

    @property({ displayName: '接管前停顿（秒）', tooltip: '第 N 块修好之后隔这么久才起飞，免得和玩家手上那一下、以及这一格的揭晓动画撞在一起' })
    startDelay = 0.5;

    @property({ displayName: '同一屏错峰间隔（秒）', tooltip: '同一屏里每块比前一块晚这么久起飞 —— 有点错落感，别一屏齐刷刷地弹出去。填 0 = 完全同时飞' })
    stagger = 0.05;

    @property({ displayName: '一次飞几批（1 批 = 一屏）', tooltip: '每一步连着摆出这么多屏、一起飞走。池子平时一次只摆一屏（宽度是照裁剪窗定的，摆多了两头会露到框外被裁），接管之后才连着摆。填 1 = 一屏一屏放（老行为）' })
    batches = 2;

    @property({ displayName: '每批之间的间隔（秒）', tooltip: '一屏碎片落完、池子补上下一屏之后，隔多久放下一屏' })
    gap = 0.15;

    @property({ displayName: '飞入时长（秒）', tooltip: '从池里的位置飞到缺口中心的时长，同时也是拿起来放大到缺口大小的时长。一屏的用时 = (块数-1)×错峰间隔 + 它' })
    flyTime = 0.25;

    private _data: SlotData[] = [];
    /** 正在自动放。`GAME_OVER` 之后置回 false —— 商店都开了，剩下的碎片不该再飞 */
    private _auto = false;
    /** 接管已经触发过（或已被终局撤掉），不再触发第二次 */
    private _triggered = false;
    /** 正在飞的那一批，以及它还有几块没落地 —— 归零才消耗这一批、才排下一批 */
    private _batch: PieceEntry[] = [];
    private _pending = 0;

    protected onEnable(): void {
        if (!FeatureFlags.autoPlay || this.afterPlaced <= 0) return;
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
        EventBus.on(GameEvent.GAME_OVER, this.onGameOver, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
        EventBus.off(GameEvent.GAME_OVER, this.onGameOver, this);
        this.unscheduleAllCallbacks();
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._data = data;
    }

    /** 玩家修够门槛就预约接管。计的是 `RepairSystem` 报的 `done`，不是这里自己数 ——
     *  接管之前每一块都是玩家自己放的，两边本来就相等。 */
    private onRepaired(_slotIndex: number, done: number): void {
        if (this._triggered || done < this.afterPlaced) return;
        this._triggered = true;
        this.scheduleOnce(this.begin, this.startDelay);
    }

    /** 终局（商店已经在开）或玩家自己修满了：撤掉还没起飞的接管。
     *  手上有碎片在半空中就不管了 —— 那一下它已经落在缺口中心上，收摊只是没被消耗掉。 */
    private onGameOver(): void {
        this._auto = false;
        this.unscheduleAllCallbacks();
    }

    private begin = (): void => {
        this._auto = true;
        EventBus.emit(GameEvent.AUTO_PLAY);
        this.step();
    };

    /** 放下**池里现在摆出来的那几屏**：整批一起走，块与块之间错开 `stagger` 起飞，全落完再排下一批。
     *  池里没有了就是全放完，收摊。 */
    private step = (): void => {
        if (!this._auto) return;
        // 池子平时一次只摆一屏，这里先把它摆够（`buildMore` 摆到没得摆为止，多叫几次是安全的）
        for (let i = 1; i < this.batches; i++) this.pool.buildMore();
        const batch = this.pool.entries.slice();
        if (batch.length === 0) return;
        this._batch = batch;
        this._pending = batch.length;
        // 池子按槽位顺序摆碎片，所以「这一屏里装着最后一格」就是最后一批 —— 玩家先手修了几块、
        // `batchSize` 除不除得尽都不影响这个判断。最后一批错峰归零，整屏一起飞。
        const last = batch.some((e) => e.slotIndex === this._data.length - 1);
        // 错峰排在 `launch` 前面（而不是 tween 的 `.delay()`）：这样「拿起」那一套（takeOut / 揭角 /
        // 音效）也跟着错开，先走的那块不会在原地举着等自己那块的表。
        for (let i = 0; i < batch.length; i++) {
            const entry = batch[i];
            this.scheduleOnce(() => this.launch(entry), last ? 0 : i * this.stagger);
        }
    };

    private launch(entry: PieceEntry): void {
        const piece = entry.piece;
        // `takeOut` 会换个父节点（位置跟着父节点走），所以先记下池里那个世界位置再挪回去
        const from = piece.worldPosition.clone();
        this.pool.takeOut(entry);
        piece.setWorldPosition(from);
        EventBus.emit(GameEvent.PIECE_PICK, piece);

        const scale = this.pool.carryScaleOf(entry);
        const at = this._data[entry.slotIndex].slot.worldCenter;
        tween(piece)
            .to(this.flyTime, { worldPosition: v3(at.x, at.y, 0), scale: v3(scale, scale, 1) }, { easing: 'quadOut' })
            .call(() => this.land(entry))
            .start();
    }

    /** 落到位：位置已经在缺口中心，吸附判定照旧由 `SnapSystem` 做 —— 这里只当那个「把碎片拖过去的人」。
     *  抛事件排在消耗前面，和 `DragController.onSnapSuccess` 同一个次序（等 `RepairSystem` 先修完）。
     *  消耗要等这一批**全部**落地才做 —— 理由见 `PiecePool.consumeAll`（半空中被补位 tween 掐掉的坑）。 */
    private land(entry: PieceEntry): void {
        if (!this._auto) return;
        EventBus.emit(GameEvent.PIECE_DRAG, entry.piece, entry.piece.worldPosition, entry.slotIndex);
        if (--this._pending > 0) return;
        this.pool.consumeAll(this._batch);
        this.scheduleOnce(this.step, this.gap);
    }
}
