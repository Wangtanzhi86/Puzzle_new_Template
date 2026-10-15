import { _decorator, Component, Input, Node, Sprite, Tween, UIOpacity, UITransform, Vec2, input, tween, v3 } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import type { PieceEntry } from '../gameplay/PiecePool';

const { ccclass, property } = _decorator;

/**
 * 空闲引导：手指在碎片池里点一下，拖着一个半透明副本把最前面那块碎片送到它的缺口，
 * 循环播；玩家一碰屏幕就立刻收掉，再空闲 `idleDelay` 秒从头来一遍，直到通关。
 *
 * 全程只是画面 —— 不碰碎片池、不发任何事件，副本是 `GuideLayer` 下的一个独立 Sprite。
 * 起点读碎片池第一块碎片的实时世界位置，终点读它自己那个槽位的 `worldCenter`，
 * 所以滚动、转屏、换关卡都不用改这里。
 *
 * 「玩家碰没碰屏幕」要走两条路才收得全：碎片池上的触摸被 `content` 认领（全局 `input`
 * 收不到，见 AGENTS.md §14），由 `DragController` 的 `PIECE_PICK` 顶替；屏幕空白处的
 * 触摸没人认领，走全局 `input`。两条路都只是「算有人操作」，不吃掉玩家自己的这一下。
 */
@ccclass('GuideController')
export class GuideController extends Component {
    @property({ type: Node, displayName: '引导根节点', tooltip: '副本与手指的容器，位移 tween 打的是它' })
    root: Node = null;

    @property({ type: Sprite, displayName: '半透明副本', tooltip: '贴图与尺寸每一遍都从池里那块碎片现读，场景里摆着的是编辑期占位' })
    ghost: Sprite = null;

    @property({ type: Sprite, displayName: '引导手指' })
    finger: Sprite = null;

    @property({ displayName: '空闲多久后显示（秒）' })
    idleDelay = 3;

    @property({ displayName: '两遍之间的间隔（秒）' })
    loopGap = 0.5;

    @property({ displayName: '点击提示时长（秒）' })
    tapTime = 0.3;

    @property({ displayName: '点击下沉距离（px）' })
    tapDepth = 14;

    @property({ displayName: '拖动时长（秒）' })
    moveTime = 1.1;

    @property({ displayName: '副本淡入淡出时长（秒）' })
    fadeTime = 0.18;

    @property({ displayName: '副本透明度（0-255）' })
    ghostOpacity = 140;

    @property({ displayName: '手指相对副本中心的偏移（px）' })
    fingerOffset = new Vec2(46, -52);

    private _data: SlotData[] = [];
    private _entries: PieceEntry[] = [];
    private _ghostUT: UITransform = null;
    private _ghostOpacity: UIOpacity = null;
    private _showing = false;
    private _done = false;
    /** 正在飞的动画段数。> 0 时计时器停住 —— 引导绝不盖在动画上 */
    private _holds = 0;

    protected onEnable(): void {
        this.hide();
        if (!FeatureFlags.guide) return;
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.POOL_BUILT, this.onPoolBuilt, this);
        EventBus.on(GameEvent.PIECE_PICK, this.onTouch, this);
        EventBus.on(GameEvent.LEVEL_COMPLETE, this.onComplete, this);
        EventBus.on(GameEvent.GAME_OVER, this.onComplete, this);
        // 系统接管 = 这一关不用玩家动手了，别再教
        EventBus.on(GameEvent.AUTO_PLAY, this.onComplete, this);
        EventBus.on(GameEvent.GUIDE_HOLD, this.onHold, this);
        EventBus.on(GameEvent.GUIDE_RESUME, this.onResume, this);
        input.on(Input.EventType.TOUCH_START, this.onTouch, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.POOL_BUILT, this.onPoolBuilt, this);
        EventBus.off(GameEvent.PIECE_PICK, this.onTouch, this);
        EventBus.off(GameEvent.LEVEL_COMPLETE, this.onComplete, this);
        EventBus.off(GameEvent.GAME_OVER, this.onComplete, this);
        EventBus.off(GameEvent.AUTO_PLAY, this.onComplete, this);
        EventBus.off(GameEvent.GUIDE_HOLD, this.onHold, this);
        EventBus.off(GameEvent.GUIDE_RESUME, this.onResume, this);
        input.off(Input.EventType.TOUCH_START, this.onTouch, this);
        this.hide();
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._data = data;
        this._holds = 0;
    }

    /** 池里第一块碎片就是这一遍的主角 */
    private onPoolBuilt(entries: PieceEntry[]): void {
        this._entries = entries;
        this.armIdle();
    }

    private onTouch = (): void => {
        if (this._done) return;
        this.hide();
        this.armIdle();
    };

    /** 通关、终局（`GAME_OVER`）、或者系统接管（`AUTO_PLAY`）—— 都不该再教了 */
    private onComplete = (): void => {
        this._done = true;
        this.hide();
    };

    /** 某段修复动画开演：先把在等的计时器撤掉，动画期间不会再弹 */
    private onHold = (): void => {
        this._holds++;
        this.unschedule(this.show);
    };

    /** 动画演完：放行，`idleDelay` 从头起算（是「暂停 + 重来」，不是接着上次剩的时间） */
    private onResume = (): void => {
        if (this._holds > 0) this._holds--;
        if (this._holds === 0) this.armIdle();
    };

    private armIdle(): void {
        if (this._done || this._holds > 0) return;
        this.unschedule(this.show);
        this.scheduleOnce(this.show, this.idleDelay);
    }

    private show = (): void => {
        if (this._done || this._showing) return;
        if (!this.root || !this.ghost || !this.finger) return;
        this._ghostUT = this.ghost.node.getComponent(UITransform);
        this._ghostOpacity = this.ghost.node.getComponent(UIOpacity);
        if (!this._ghostUT || !this._ghostOpacity) return;
        this._showing = true;
        this.root.active = true;
        this.next();
    };

    /** 一遍播完接下一遍，和 `show` 分开是因为循环期间 `_showing` 一直是 true */
    private next = (): void => {
        if (!this._showing) return;
        const entry = this._entries[0];
        const data = entry && this._data[entry.slotIndex];
        if (!entry || !data) {
            this.hide();
            return;
        }
        this.play(entry, data);
    };

    /** 手指在池里点一下 → 副本淡入 → 两个一起拖到缺口中心 → 副本淡出 */
    private play(entry: PieceEntry, data: SlotData): void {
        const piece = entry.piece;
        const ut = piece.getComponent(UITransform);
        const base = piece.worldScale.y / this.root.worldScale.y;

        this.root.setWorldPosition(piece.worldPosition);
        this.ghost.spriteFrame = piece.getComponent(Sprite).spriteFrame;
        this._ghostUT.setContentSize(ut.width, ut.height);
        this.ghost.node.setScale(base, base, 1);
        this._ghostOpacity.opacity = 0;

        const off = this.fingerOffset;
        this.finger.node.setPosition(off.x, off.y, 0);
        tween(this.finger.node)
            .to(this.tapTime / 2, { position: v3(off.x, off.y - this.tapDepth, 0) }, { easing: 'quadOut' })
            .to(this.tapTime / 2, { position: v3(off.x, off.y, 0) }, { easing: 'quadIn' })
            .start();

        // 副本要长到「修复后那张图」那么大（和 `PiecePool.carryScaleOf` 同一个算法）：
        // 两边都换成世界高度再比，比值乘回副本的本地尺寸，屏幕上正好等于修复后的图
        const far = base * (data.slot.carryHeight / (ut.height * piece.worldScale.y));
        this.scheduleOnce(() => {
            tween(this._ghostOpacity).to(this.fadeTime, { opacity: this.ghostOpacity }).start();
            tween(this.root).to(this.moveTime, { worldPosition: data.slot.worldCenter }, { easing: 'sineInOut' }).start();
            tween(this.ghost.node).to(this.moveTime, { scale: v3(far, far, 1) }, { easing: 'sineInOut' }).start();
            this.scheduleOnce(this.leave, this.moveTime);
        }, this.tapTime);
    }

    private leave = (): void => {
        tween(this._ghostOpacity)
            .to(this.fadeTime, { opacity: 0 })
            .call(() => { if (this._showing) this.scheduleOnce(this.next, this.loopGap); })
            .start();
    };

    private hide(): void {
        this._showing = false;
        this.unscheduleAllCallbacks();
        if (this.root) {
            Tween.stopAllByTarget(this.root);
            this.root.active = false;
        }
        if (this.ghost) Tween.stopAllByTarget(this.ghost.node);
        if (this._ghostOpacity) Tween.stopAllByTarget(this._ghostOpacity);
        if (this.finger) Tween.stopAllByTarget(this.finger.node);
    }
}
