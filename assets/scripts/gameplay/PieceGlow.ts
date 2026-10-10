import { _decorator, Component, EffectAsset, Material, Node, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, tween, v2, v4 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 亮边的可调参数。碎片是运行时建的节点，参数没地方挂，所以由 PieceFactory 带着一份下来。
 * 两个比例都相对**碎片高度** —— 碎片在池里只有素材原始像素那么大、拖起来按缺口放大到
 * 六百多，用绝对像素的话两种状态下细得差三倍多。
 */
@ccclass('GlowConfig')
export class GlowConfig {
    @property({ displayName: '淡入时长（秒）' })
    fadeIn = 0.12;

    @property({ displayName: '淡出时长（秒）' })
    fadeOut = 0.18;

    @property({ displayName: '呼吸一次（秒）', tooltip: '亮度 255 ↔ 175 走半圈的时间' })
    pulseTime = 0.5;

    @property({ displayName: '光晕外扩比', tooltip: '相对碎片高度。贴着 quad 边的轮廓得有地方画，不然会被裁平' })
    marginRatio = 0.03;

    @property({ displayName: '光边宽度比', tooltip: '相对碎片高度' })
    rimRatio = 0.01;
}

/**
 * 拖动时碎片边上的白色亮光。
 *
 * 光晕是一个比碎片 quad 大一圈的子节点：贴着 quad 边的那段轮廓得有地方画，
 * 不然会被裁平。它采样前先用 uvScale 把 uv 缩回碎片自己的坐标系，保证光晕轮廓
 * 和碎片严丝合缝；uvScale 和采样步长都按碎片尺寸算，两块碎片不能共用材质。
 */
@ccclass('PieceGlow')
export class PieceGlow extends Component {
    private _view: Sprite = null;
    private _opacity: UIOpacity = null;
    private _mat: Material = null;
    private _cfg: GlowConfig = null;

    /** PieceFactory 每次把碎片从池里取出来时调：池里的节点会被挪给另一张图，尺寸和贴图都得重算 */
    apply(effect: EffectAsset, frame: SpriteFrame, w: number, h: number, cfg: GlowConfig): void {
        this._cfg = cfg;
        const margin = h * cfg.marginRatio;
        const gw = w + margin * 2;
        const gh = h + margin * 2;
        const rim = h * cfg.rimRatio;

        if (!this._mat) {
            this._mat = new Material();
            this._mat.initialize({ effectAsset: effect, defines: { USE_TEXTURE: true } });

            const node = new Node('Glow');
            node.setParent(this.node);
            node.addComponent(UITransform);
            this._view = node.addComponent(Sprite);
            this._view.sizeMode = Sprite.SizeMode.CUSTOM;
            this._view.customMaterial = this._mat;
            this._opacity = node.addComponent(UIOpacity);
            this._opacity.opacity = 0;
            node.active = false;
        }

        this._view.spriteFrame = frame;
        this._view.node.getComponent(UITransform).setContentSize(gw, gh);
        this._mat.setProperty('uvScale', v2(w / gw, h / gh));
        this._mat.setProperty('glowParams', v4(1, rim / w, rim / h, 0.6));
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.on(GameEvent.PIECE_SNAP_SUCCESS, this.onRelease, this);
        EventBus.on(GameEvent.PIECE_SNAP_FAIL, this.onRelease, this);
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.PIECE_PICK, this.onPick, this);
        EventBus.off(GameEvent.PIECE_SNAP_SUCCESS, this.onRelease, this);
        EventBus.off(GameEvent.PIECE_SNAP_FAIL, this.onRelease, this);
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        Tween.stopAllByTarget(this._opacity);
    }

    private onPick(piece: Node): void {
        if (piece !== this.node) return;
        Tween.stopAllByTarget(this._opacity);
        this._view.node.active = true;
        // repeatForever 必须套在最外层。塞进 then() 里它就只是 Sequence 里的一个普通区间，
        // 引擎对它调 update 会报「[Action update]. override me」。代价是第二圈起首段
        // 只是原地停一下（255 → 255），不影响观感。
        tween(this._opacity)
            .to(this._cfg.fadeIn, { opacity: 255 })
            .to(this._cfg.pulseTime, { opacity: 175 })
            .to(this._cfg.pulseTime, { opacity: 255 })
            .union()
            .repeatForever()
            .start();
    }

    /** 松手回弹、吸附成功、转屏都是同一件事：把光收掉 */
    private onRelease(piece: Node): void {
        if (piece !== this.node || !this._view.node.active) return;
        Tween.stopAllByTarget(this._opacity);
        tween(this._opacity)
            .to(this._cfg.fadeOut, { opacity: 0 })
            .call(() => { this._view.node.active = false; })
            .start();
    }

    private onOrientation(): void {
        this.onRelease(this.node);
    }
}
