import { _decorator, Component, EventTouch, Node, UIOpacity } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { MraidBridge } from '../platform/MraidBridge';
import { CardBurst } from './CardBurst';

const { ccclass, property } = _decorator;

/**
 * 结束界面的卡片带：默认离散步进（一次一张走进正中），
 * 进场先缓动快翻一轮；玩家可以左右拖动，松手吸附到最近一张。
 */
@ccclass('EndCarousel')
export class EndCarousel extends Component {
    @property({ type: [Node], displayName: '卡片（顺序即展示顺序）' }) items: Node[] = [];
    @property({ displayName: '步进间隔（秒）' }) interval = 1.7;
    @property({ displayName: '移动时长（秒）' }) moveTime = 0.55;
    @property({ displayName: '间距（px）' }) spacing = 132;
    @property({ displayName: '正中缩放' }) centerScale = 1;
    @property({ displayName: '两侧缩放' }) sideScale = 0.62;
    @property({ displayName: '再远一张的缩小比', tooltip: '第 3 张往外每远一张再乘这个系数' }) shrink = 0.82;
    @property({ displayName: '可见半径（px）' }) visibleRange = 340;
    @property({ displayName: '到位放大（倍）' }) pulseScale = 0.1;
    @property({ displayName: '到位脉冲时长（秒）' }) pulseTime = 0.55;
    @property({ displayName: '到位高亮（0~1）' }) pulseGlow = 1;
    @property({ displayName: '进场快滚时长（秒）' }) introTime = 1.1;
    @property({ displayName: '进场快滚速度（张/秒）' }) introSpeed = 14;
    @property({ type: CardBurst, displayName: '正中卡片粒子' }) burst: CardBurst = null;
    @property({ displayName: '可拖动' }) draggable = true;
    @property({ displayName: '阻尼系数', tooltip: '松手后速度按 e^(-k·t) 衰减，越大停得越快（3 左右是「再滑半张」的手感）' }) friction = 3.4;
    @property({ displayName: '滑行停止速度（张/秒）', tooltip: '速度掉到这个值以下就交给缓动吸到最近一张' }) stopVel = 0.7;
    @property({ displayName: '吸附时长（秒）' }) snapTime = 0.2;
    @property({ type: MraidBridge, displayName: 'MRAID 桥' }) bridge: MraidBridge = null;
    @property({ displayName: '点击容差（px）', tooltip: '按下到抬起的总位移不超过它算点击，超过就算拖动（不跳转）' }) tapSlop = 14;
    @property({ displayName: '点击跳商店' }) tapToStore = true;

    private _pos = 0;
    private _fromPos = 0;
    private _toPos = 1;
    private _phase = 0;
    private _t = 0;
    private _idle = 0;
    private _inited = false;
    private _intro = 0;
    private _introTo = 0;
    private _dragging = false;
    private _dragX = 0;
    private _dragFrom = 0;
    private _dragLastX = 0;
    private _dragLastT = 0;
    private _vel = 0;
    private _moveDur = 0.55;
    private _downX = 0;
    private _downY = 0;
    private _tapped = false;
    /** 真正拖起来了（越过了点击容差）时回调一次 —— 音频那边从这一刻起放滑动声 */
    onSlideStart: (() => void) | null = null;
    /** 滑动停下（阻尼滑行结束、开始吸附）时回调一次 —— 音频那边在这里收声 */
    onSettle: (() => void) | null = null;
    private _slideLive = false;

    onEnable() {
        if (this.items.length) this._pos = this.norm(Math.round(this._pos));
        this._fromPos = this._pos;
        this._introTo = this._pos + Math.max(1, Math.round(this.introSpeed * this.introTime));
        this._intro = this.introTime;
        this._idle = 0;
        this._phase = 0;
        this._t = 0;
        this._inited = false;
        this._dragging = false;
        this._tapped = false;
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    onDisable() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this._dragging = false;
    }

    update(dt: number) {
        if (this.items.length < 2) return;
        if (!this._inited) {
            this._inited = true;
            this.layout(0);
            return;
        }
        if (this._dragging) return;

        if (this._intro > 0) {
            this._intro -= dt;
            const k = Math.min(1, 1 - Math.max(0, this._intro) / Math.max(0.01, this.introTime));
            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) * 0.5;
            this._pos = this._fromPos + (this._introTo - this._fromPos) * e;
            this.layout(0);
            if (this._intro <= 0) {
                this._pos = this.norm(this._introTo);
                this._phase = 0;
                this._idle = this.interval * 0.45;
                this.layout(0);
                if (this.burst) this.burst.burst();
            }
            return;
        }

        if (this._phase === 3) {
            this._pos += this._vel * dt;
            this._vel *= Math.exp(-this.friction * dt);
            this.layout(0);
            if (Math.abs(this._vel) <= this.stopVel) {
                this._vel = 0;
                this.settleTo();
            }
            return;
        }

        if (this._phase === 1) {
            this._t = Math.min(1, this._t + dt / Math.max(0.01, this._moveDur));
            const e = 1 - Math.pow(1 - this._t, 3);
            this._pos = this._fromPos + (this._toPos - this._fromPos) * e;
            this.layout(0);
            if (this._t >= 1) {
                this._pos = this.norm(this._toPos);
                this._phase = 2;
                this._t = 0;
                if (this.burst) this.burst.burst();
            }
        } else if (this._phase === 2) {
            this._t = Math.min(1, this._t + dt / Math.max(0.01, this.pulseTime));
            this.layout(Math.sin(Math.PI * this._t));
            if (this._t >= 1) {
                this._phase = 0;
                this._idle = 0;
                this.layout(0);
            }
        } else {
            this._idle += dt;
            if (this._idle >= this.interval) {
                this._idle = 0;
                this.step(1);
            }
        }
    }

    private step(dir: number): void {
        this._fromPos = this._pos;
        this._toPos = this._pos + dir;
        this._moveDur = this.moveTime;
        this._phase = 1;
        this._t = 0;
    }

    private norm(v: number): number {
        const n = this.items.length;
        return ((v % n) + n) % n;
    }

    /** 当前正中的那张卡（扫光要扫它） */
    get centerItem(): Node {
        const n = this.items.length;
        if (!n) return null;
        return this.items[Math.round(((this._pos % n) + n) % n) % n];
    }

    private onTouchStart(e: EventTouch): void {
        const p = e.getUILocation();
        this._downX = p.x;
        this._downY = p.y;
        this._tapped = true;
        if (!this.draggable || this._intro > 0 || this.items.length < 2) return;
        this._dragging = true;
        this._dragX = e.getUILocation().x;
        this._dragLastX = this._dragX;
        this._dragLastT = performance.now();
        this._vel = 0;
        this._dragFrom = this._pos;
        this._phase = 0;
        this._idle = 0;
        this._vel = 0;
        this._slideLive = false;
    }

    private onTouchMove(e: EventTouch): void {
        const p = e.getUILocation();
        const mv = Math.max(Math.abs(p.x - this._downX), Math.abs(p.y - this._downY));
        if (mv > this.tapSlop) {
            this._tapped = false;
            if (this._dragging && !this._slideLive) {
                this._slideLive = true;
                if (this.onSlideStart) this.onSlideStart();
            }
        }
        if (!this._dragging) return;
        const x = p.x;
        const now = performance.now();
        const dt = (now - this._dragLastT) / 1000;
        if (dt > 0.001) {
            const v = -(x - this._dragLastX) / Math.max(1, this.spacing) / dt;
            this._vel = this._vel * 0.6 + v * 0.4;
        }
        this._dragLastX = x;
        this._dragLastT = now;
        this._pos = this._dragFrom - (x - this._dragX) / Math.max(1, this.spacing);
        this.layout(0);
    }

    private onTouchEnd(): void {
        const tapped = this._tapped;
        this._tapped = false;
        if (tapped) this.onTap();
        if (!this._dragging) return;
        this._dragging = false;
        const v = Math.max(-24, Math.min(24, this._vel));
        if (Math.abs(v) < this.stopVel * 0.5) {
            // 没甩起来：直接吸到最近一张，不出落定音（否则轻点一下也响）
            this.settleTo();
            return;
        }
        // 松手后按阻尼继续滑：速度指数衰减，位置是积出来的，不是「线性走到目标再停」
        this._vel = v;
        this._phase = 3;
        this._idle = 0;
    }

    /**
     * 滑行 → 吸附。滑行那一段位置靠每帧积分，读起来是「越滑越慢、最后轻轻一顿」；
     * 剩下的不到半张交给 0.2s 缓动。**停下这一刻**（不论是不是甩出去的）都回调一次，音频在那边收声。
     */
    private settleTo(): void {
        const target = Math.round(this._pos);
        const d = target - this._pos;
        this._fromPos = this._pos;
        this._toPos = target;
        this._moveDur = Math.max(0.08, Math.min(this.snapTime, Math.abs(d) * 0.16));
        this._phase = 1;
        this._t = 0;
        this._idle = 0;
        if (this.onSettle) this.onSettle();
        this._slideLive = false;
    }

    private onTouchCancel(): void {
        this._tapped = false;
        this.onTouchEnd();
    }

    private onTap(): void {
        if (this.burst) this.burst.burst();
        if (!this.tapToStore) return;
        if (this.bridge) this.bridge.openStore();
        EventBus.emit(GameEvent.CTA_CLICK);
    }

    private layout(pulse: number) {
        const n = this.items.length;
        for (let i = 0; i < n; i++) {
            const item = this.items[i];
            if (!item) continue;

            let d = this.norm(i - this._pos);
            if (d > n / 2) d -= n;
            const ad = Math.abs(d);
            const x = d * this.spacing;

            item.setPosition(x, 0, 0);
            item.active = Math.abs(x) < this.visibleRange;
            if (!item.active) continue;

            const f = Math.max(0, Math.min(1, 1 - ad / 2.2));
            const grow = ad <= 1 ? this.centerScale + (this.sideScale - this.centerScale) * ad : this.sideScale * Math.pow(this.shrink, ad - 1);
            const bump = ad < 0.01 ? pulse : 0;
            item.setScale(grow + bump * this.pulseScale, grow + bump * this.pulseScale, 1);
            // +1：0 号留给身后的粒子层（CenterBurst），卡片永远排在它之上
            item.setSiblingIndex(1 + Math.max(0, Math.min(n - 1, Math.round((1 - ad / 3) * (n - 1)))));
            this.applyGlow(item, f + bump * this.pulseGlow, bump);
        }
    }

    private applyGlow(item: Node, f: number, pulse: number) {
        const set = (name: string, base: number, span: number, extra: number) => {
            const n = item.getChildByName(name);
            const o = n && n.getComponent(UIOpacity);
            if (o) o.opacity = Math.min(255, base + span * Math.min(1, f) + extra * pulse);
        };
        set('Glow_3', 40, 40, 30);
        set('Glow_2', 90, 90, 60);
        set('Glow_1', 190, 60, 50);
    }
}
