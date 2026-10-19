import { Component } from 'cc';
import { EventBus } from '../core/EventBus';

/** 触发条件面板 —— 和 @property 字段一一对应，组件在 onEnable 时读一遍。 */
export interface TriggerConfig {
    /** 打勾 = 进场立刻启动 */
    playOnLoad: boolean;
    /** 启动事件：全部到齐才启动 */
    startEvents: string[];
    /** 启动延迟（秒） */
    startDelay: number;
    /** 停止事件：任意一个到达就停止 */
    stopEvents: string[];
    /** 停止延迟（秒） */
    stopDelay: number;
    /** 只认这个槽位序号（-1 = 任意；事件不带参数时也视为匹配） */
    slotIndex: number;
}

/**
 * 给「粒子 / 炉火」这类常驻特效用的通用触发器：把 EventBus 事件翻成 start / stop。
 *
 * 为什么不直接用 EventCondition：那个是「条件满足就执行一次回调」的通用组件，
 * 粒子要的是「事件到了就 startSystem，事件到了就 stopSystem」，还要能配延迟和槽位过滤。
 *
 * 面板字段全在宿主组件上（Particle2D / FireAction），这里只管把值翻成行为。
 */
export class EventTrigger {
    private _cfg: TriggerConfig;
    private _host: Component;
    private _onStart: () => void;
    private _onStop: () => void;
    private _seen = new Set<string>();
    private _subscribed = false;
    private _startPending = false;
    private _stopPending = false;
    private _handlers = new Map<string, (...args: any[]) => void>();

    constructor(host: Component, cfg: TriggerConfig, onStart: () => void, onStop: () => void) {
        this._host = host;
        this._cfg = cfg;
        this._onStart = onStart;
        this._onStop = onStop;
    }

    /** 组件 onEnable 里调一次 */
    start(): void {
        const cfg = this._cfg;
        if (cfg.startEvents.length || cfg.stopEvents.length) this._subscribe();
        if (cfg.playOnLoad) this._onStart();
    }

    /** 组件 onDisable 里调：退订、取消还没到点的定时器 */
    dispose(): void {
        if (this._subscribed) {
            for (const [e, h] of this._handlers) EventBus.off(e, h, this);
            this._handlers.clear();
            this._subscribed = false;
        }
        this._host.unscheduleAllCallbacks();
        this._startPending = false;
        this._stopPending = false;
        this._seen.clear();
    }

    private _subscribe(): void {
        if (this._subscribed) return;
        this._subscribed = true;
        const events = this._cfg.startEvents.concat(
            this._cfg.stopEvents.filter((e) => this._cfg.startEvents.indexOf(e) < 0));
        // ⚠️ EventBus.emit 只把载荷透传给回调，**不带事件名**（见 core/EventBus.ts）。
        // 所以每个事件必须包一层把名字补回去，否则 _onEvent 收到的第一个参数是载荷（如槽位号 0），
        // stopEvents.indexOf(0) 永远是 -1 —— 事件起停整条静默失效（2026-10-19 雪不停就是这个）。
        for (const e of events) {
            const h = (...args: any[]) => this._onEvent(e, ...args);
            this._handlers.set(e, h);
            EventBus.on(e, h, this);
        }
    }

    private _onEvent(event: string, ...args: any[]): void {
        const cfg = this._cfg;
        if (!this._matchSlot(args)) return;
        if (cfg.stopEvents.indexOf(event) >= 0 && !this._stopPending) {
            this._stopPending = true;
            if (cfg.stopDelay > 0) this._host.scheduleOnce(this._fireStop, cfg.stopDelay);
            else this._fireStop();
        }
        if (cfg.startEvents.indexOf(event) >= 0) {
            this._seen.add(event);
            let all = true;
            for (const e of cfg.startEvents) if (!this._seen.has(e)) { all = false; break; }
            if (all && !this._startPending) {
                this._startPending = true;
                if (cfg.startDelay > 0) this._host.scheduleOnce(this._fireStart, cfg.startDelay);
                else this._fireStart();
            }
        }
    }

    /** 事件参数第一个是槽位序号（PIECE_REPAIRED 就这样发）；配了 slotIndex 才过滤 */
    private _matchSlot(args: any[]): boolean {
        const want = this._cfg.slotIndex;
        if (want < 0) return true;
        const got = args.length ? args[0] : undefined;
        if (typeof got !== 'number') return true;
        return got === want;
    }

    private _fireStart = (): void => { this._startPending = false; this._onStart(); };
    private _fireStop = (): void => { this._stopPending = false; this._onStop(); };
}