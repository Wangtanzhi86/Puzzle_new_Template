import { _decorator, Button, Component, EventTouch, Node, Tween, tween, Vec2 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/** 按住之后挪动超过这么多（UI 像素）就当玩家在滚列表，不选关 */
const TAP_SLOP = 16;

/**
 * 选关。关卡按钮按 `items` 的顺序对应 0..n-1；点一下 → 抛 `LEVEL_SELECTED`（开场组件先接住那张图）→ 本节点隐藏。
 * 关卡内容本身的差异（换一层槽位 / 换图）由 `GameEntry` 收事件时决定，这里不碰玩法。
 *
 * 界面本身在 `Canvas/Change`，一屏两列三行、超出可滚（见 `tools/js/mount-level-select.js`）；
 * 所以按下后挪动超过 `TAP_SLOP` 就只当滚动，不算点选。
 */
@ccclass('LevelSelect')
export class LevelSelect extends Component {
    @property({ type: [Node], displayName: '关卡按钮（顺序即关卡序号）' })
    items: Node[] = [];

    @property({ displayName: '关卡总数', tooltip: '0 = 按按钮数量算；比按钮多出来的关卡暂时没有入口' })
    levelCount = 0;

    @property({ displayName: '锁图标路径', tooltip: '相对关卡按钮的路径，点未解锁的卡时晃它' })
    lockIconPath = 'Window/LockIcon';

    @property({ displayName: '锁标记路径', tooltip: '这个节点 active 即视为未解锁' })
    lockMarkPath = 'Window/Lock';

    @property({ displayName: '锁晃动角度（度）' })
    lockShakeAngle = 9;

    @property({ displayName: '锁晃动单程时长（秒）' })
    lockShakeTime = 0.07;

    @property({ displayName: '锁晃动来回次数' })
    lockShakeTimes = 3;

    /** 点了锁着的关卡、锁开始晃的那一刻（音频那边接一声）—— 不是 @property */
    onLockShake: (() => void) | null = null;

    private _picked = false;
    private _down = new Vec2();
    private _far = false;
    private _handlers: Array<{ start: (e: EventTouch) => void; move: (e: EventTouch) => void; end: () => void } | null> = [];

    get count (): number {
        return this.levelCount > 0 ? this.levelCount : this.items.length;
    }

    protected onLoad (): void {
        // 加载游戏后先亮选关，别让后面的玩法自己演起来
        this.node.active = true;
    }

    protected onEnable (): void {
        this._picked = false;
        this._handlers.length = 0;
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (!item) {
                this._handlers.push(null);
                continue;
            }
            const handler = {
                start: (e: EventTouch): void => {
                    this._down.set(e.getUILocation());
                    this._far = false;
                },
                move: (e: EventTouch): void => {
                    if (Vec2.distance(e.getUILocation(), this._down) > TAP_SLOP) this._far = true;
                },
                end: (): void => {
                    if (!this._far) this.pick(i);
                },
            };
            this._handlers.push(handler);
            item.on(Node.EventType.TOUCH_START, handler.start, this);
            item.on(Node.EventType.TOUCH_MOVE, handler.move, this);
            item.on(Node.EventType.TOUCH_END, handler.end, this);
        }
    }

    protected onDisable (): void {
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const handler = this._handlers[i];
            if (!item || !handler) continue;
            item.off(Node.EventType.TOUCH_START, handler.start, this);
            item.off(Node.EventType.TOUCH_MOVE, handler.move, this);
            item.off(Node.EventType.TOUCH_END, handler.end, this);
        }
        this._handlers.length = 0;
    }

    /** 重新亮出选关（目前只有开局一次，留给以后的「再选一关」） */
    show (): void {
        this._picked = false;
        this.node.active = true;
    }

    /** 玩家选定一关：先放流程往下走（开场要先把那张图接走），再把整棵选关节点收起来 */
    pick (index: number): void {
        if (this._picked) return;
        const item = this.items[index];
        const mark = item && item.getChildByPath(this.lockMarkPath);
        if (mark && mark.active) {
            this.shakeLock(item);
            return;
        }
        const button = this.items[index] ? this.items[index].getComponent(Button) : null;
        if (button && !button.interactable) return;
        this._picked = true;
        // 先抛事件：开场那一下要在这一拍把点中的 Window/Fill 按世界变换挪到全屏层，收早了图就跟着这棵树一起藏了
        EventBus.emit(GameEvent.LEVEL_SELECTED, index);
        this.node.active = false;
    }

    /** 未解锁的卡点一下：锁图标左右晃两下，不选关 */
    private shakeLock (item: Node): void {
        const icon = item.getChildByPath(this.lockIconPath);
        if (!icon) return;
        Tween.stopAllByTarget(icon);
        icon.angle = 0;
        const a = this.lockShakeAngle;
        const t = this.lockShakeTime;
        let tw = tween(icon);
        for (let i = 0; i < this.lockShakeTimes; i++) tw = tw.to(t, { angle: i % 2 === 0 ? a : -a });
        tw.to(t, { angle: 0 }).start();
        if (this.onLockShake) this.onLockShake();
    }
}
