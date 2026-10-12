import { _decorator, Component, director } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { EndgameCta } from './EndgameCta';

const { ccclass } = _decorator;

/**
 * AppLovin 试玩埋点（HTML analytics integration）。规范与逐条理由见根目录 `ANALYTICS.md`，
 * 这里只记落点。
 *
 * 挂在 `Canvas` 上，**只听 `EventBus`**：玩法模块一行没改，发射方照旧（ANALYTICS.md §3 的形状 B）。
 * `ALPlayableAnalytics` 是投放容器注入的全局 —— 本地浏览器 / 编辑器 / Moloco / Google 产物里都没有它，
 * `track()` 里那个守卫就是「这些环境下整体静默跳过」的机制。
 *
 * ⚠️ 三条成对的别单独摘：官方要求「用了 `CHALLENGE_STARTED` 就必须至少用 `CHALLENGE_SOLVED` /
 * `CHALLENGE_FAILED` 之一」，而自定义事件名根本不会被追踪。
 */

/** 官方预定义事件名，拼写逐字照抄（ANALYTICS.md §2） */
const PA = {
    DISPLAYED: 'DISPLAYED',
    CHALLENGE_STARTED: 'CHALLENGE_STARTED',
    CHALLENGE_PASS_25: 'CHALLENGE_PASS_25',
    CHALLENGE_PASS_50: 'CHALLENGE_PASS_50',
    CHALLENGE_PASS_75: 'CHALLENGE_PASS_75',
    CHALLENGE_SOLVED: 'CHALLENGE_SOLVED',
    CHALLENGE_FAILED: 'CHALLENGE_FAILED',
    ENDCARD_SHOWN: 'ENDCARD_SHOWN',
    CTA_CLICKED: 'CTA_CLICKED',
} as const;

type PaEvent = (typeof PA)[keyof typeof PA];

/** 里程碑由低到高，和 `MARK_EVENTS` 一一对应 —— 想加档就两个数组同长地加 */
const MARKS = [0.25, 0.5, 0.75];
const MARK_EVENTS: PaEvent[] = [PA.CHALLENGE_PASS_25, PA.CHALLENGE_PASS_50, PA.CHALLENGE_PASS_75];

/** 产物地址后加 `#debug` 才打日志，平时控制台干干净净（ANALYTICS.md §6） */
const DEBUG = typeof location !== 'undefined' && location.hash.indexOf('debug') >= 0;

/** 唯一的出口：守卫、去重、调试日志都只在这一处。一局只报一次，重复报只会污染报表 */
const fired = new Set<string>();

function track(name: PaEvent): void {
    const a = (window as any).ALPlayableAnalytics;
    if (typeof a === 'undefined') return;
    if (fired.has(name)) return;
    fired.add(name);
    if (DEBUG) console.log('[Analytics] ' + name);
    a.trackEvent(name);
}

@ccclass('PlayableAnalytics')
export class PlayableAnalytics extends Component {
    /** 里程碑分母 = **结算门槛**（`EndgameCta.winCount`），不是槽位总数 —— 玩家没修完就被跳走时，
     *  按总数算后两档和 `CHALLENGE_SOLVED` 永远不会出现（ANALYTICS.md §4.1）。`winCount = 0`
     *  （不按数量跳）退回槽位总数。运行期从场景里现读，不在 Inspector 上重配一份。 */
    private _goal = 0;
    private _passed = [false, false, false];
    /** 这一局已经报过 `CHALLENGE_FAILED`：修错之后那次 `GAME_OVER` 不该再报 `CHALLENGE_SOLVED` */
    private _failed = false;

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.on(GameEvent.REPAIR_PROGRESS, this.onProgress, this);
        EventBus.on(GameEvent.REPAIR_FAILED, this.onFailed, this);
        EventBus.on(GameEvent.GAME_OVER, this.onOver, this);
        EventBus.on(GameEvent.CTA_SHOW, this.onCtaShow, this);
        EventBus.on(GameEvent.CTA_CLICK, this.onCtaClick, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.off(GameEvent.REPAIR_PROGRESS, this.onProgress, this);
        EventBus.off(GameEvent.REPAIR_FAILED, this.onFailed, this);
        EventBus.off(GameEvent.GAME_OVER, this.onOver, this);
        EventBus.off(GameEvent.CTA_SHOW, this.onCtaShow, this);
        EventBus.off(GameEvent.CTA_CLICK, this.onCtaClick, this);
    }

    /** 关卡建好 = 玩家可以开始操作了，这就是本广告的起跑线。单文件内联、没有 loading 屏，
     *  所以起手就是 `DISPLAYED`（官方对没有 LOADING 的情况就是这么说的） */
    private onLevelBuilt(data: SlotData[]): void {
        const end = director.getScene().getComponentInChildren(EndgameCta);
        this._goal = end && end.winCount > 0 ? end.winCount : data.length;
        track(PA.DISPLAYED);
    }

    /** 第一次真的拿起一块碎片 —— 与 `DISPLAYED` 的差 = 看了没动手的人 */
    private onPick(): void {
        track(PA.CHALLENGE_STARTED);
    }

    /** 三档一次算完：进度一次跨过好几格（`winCount` 小的时候是常态）不会漏报 */
    private onProgress(done: number, total: number): void {
        const goal = this._goal || total;
        if (goal <= 0) return;
        const ratio = done / goal;
        for (let i = 0; i < MARKS.length; i++) {
            if (this._passed[i] || ratio < MARKS[i]) continue;
            this._passed[i] = true;
            track(MARK_EVENTS[i]);
        }
    }

    /** 修错（本项目的 Slot_04 没先修好前置槽位就修它）。它比 `PIECE_REPAIRED` 先抛，两者又都早于
     *  `GAME_OVER`，所以「刚好那一块修错」的终局保证落在失败这条上 */
    private onFailed(): void {
        this._failed = true;
        track(PA.CHALLENGE_FAILED);
    }

    /** 终局那一跳排在这一 tick 之后（`EndgameCta.finish()` 先抛事件、`scheduleOnce` 才跳），
     *  所以上报必然排在跳转前面 */
    private onOver(): void {
        if (this._failed) return;
        track(PA.CHALLENGE_SOLVED);
    }

    /** 结束界面在广告内部亮起来。`winCount > 0` 时玩家没修完就被跳走了，这条走不到 ——
     *  接上是为了 `winCount` 改成 0 时自动生效 */
    private onCtaShow(): void {
        track(PA.ENDCARD_SHOWN);
    }

    /** 成功那条和失败那条都是**无用户交互自动跳商店**，照样报：它和玩家手点走的是同一个
     *  `openStore()` 出口。代价是报表上点击率偏高，这是有意选的（ANALYTICS.md §4.3 / §7.5） */
    private onCtaClick(): void {
        track(PA.CTA_CLICKED);
    }
}
