import { _decorator, Component, director } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { EndgameCta } from './EndgameCta';

const { ccclass } = _decorator;

/** AppLovin 的预定义事件名。只能用这些 —— 官方明确说自定义事件不会被追踪 */
export enum PlayableEvent {
    DISPLAYED = 'DISPLAYED',
    CHALLENGE_STARTED = 'CHALLENGE_STARTED',
    CHALLENGE_PASS_25 = 'CHALLENGE_PASS_25',
    CHALLENGE_PASS_50 = 'CHALLENGE_PASS_50',
    CHALLENGE_PASS_75 = 'CHALLENGE_PASS_75',
    CHALLENGE_SOLVED = 'CHALLENGE_SOLVED',
    CHALLENGE_FAILED = 'CHALLENGE_FAILED',
    ENDCARD_SHOWN = 'ENDCARD_SHOWN',
    CTA_CLICKED = 'CTA_CLICKED',
}

const PASS_MARKS = [0.25, 0.5, 0.75];
const PASS_EVENTS = [
    PlayableEvent.CHALLENGE_PASS_25,
    PlayableEvent.CHALLENGE_PASS_50,
    PlayableEvent.CHALLENGE_PASS_75,
];

/**
 * AppLovin 试玩埋点（Playable Analytics）。挂在 Canvas 上，**只听 EventBus** —— 发射方一行不改。
 *
 * 映射（左=本项目既有事件，右=AppLovin 事件）：
 *
 * - `LEVEL_BUILT`     → `DISPLAYED`          关卡建好、碎片池即将填充 = 可以交互了
 * - `PIECE_PICK`      → `CHALLENGE_STARTED`  第一次拿起碎片
 * - `REPAIR_PROGRESS` → `CHALLENGE_PASS_25/50/75`
 * - `LEVEL_COMPLETE`  → `CHALLENGE_SOLVED`   全部修完（`winCount = 0` 时的那条通关路）
 * - `GAME_OVER`       → `CHALLENGE_SOLVED`   修满 `winCount` 被跳走那一 tick。
 *                                             ⚠️ 失败路也抛 `GAME_OVER`，靠 `_failed` 挡掉，不然一次失败会报两条
 * - `REPAIR_FAILED`   → `CHALLENGE_FAILED`   当前场景走不到（没有槽位配 `altView`），接上是为了配置一改就生效
 * - `CTA_SHOW`        → `ENDCARD_SHOWN`      结束界面亮起
 * - `CTA_CLICK`       → `CTA_CLICKED`        三个跳转口都抛它，**含自动跳转**
 *
 * 不接 `LOADING` / `LOADED`（本项目没有 loading 屏，官方说这种情况直接从 `DISPLAYED` 开始）
 * 和 `CHALLENGE_RETRY`（本项目没有「重试」这个概念）。完整说明见 `docs/ANALYTICS.md`。
 *
 * `ALPlayableAnalytics` 是投放容器注入的全局变量（官方明说「不要自己定义」）：本地浏览器、
 * Moloco / Google 产物里都没有它，所以每次调用前都查一次存在性，没有就整体静默 no-op。
 * 这个守卫本身就是官方的规定写法，不是防御性判空 —— 它也是本地调试不进上报的原因。
 */
@ccclass('PlayableAnalytics')
export class PlayableAnalytics extends Component {
    private _displayed = false;
    private _started = false;
    private _solved = false;
    private _failed = false;
    private _endcard = false;
    private _clicked = false;
    private _passed = [false, false, false];
    private _goal = -1;

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.on(GameEvent.REPAIR_PROGRESS, this.onProgress, this);
        EventBus.on(GameEvent.LEVEL_COMPLETE, this.onSolved, this);
        EventBus.on(GameEvent.GAME_OVER, this.onSolved, this);
        EventBus.on(GameEvent.REPAIR_FAILED, this.onFailed, this);
        EventBus.on(GameEvent.CTA_SHOW, this.onEndcard, this);
        EventBus.on(GameEvent.CTA_CLICK, this.onClick, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.off(GameEvent.REPAIR_PROGRESS, this.onProgress, this);
        EventBus.off(GameEvent.LEVEL_COMPLETE, this.onSolved, this);
        EventBus.off(GameEvent.GAME_OVER, this.onSolved, this);
        EventBus.off(GameEvent.REPAIR_FAILED, this.onFailed, this);
        EventBus.off(GameEvent.CTA_SHOW, this.onEndcard, this);
        EventBus.off(GameEvent.CTA_CLICK, this.onClick, this);
    }

    private onLevelBuilt(): void {
        if (this._displayed) return;
        this._displayed = true;
        this.track(PlayableEvent.DISPLAYED);
    }

    private onPick(): void {
        if (this._started) return;
        this._started = true;
        this.track(PlayableEvent.CHALLENGE_STARTED);
    }

    /** 通关。`_failed` 那句是给失败路兜的：那条路走完也会抛 `GAME_OVER`，
     *  不挡的话一次失败会同时报 `CHALLENGE_FAILED` 和 `CHALLENGE_SOLVED` */
    private onSolved(): void {
        if (this._solved || this._failed) return;
        this._solved = true;
        this.track(PlayableEvent.CHALLENGE_SOLVED);
    }

    private onFailed(): void {
        if (this._failed) return;
        this._failed = true;
        this.track(PlayableEvent.CHALLENGE_FAILED);
    }

    private onEndcard(): void {
        if (this._endcard) return;
        this._endcard = true;
        this.track(PlayableEvent.ENDCARD_SHOWN);
    }

    private onClick(): void {
        if (this._clicked) return;
        this._clicked = true;
        this.track(PlayableEvent.CTA_CLICKED);
    }

    /** 三个里程碑一次算完（`done / goal` 过了哪几个就发哪几个），免得一次跳过两格时漏报 */
    private onProgress(done: number, total: number): void {
        const goal = this.goal > 0 ? this.goal : total;
        if (goal <= 0) return;
        const ratio = done / goal;
        for (let i = 0; i < PASS_MARKS.length; i++) {
            if (this._passed[i] || ratio < PASS_MARKS[i]) continue;
            this._passed[i] = true;
            this.track(PASS_EVENTS[i]);
        }
    }

    /**
     * 里程碑的分母。**终局线（`EndgameCta.winCount`）优先** —— 玩家修到那儿就被自动跳走了，
     * 按槽位总数算的话后两个里程碑和 `CHALLENGE_SOLVED` 永远不会出现（官方要求：用了
     * `CHALLENGE_STARTED` 就必须至少用 `CHALLENGE_SOLVED` / `CHALLENGE_FAILED` 之一）。
     * `winCount = 0`（不按数量跳）才退回 `REPAIR_PROGRESS` 给的槽位总数。
     *
     * 读一次就缓存（运行期不会变），也和 `FeatureFlags.panel` 一样不在 Inspector 里重复配一份数
     * —— 那个数只有一处真相，同步问题就不存在。
     */
    private get goal(): number {
        if (this._goal < 0) {
            const cta = director.getScene().getComponentInChildren(EndgameCta);
            this._goal = cta ? cta.winCount : 0;
        }
        return this._goal;
    }

    private track(name: PlayableEvent): void {
        const a = (window as any).ALPlayableAnalytics;
        if (typeof a === 'undefined') return;
        console.log('[Analytics] ' + name);
        a.trackEvent(name);
    }
}
