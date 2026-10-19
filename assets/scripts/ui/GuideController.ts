import { _decorator, Component, Input, Node, Sprite, Tween, UIOpacity, UITransform, Vec2, input, tween, v3 } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import type { PieceEntry } from '../gameplay/PiecePool';

const { ccclass, property } = _decorator;

/**
 * 空闲引导：手指在碎片池里点一下，拖着一个半透明副本把最前面那块碎片送到它的缺口，
 * 循环播；玩家一碰屏幕就立刻收掉，再空闲一段延迟后从头来一遍，直到通关。
 *
 * 编排对齐 CopyPuzzle 的 `TutorialController`：
 * 第一次 0.5s（`firstDelay`）、之后 3.5s（`idleDelay`）才出现；**拖动途中手指/副本的大小与透明度都不变**，
 * 只在**到位那一刻**手指做一次缩放脉冲再淡出、副本同时淡出，等 `loopGap` 后重播。
 * 收起时整棵根节点 0.3s（`hideTime`）淡出再隐藏，不是硬切。
 *
 * 全程只是画面 —— 不碰碎片池、不发任何事件，副本是 `GuideLayer` 下的一个独立 Sprite。
 * 起点读碎片池第一块碎片的实时世界位置，终点读它自己那个槽位的 `worldCenter`，
 * 所以滚动、换关卡都不用改这里；转屏时画布尺寸会变 —— 正在飞的那一遍由 `onOrientation` 停掉重来
 * （Tween 抓的是数值快照，不重来就会飞向旧位置）。
 *
 * 「玩家碰没碰屏幕」要走两条路才收得全：碎片池上的触摸被 `content` 认领（全局 `input`
 * 收不到，见 AGENTS.md §14），由 `DragController` 的 `PIECE_PICK` 顶替；屏幕空白处的
 * 触摸没人认领，走全局 `input`。池子条带里按在空白处两条都收不到 —— 把 `poolTouch` 指到池子的
 * `content` 就能补上这一路。所有路都只是「算有人操作」，不吃掉玩家自己的这一下。
 */
@ccclass('GuideController')
export class GuideController extends Component {
    @property({ type: Node, displayName: '引导根节点', tooltip: '副本与手指的容器，位移 tween 打的是它' })
    root: Node = null;

    @property({ type: Sprite, displayName: '半透明副本', tooltip: '贴图与尺寸每一遍都从池里那块碎片现读，场景里摆着的是编辑期占位' })
    ghost: Sprite = null;

    @property({ type: Sprite, displayName: '引导手指' })
    finger: Sprite = null;

    @property({ type: Node, displayName: '碎片池触摸区', tooltip: '填池子的 content：按在碎片池条带的空白处也会收掉引导（那一带的触摸被 content 认领，全局 input 收不到）。留空只认全局触摸 + PIECE_PICK' })
    poolTouch: Node = null;

    @property({ displayName: '第一次出现前等待（秒）', tooltip: '对齐 CopyPuzzle 的 firstDelay' })
    firstDelay = 0.5;

    @property({ displayName: '之后每次出现前等待（秒）', tooltip: '对齐 CopyPuzzle 的 delay' })
    idleDelay = 3.5;

    @property({ displayName: '两遍之间的间隔（秒）', tooltip: '到位、淡完之后等这么久再重播（CopyPuzzle 的 moveInterval）' })
    loopGap = 1.5;

    @property({ displayName: '拖动时长（秒）' })
    moveTime = 1;

    @property({ displayName: '副本透明度（0-255）', tooltip: '拖动途中恒定，不再淡入淡出' })
    ghostOpacity = 180;

    @property({ displayName: '收起淡出时长（秒）', tooltip: '玩家一碰屏幕：整棵根节点淡出这么久再隐藏' })
    hideTime = 0.3;

    @property({ displayName: '副本到位后淡出时长（秒）' })
    dragableFadeTime = 0.2;

    @property({ displayName: '手指到位脉冲：横向比例' }) pulseScaleX = 0.853;
    @property({ displayName: '手指到位脉冲：纵向比例' }) pulseScaleY = 0.883;
    @property({ displayName: '手指到位脉冲：单程时长（秒）' }) pulseTime = 0.25;
    @property({ displayName: '手指淡出时长（秒）', tooltip: '脉冲回弹之后才开始淡' }) handFadeTime = 0.1667;

    @property({ displayName: '手指缩放', tooltip: '手指节点每遍都会按这个值重设 scale（场景里摆的 0.5 会被覆盖）；到位脉冲是相对它的乘数' })
    fingerScale = 1;

    @property({ displayName: '副本缩放', tooltip: '副本整体（起手与拖到缺口后的终点）等比再乘这个值；不填 = 和池里那块碎片、缺口修复图同大' })
    ghostScale = 1;

    @property({ displayName: '手指相对副本中心的偏移（px）' })
    fingerOffset = new Vec2(46, 0);

    private _data: SlotData[] = [];
    private _entries: PieceEntry[] = [];
    private _ghostUT: UITransform = null;
    private _ghostOpacity: UIOpacity = null;
    private _rootOpacity: UIOpacity = null;
    private _fingerOpacity: UIOpacity = null;
    /** 手指在场景里摆的 scale（0.5）：只在第一遍记住，之后每遍都按它 × `fingerScale` 重设 */
    private _fingerBase = 0;
    private _showing = false;
    private _done = false;
    /** 第一次出现用 `firstDelay`，之后用 `idleDelay` */
    private _wasShown = false;
    /** 正在飞的动画段数。> 0 时计时器停住 —— 引导绝不盖在动画上 */
    private _holds = 0;

    protected onEnable(): void {
        this.hide(true);
        if (!FeatureFlags.guide) return;
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.POOL_BUILT, this.onPoolBuilt, this);
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        EventBus.on(GameEvent.PIECE_PICK, this.onTouch, this);
        EventBus.on(GameEvent.LEVEL_COMPLETE, this.onComplete, this);
        EventBus.on(GameEvent.GAME_OVER, this.onComplete, this);
        // 系统接管 = 这一关不用玩家动手了，别再教
        EventBus.on(GameEvent.AUTO_PLAY, this.onComplete, this);
        EventBus.on(GameEvent.GUIDE_HOLD, this.onHold, this);
        EventBus.on(GameEvent.GUIDE_RESUME, this.onResume, this);
        input.on(Input.EventType.TOUCH_START, this.onTouch, this);
        if (this.poolTouch) this.poolTouch.on(Node.EventType.TOUCH_START, this.onTouch, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.POOL_BUILT, this.onPoolBuilt, this);
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        EventBus.off(GameEvent.PIECE_PICK, this.onTouch, this);
        EventBus.off(GameEvent.LEVEL_COMPLETE, this.onComplete, this);
        EventBus.off(GameEvent.GAME_OVER, this.onComplete, this);
        EventBus.off(GameEvent.AUTO_PLAY, this.onComplete, this);
        EventBus.off(GameEvent.GUIDE_HOLD, this.onHold, this);
        EventBus.off(GameEvent.GUIDE_RESUME, this.onResume, this);
        input.off(Input.EventType.TOUCH_START, this.onTouch, this);
        if (this.poolTouch) this.poolTouch.off(Node.EventType.TOUCH_START, this.onTouch, this);
        this.hide(true);
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

    /** 动画演完：放行，延迟从头起算（是「暂停 + 重来」，不是接着上次剩的时间） */
    private onResume = (): void => {
        if (this._holds > 0) this._holds--;
        if (this._holds === 0) this.armIdle();
    };

    /** 转屏 / 撑满：画布尺寸变了，正在飞的那一遍拿的都是旧世界坐标（起点是碎片、终点是缺口中心，
     *  两个都会跟着 Widget 重排挪位）。**不能只重设 tween 终点** —— Tween 不支持改目标值。所以停掉这一遍，
     *  立刻从 `show()` 重来：`play()` 里起点终点都是现读的，重来一遍自然就对准了新位置。 */
    private onOrientation = (): void => {
        if (!this._showing) return;
        this.stopTweens();
        this._showing = false;
        if (this.root) this.root.active = false;
        this.show();
    };

    private armIdle(): void {
        if (this._done || this._holds > 0) return;
        this.unschedule(this.show);
        this.scheduleOnce(this.show, this._wasShown ? this.idleDelay : this.firstDelay);
    }

    private show = (): void => {
        if (this._done || this._showing) return;
        if (!this.root || !this.ghost || !this.finger) return;
        this._ghostUT = this.ghost.node.getComponent(UITransform);
        this._ghostOpacity = this.opacityOf(this.ghost.node);
        this._rootOpacity = this.opacityOf(this.root);
        this._fingerOpacity = this.opacityOf(this.finger.node);
        if (!this._ghostUT) return;
        this._showing = true;
        this._wasShown = true;
        this.root.active = true;
        this._rootOpacity.opacity = 255;
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

    /** 拖：副本与手指从池里那块碎片的实时位置，沿 sineInOut 走到缺口中心；
     *  途中大小/透明度都不变，到位才由 `arrive` 收尾（对齐 CopyPuzzle 的 `_runMoveLoop`） */
    private play(entry: PieceEntry, data: SlotData): void {
        const piece = entry.piece;
        const ut = piece.getComponent(UITransform);
        const base = (piece.worldScale.y / this.root.worldScale.y) * this.ghostScale;

        this.root.setWorldPosition(piece.worldPosition);
        this.ghost.spriteFrame = piece.getComponent(Sprite).spriteFrame;
        this._ghostUT.setContentSize(ut.width, ut.height);
        this.ghost.node.setScale(base, base, 1);
        this._ghostOpacity.opacity = this.ghostOpacity;

        if (this._fingerBase <= 0) this._fingerBase = this.finger.node.scale.x;
        const fs = this._fingerBase * this.fingerScale;
        this.finger.node.setScale(fs, fs, 1);
        this.finger.node.setPosition(this.fingerOffset.x, this.fingerOffset.y, 0);
        this._fingerOpacity.opacity = 255;

        // 副本要长到「修复后那张图」那么大（和 `PiecePool.carryScaleOf` 同一个算法）：
        // 两边都换成世界高度再比，比值乘回副本的本地尺寸，屏幕上正好等于修复后的图
        const far = base * (data.slot.carryHeight / (ut.height * piece.worldScale.y));
        tween(this.root).to(this.moveTime, { worldPosition: data.slot.worldCenter }, { easing: 'sineInOut' }).start();
        tween(this.ghost.node).to(this.moveTime, { scale: v3(far, far, 1) }, { easing: 'sineInOut' }).start();
        this.scheduleOnce(this.arrive, this.moveTime);
    }

    /** 到位那一刻：手指按一下的缩放脉冲 → 淡出；副本同时淡出；等 `loopGap` 再重播 */
    private arrive = (): void => {
        if (!this._showing) return;
        tween(this.finger.node)
            .to(this.pulseTime, { scale: v3(this._fingerBase * this.fingerScale * this.pulseScaleX, this._fingerBase * this.fingerScale * this.pulseScaleY, 1) }, { easing: 'sineInOut' })
            .to(this.pulseTime, { scale: v3(this._fingerBase * this.fingerScale, this._fingerBase * this.fingerScale, 1) }, { easing: 'sineInOut' })
            .start();
        tween(this._fingerOpacity)
            .delay(this.pulseTime)
            .to(this.handFadeTime, { opacity: 0 }, { easing: 'linear' })
            .start();
        tween(this._ghostOpacity).to(this.dragableFadeTime, { opacity: 0 }, { easing: 'linear' }).start();
        this.scheduleOnce(this.next, this.loopGap);
    };

    private opacityOf(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    }

    /** 收起：玩家一碰就调它。`immediate` 用于初始化 / 关组件，不演淡出 */
    private hide(immediate = false): void {
        const wasShowing = this._showing;
        this._showing = false;
        this.unscheduleAllCallbacks();
        this.stopTweens();
        if (!this.root) return;
        if (immediate || !wasShowing || !this.root.active || this.hideTime <= 0) {
            this.root.active = false;
            return;
        }
        const op = this._rootOpacity || (this._rootOpacity = this.opacityOf(this.root));
        tween(op)
            .to(this.hideTime, { opacity: 0 })
            .call(() => {
                this.root.active = false;
                op.opacity = 255;
            })
            .start();
    }

    private stopTweens(): void {
        if (this.root) {
            Tween.stopAllByTarget(this.root);
            Tween.stopAllByTarget(this._rootOpacity);
        }
        if (this.ghost) {
            Tween.stopAllByTarget(this.ghost.node);
            Tween.stopAllByTarget(this._ghostOpacity);
        }
        if (this.finger) {
            Tween.stopAllByTarget(this.finger.node);
            Tween.stopAllByTarget(this._fingerOpacity);
        }
    }
}
