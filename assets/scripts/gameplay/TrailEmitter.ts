import { _decorator, Component, Node, Sprite, UIOpacity, UITransform, Vec3, tween, v3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { FeatureFlags } from '../config/FeatureFlags';
import { PoolManager } from '../core/PoolManager';
import { makeDotFrame } from '../core/DotTexture';

const { ccclass, property } = _decorator;

/**
 * 拖拽拖尾。挂在 EffectLayer 上 —— 光点得留在原地，跟着碎片走就成不了尾。
 *
 * 按位移发射而不是按时间：手停下来光点就不该再冒，快甩时才密。发射点沿着
 * 上一颗到当前位置的连线补齐，不然手速快的时候会甩出一串断开的点。
 */
@ccclass('TrailEmitter')
export class TrailEmitter extends Component {
    @property({ displayName: '发射步长（px）', tooltip: '碎片每走这么远冒一颗光点' })
    step = 22;

    @property({ displayName: '光点存活时长（秒）' })
    life = 0.4;

    @property({ displayName: '光点尺寸（px）' })
    dotSize = 28;

    @property({ displayName: '单帧最多补几颗', tooltip: '甩得快时封顶，免得一帧冒出一长串' })
    maxPerFrame = 6;

    private static readonly KEY = 'trail-dot';
    private _pool = new PoolManager();
    private _piece: Node = null;
    private _at = new Vec3();
    private _hit = new Vec3();

    protected onLoad(): void {
        if (!FeatureFlags.trail) return;
        const frame = makeDotFrame();
        this._pool.register(TrailEmitter.KEY, () => {
            const node = new Node('TrailDot');
            node.setParent(this.node);
            node.addComponent(UITransform).setContentSize(this.dotSize, this.dotSize);
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame;
            node.addComponent(UIOpacity);
            return node;
        });
    }

    protected onEnable(): void {
        if (!FeatureFlags.trail) return;
        EventBus.on(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.on(GameEvent.PIECE_SNAP_SUCCESS, this.onRelease, this);
        EventBus.on(GameEvent.PIECE_SNAP_FAIL, this.onRelease, this);
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onRelease, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.off(GameEvent.PIECE_SNAP_SUCCESS, this.onRelease, this);
        EventBus.off(GameEvent.PIECE_SNAP_FAIL, this.onRelease, this);
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onRelease, this);
        this._piece = null;
    }

    protected update(): void {
        if (!this._piece) return;
        const to = this._piece.worldPosition;
        for (let i = 0; i < this.maxPerFrame; i++) {
            const d = Vec3.distance(this._at, to);
            if (d < this.step) return;
            Vec3.lerp(this._hit, this._at, to, this.step / d);
            this.spawn(this._hit);
            this._at.set(this._hit);
        }
    }

    private onPick(piece: Node): void {
        this._piece = piece;
        this._at.set(piece.worldPosition);
    }

    private onRelease(): void {
        this._piece = null;
    }

    private spawn(at: Vec3): void {
        const node = this._pool.get(TrailEmitter.KEY);
        node.setParent(this.node);
        node.setWorldPosition(at);
        node.setScale(1, 1, 1);

        const opacity = node.getComponent(UIOpacity);
        opacity.opacity = 255;
        tween(node).to(this.life, { scale: v3(0.25, 0.25, 1) }, { easing: 'quadOut' }).start();
        tween(opacity)
            .to(this.life, { opacity: 0 }, { easing: 'quadOut' })
            .call(() => { this._pool.put(TrailEmitter.KEY, node); })
            .start();
    }
}
