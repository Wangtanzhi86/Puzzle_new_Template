import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, UIOpacity, tween, Vec2 } from 'cc';
import { EventTrigger } from './EventTrigger';

const { ccclass, property } = _decorator;

/**
 * 炉火：两张 Sprite 交叉淡入淡出的「翻页动画」，不是粒子。
 *
 * 移植自 CopyPuzzle 的 `effects/FireAction.ts`（原版 FireAction class id b8b600NP/9Mlbh+PTai/I90）。
 * 原版逻辑：两个 sprite 各跑一条 show(opacity→255) / hide(opacity→minOpacity) 的 linear 补间，
 * 每 `changeInterval` 秒换一次帧、交换前后关系 —— 所以看起来是火苗在"翻"。
 *
 * 和 CopyPuzzle 那版的差别：参数全部 @property 化，起停改由事件触发（`EventTrigger`），
 * 面板上可以改帧序列 / 最低不透明度 / 淡入淡出时长 / 翻页间隔 / 缩放 / 锚点 / 起停事件。
 *
 * 帧顺序照原版：数组最后一个是最先显示的那帧（原版预置 sprite 显示 0020-fire-1）。
 */
@ccclass('FireAction')
export class FireAction extends Component {
    @property({ type: [SpriteFrame], displayName: '火焰帧序列', tooltip: '按「后显示的在前」放：原版是 fire-1 → fire-4 倒序，数组最后一个先出场' })
    frames: SpriteFrame[] = [];

    @property({ displayName: '最低不透明度', tooltip: '旧帧淡到多少（0-255）：40 = 留一点底，不会全黑' })
    minOpacity = 40;

    @property({ displayName: '淡入淡出时长（秒）' })
    fadeTime = 1;

    @property({ displayName: '翻页间隔（秒）' })
    changeInterval = 1;

    @property({ displayName: '缩放' })
    spriteScale = 1;

    @property({ displayName: '锚点' })
    spriteAnchor = new Vec2(0.5, 0.5);

    // ---- 起停条件 ----

    @property({ displayName: '进场就播', tooltip: '打勾 = onEnable 立刻开火；炉火一般不打勾，等事件' })
    playOnLoad = false;

    @property({ type: [String], displayName: '启动事件（全部到齐）', tooltip: '填 EventBus 事件名，如 PIECE_REPAIRED。留空 = 只靠「进场就播」' })
    startEvents: string[] = [];

    @property({ displayName: '启动延迟（秒）' })
    startDelay = 0;

    @property({ type: [String], displayName: '停止事件（任一到达）' })
    stopEvents: string[] = [];

    @property({ displayName: '停止延迟（秒）' })
    stopDelay = 0;

    @property({ displayName: '只认槽位（-1 = 任意）' })
    slotIndex = -1;

    private _sprites: Node[] = [];
    private _ops: UIOpacity[] = [];
    private _idx = 0;
    private _frame = 0;
    private _time = 0;
    private _running = false;
    private _created = false;
    private _trigger: EventTrigger | null = null;

    onEnable() {
        if (!this._trigger) {
            this._trigger = new EventTrigger(this, {
                playOnLoad: this.playOnLoad,
                startEvents: this.startEvents,
                startDelay: this.startDelay,
                stopEvents: this.stopEvents,
                stopDelay: this.stopDelay,
                slotIndex: this.slotIndex,
            }, () => this.play(), () => this.stop());
        }
        this._trigger.start();
    }

    onDisable() {
        if (this._trigger) this._trigger.dispose();
        this._trigger = null;
        this._running = false;
    }

    private _createSprites() {
        if (this._created) return;
        this._created = true;
        for (let i = 0; i < 2; i++) {
            const n = new Node(i === 0 ? 'FireSpriteA' : 'FireSpriteB');
            n.parent = this.node;
            n.layer = this.node.layer;
            const ui = n.addComponent(UITransform);
            ui.setAnchorPoint(this.spriteAnchor.x, this.spriteAnchor.y);
            const sp = n.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            const op = n.addComponent(UIOpacity);
            op.opacity = i === 0 ? 255 : 0;
            n.setScale(this.spriteScale, this.spriteScale, 1);
            n.active = false;
            this._sprites.push(n);
            this._ops.push(op);
        }
        // 预置那张显示帧数组最后一个（原版 0020-fire-1）
        this._frame = Math.max(0, this.frames.length - 1);
        this._setFrame(this._sprites[0], this.frames[this._frame]);
    }

    private _setFrame(n: Node, sf: SpriteFrame | null | undefined) {
        if (!sf) return;
        const sp = n.getComponent(Sprite)!;
        sp.spriteFrame = sf;
        n.getComponent(UITransform)!.setContentSize(sf.rect.width, sf.rect.height);
    }

    private _changeSprites() {
        if (this.frames.length === 0) return;
        const cur = this._sprites[this._idx];
        const curOp = this._ops[this._idx];
        tween(curOp).stop();
        tween(curOp).to(this.fadeTime, { opacity: this.minOpacity }, { easing: 'linear' }).start();
        cur.setSiblingIndex(0);
        this._idx = (this._idx + 1) % 2;
        this._frame = (this._frame + 1) % this.frames.length;
        const next = this._sprites[this._idx];
        const nextOp = this._ops[this._idx];
        next.setSiblingIndex(1);
        next.active = true;
        this._setFrame(next, this.frames[this._frame]);
        tween(nextOp).stop();
        tween(nextOp).to(this.fadeTime, { opacity: 255 }, { easing: 'linear' }).start();
    }

    /** 开火（原版 run()） */
    play() {
        this._createSprites();
        for (const n of this._sprites) n.active = true;
        this._running = true;
        this._time = 0;
        this.enabled = true;
    }

    /** 只停翻页，不隐藏（原版 stop()） */
    stop() {
        this._running = false;
    }

    update(dt: number) {
        if (!this._running) return;
        this._time += dt;
        if (this._time >= this.changeInterval) {
            this._time = 0;
            this._changeSprites();
        }
    }
}
