import { _decorator, Component, Node, Sprite, UITransform } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { DragGlowVisual } from '../../ReusableDragFx/DragGlowVisual';

const { ccclass, property } = _decorator;

/**
 * 「拖动柔光 + 光点」的驱动器（ReusableDragFx 那套材质 / 粒子）。
 *
 * 常驻 `EffectLayer` 的**只有一套**光效（`DragGlowFx`，从 ReusableDragFx 的样板拖进来的静态节点，
 * 编辑器里看得见），每次拿起碎片时晚绑定到那块碎片上 —— 碎片是池化现建的节点，做不了预制体绑定；
 * 一套共享也省掉「每块一块粒子系统」。
 * 打开 `FeatureFlags.dragFx` 时它取代「拖动亮边」（PieceGlow）与「拖动拖尾」（TrailEmitter）。
 */
@ccclass('DragGlowDriver')
export class DragGlowDriver extends Component {
    @property({ displayName: '光效节点名', tooltip: 'EffectLayer 下那棵 DragGlowFx（ReusableDragFx 的拖入实例）' })
    fxNodeName = 'DragGlowFx';

    private _visual: DragGlowVisual = null;

    protected onLoad(): void {
        if (!FeatureFlags.dragFx) return;
        const fx = this.node.getChildByName(this.fxNodeName);
        this._visual = fx ? fx.getComponent(DragGlowVisual) : null;
    }

    protected onEnable(): void {
        if (!FeatureFlags.dragFx) return;
        EventBus.on(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.on(GameEvent.PIECE_SNAP_SUCCESS, this.onRelease, this);
        EventBus.on(GameEvent.PIECE_SNAP_FAIL, this.onRelease, this);
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onRelease, this);
        // 终局 / 系统接管时不发 SNAP_FAIL（DragController.takeOver 只把碎片放回去），得自己收
        EventBus.on(GameEvent.GAME_OVER, this.onAbort, this);
        EventBus.on(GameEvent.AUTO_PLAY, this.onAbort, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.off(GameEvent.PIECE_SNAP_SUCCESS, this.onRelease, this);
        EventBus.off(GameEvent.PIECE_SNAP_FAIL, this.onRelease, this);
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onRelease, this);
        EventBus.off(GameEvent.GAME_OVER, this.onAbort, this);
        EventBus.off(GameEvent.AUTO_PLAY, this.onAbort, this);
        if (this._visual) this._visual.clear();
    }

    private onPick(piece: Node): void {
        if (!this._visual) return;
        const sprite = piece.getComponent(Sprite);
        const frame = sprite && sprite.spriteFrame;
        if (!frame || !this._visual.bind(sprite, piece.getComponent(UITransform), frame)) return;
        this._visual.beginDrag();
    }

    private onRelease(): void {
        if (this._visual) this._visual.endDrag();
    }

    private onAbort(): void {
        if (this._visual) this._visual.clear();
    }
}
