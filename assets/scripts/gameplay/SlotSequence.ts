import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceSlot } from '../level/PieceSlot';

const { ccclass, property } = _decorator;

/**
 * 某一格修好之后，在本节点上把一组序列帧播一遍，停在最后一帧。
 *
 * 和 `RepairReveal` 的区别：`RepairReveal` 是在缺口位置临时建一个节点播序列帧；
 * 这里播的是场景里本来就摆好的节点（比如小三），播完不销毁、也不再换回别的图。
 *
 * 帧尺寸直接沿用 Sprite 的 `TRIMMED`：每帧只改 `spriteFrame`，节点位置和缩放不动。
 */
@ccclass('SlotSequence')
export class SlotSequence extends Component {
    @property({ type: PieceSlot, displayName: '触发槽位', tooltip: '这一格修好时开始播' })
    watch: PieceSlot = null;

    @property({ type: [SpriteFrame], displayName: '序列帧', tooltip: '按下标播一次；在资源管理器里框选后拖进来' })
    frames: SpriteFrame[] = [];

    @property({ displayName: '每帧时长（秒）', tooltip: '17 帧填 0.06 约 1 秒' })
    frameInterval = 0.06;

    @property({ displayName: '延迟（秒）' })
    delay = 0;

    @property({ displayName: '播放前先藏起画面', tooltip: '节点保持激活才能收到事件；勾上后只把 Sprite 关掉，第一次播放时再打开' })
    hideUntilPlay = false;

    @property({ displayName: '等揭晓播完再播', tooltip: '勾上后不在吸附当刻起播，等这一格的 PIECE_SHOWN（揭晓动画演完）再播' })
    waitShown = false;

    @property({ type: [Node], displayName: '播放时藏掉这些节点', tooltip: '起播那一刻把它们 active 关掉；比如换成序列帧角色时，收掉原修复图和旧角色' })
    hideOnPlay: Node[] = [];

    private _index = -1;
    private _sprite: Sprite = null;
    private _elapsed = 0;
    private _frame = 0;
    private _playing = false;
    private _guideHeld = false;

    protected onLoad(): void {
        this._sprite = this.getComponent(Sprite);
        if (this.hideUntilPlay && this._sprite) this._sprite.enabled = false;
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_REPAIRED, this.onRepaired, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        this.unschedule(this.play);
        this._playing = false;
        this.releaseGuide();
    }

    private onLevelBuilt(data: SlotData[]): void {
        this.unschedule(this.play);
        this._playing = false;
        this.releaseGuide();
        if (!this.watch) return;
        for (let i = 0; i < data.length; i++) {
            if (data[i].slot === this.watch) {
                this._index = i;
                if (this._sprite && this.frames.length) this._sprite.spriteFrame = this.frames[0];
                return;
            }
        }
    }

    private onRepaired(slotIndex: number): void {
        if (this.waitShown) return;
        this.trigger(slotIndex);
    }

    private onShown(slotIndex: number): void {
        if (!this.waitShown) return;
        this.trigger(slotIndex);
    }

    private trigger(slotIndex: number): void {
        if (this._playing || slotIndex !== this._index || !this._sprite || !this.frames.length) return;
        this.holdGuide();
        if (this.delay > 0) this.scheduleOnce(this.play, this.delay);
        else this.play();
    }

    private play = (): void => {
        for (const node of this.hideOnPlay) if (node) node.active = false;
        if (this._sprite) this._sprite.enabled = true;
        this._elapsed = 0;
        this._frame = 0;
        this._playing = true;
        this._sprite.spriteFrame = this.frames[0];
    };

    protected update(dt: number): void {
        if (!this._playing) return;
        this._elapsed += dt;
        const step = Math.max(0.016, this.frameInterval);
        const i = Math.min(Math.floor(this._elapsed / step), this.frames.length - 1);
        if (i !== this._frame) {
            this._frame = i;
            this._sprite.spriteFrame = this.frames[i];
        }
        if (i === this.frames.length - 1 && this._elapsed >= step * (this.frames.length - 1)) {
            this._playing = false;
            this.releaseGuide();
        }
    }

    private holdGuide(): void {
        if (this._guideHeld) return;
        this._guideHeld = true;
        EventBus.emit(GameEvent.GUIDE_HOLD);
        EventBus.emit(GameEvent.DRAG_HOLD);
    }

    private releaseGuide(): void {
        if (!this._guideHeld) return;
        this._guideHeld = false;
        EventBus.emit(GameEvent.GUIDE_RESUME);
        EventBus.emit(GameEvent.DRAG_UNLOCK);
    }
}
