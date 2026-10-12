import { _decorator, Component, Color, EffectAsset, Material, Node, Sprite, SpriteFrame, Tween, UITransform, Vec2, Vec4, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 揭角的可调参数 —— **纯值类，一份就是一块碎片的完整姿势**。
 *
 * 碎片是运行时建的节点，参数没地方挂，所以由 `PieceFactory` 带着一份下来（同 `GlowConfig`）：
 * 工厂上那份是全局默认，各槽位可以填自己的那份顶掉它（`PieceSlot.peelOverride` / `peelParams`）——
 * 正因为要按格复制，两个材质**不在这里**，而是留在 `PieceFactory` 上全局一对（同那边的 `glowEffect`）。
 * 池里的碎片节点是复用的，材质只在第一块建起来时挂一次，逐格换材质本来就会「先到先得、后来不生效」。
 */
@ccclass('PeelConfig')
export class PeelConfig {
    @property({ type: Vec2, displayName: '掀哪个角', tooltip: '归一化坐标：(0,0) 左下 / (1,0) 右下 / (0,1) 左上 / (1,1) 右上' })
    corner = new Vec2(0, 0);

    @property({ displayName: '掀起的比例', tooltip: '折线从角往对边推进多远。1 = 推过整条对角线，0.28 差不多是个角' })
    liftRatio = 0.28;

    @property({ displayName: '拿起掀开时长（秒）' })
    liftTime = 0.2;

    @property({ displayName: '弹回时贴回时长（秒）' })
    stickTime = 0.5;

    @property({ type: Color, displayName: '背面底色' })
    backColor = new Color(153, 153, 153, 255);

    @property({ displayName: '折线高光带宽度（相对碎片高）', tooltip: '贴着折线那圈亮起来。按碎片高折成世界尺寸，所以拿起来放大时跟着一起长' })
    creaseWidth = 0.22;

    @property({ displayName: '折线高光强度', tooltip: '0 = 背面是一整块平色' })
    creaseGlow = 0.5;
}

/**
 * 折线（`xy` 法线 / `zw` 线上一点）与背面参数（`x` 高光带宽 / `y` 强度）。
 * `amount` 是折线推过「被掀的角 → 对角」这条线的比例：碎片按 `r × liftRatio` 传，
 * 修复那格的贴纸（`StickerApply`）恒传 `openRatio`。
 *
 * `amount <= 0` 推一条退化线（法线取零向量）：正面一点不切、背面一点不画，而且**和节点此刻
 * 在哪儿、多大完全无关** —— 否则 `apply()` 那一刻算出来的角会被 Layout 随后的一次重排带偏，
 * 正面的边上留一道细缝。
 */
export function peelLine(node: Node, corner: Vec2, amount: number, creaseWidth: number, creaseGlow: number, line: Vec4, param: Vec4): void {
    if (amount <= 0) {
        line.set(0, 0, 0, 0);
        return;
    }
    const ut = node.getComponent(UITransform);
    const ws = node.worldScale;
    const w = ut.width * ws.x;
    const h = ut.height * ws.y;
    const wp = node.worldPosition;
    const a = ut.anchorPoint;
    // 手算世界矩形，不用 getBoundingBoxToWorld（它会把 PeelBack / Glow 这类子节点并进来）
    const cx = wp.x + (0.5 - a.x) * w;
    const cy = wp.y + (0.5 - a.y) * h;

    // 从被掀的那个角指向矩形中心：折线垂直于它，`amount` 让它从角往对边推过去
    let ux = 0.5 - corner.x;
    let uy = 0.5 - corner.y;
    const len = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= len;
    uy /= len;

    // 矩形在 u 方向上的跨度 = 角到对角的投影
    const span = Math.abs(ux) * w + Math.abs(uy) * h;
    const d = amount * span;

    // 法线取 -u：指向要被掀掉的那一侧（角那边）
    line.set(
        -ux, -uy,
        cx + (corner.x - 0.5) * w + ux * d,
        cy + (corner.y - 0.5) * h + uy * d,
    );
    param.set(h * creaseWidth, creaseGlow, 0, 0);
}

/**
 * 碎片被拿起时像贴纸被揭开：一角折起来露出背面（背面那半是镜像过去的，涂平色 + 折线上一圈高光），
 * 弹回池子时再贴回去。
 *
 * 反过来的那一下（修好时翘着的角按平、贴到缺口上）是 `StickerApply`，两处共用 `peelLine` 算折线。
 *
 * 折线每帧由 CPU 算好塞进材质：px 拿碎片的**世界**矩形现算（§14 那条 —— `getBoundingBoxToWorld()`
 * 会把活着的子节点一并进来，这里就挂着一个），所以转屏、拿起放大、Layout 重排都不用重新接线。
 *
 * 拿起来之后碎片要放大到缺口那么大（`DragController` 那条 scale tween），所以折线跟着 worldScale 长，
 * 不然放大过程中折痕会相对碎片缩小。
 *
 * ⚠️ 正面材质是**碎片自己的 Sprite** 的 —— 这份材质负责这一整块的画法，所以它得自己把顶点色
 * （`UIOpacity` 换批淡入走的就是它）带上，见 effect 里那句 `o.a * color.a`。
 */
@ccclass('StickerPeel')
export class StickerPeel extends Component {
    private _cfg: PeelConfig = null;
    private _back: Node = null;
    private _backView: Sprite = null;
    private _frontMat: Material = null;
    private _backMat: Material = null;
    /** tween 推它，`lateUpdate` 照着算折线在哪。用普通对象是因为 tween 推不了组件自己的字段 */
    private _state = { r: 0 };
    private _line = new Vec4();
    private _param = new Vec4();

    /** PieceFactory 每次把碎片从池里取出来时调：池里的节点会被挪给另一张图，贴图和尺寸都得重算，折痕也要复位。
     *  两个材质是入参（工厂上全局那一对），`cfg` 只带值 —— 同隔壁 `PieceGlow.apply` 的「材质在前、配置在后」。 */
    apply(front: EffectAsset, back: EffectAsset, frame: SpriteFrame, w: number, h: number, cfg: PeelConfig): void {
        this._cfg = cfg;
        Tween.stopAllByTarget(this._state);
        this._state.r = 0;

        if (!this._frontMat) this.build(front, back);

        const c = cfg.backColor;
        this._backMat.setProperty('peelTint', new Vec4(c.r / 255, c.g / 255, c.b / 255, 1));
        this._backView.spriteFrame = frame;
        this._back.getComponent(UITransform).setContentSize(w, h);
        this._back.active = false;
        this.paint();
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.PIECE_PICK, this.onLift, this);
        EventBus.on(GameEvent.PIECE_SNAP_FAIL, this.onStick, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.PIECE_PICK, this.onLift, this);
        EventBus.off(GameEvent.PIECE_SNAP_FAIL, this.onStick, this);
        Tween.stopAllByTarget(this._state);
    }

    private build(front: EffectAsset, back: EffectAsset): void {
        const anchor = this.node.getComponent(UITransform).anchorPoint;

        this._frontMat = new Material();
        this._frontMat.initialize({ effectAsset: front, defines: { USE_TEXTURE: true } });
        this.node.getComponent(Sprite).customMaterial = this._frontMat;

        // 背面是碎片下面一个同尺寸子节点（子节点画在父节点之上，折起来的那半正好压住剩下的碎纸）
        const node = new Node('PeelBack');
        node.setParent(this.node);
        node.addComponent(UITransform).setAnchorPoint(anchor.x, anchor.y);
        this._backView = node.addComponent(Sprite);
        this._backView.sizeMode = Sprite.SizeMode.CUSTOM;
        this._backMat = new Material();
        this._backMat.initialize({ effectAsset: back, defines: { USE_TEXTURE: true } });
        this._backView.customMaterial = this._backMat;

        this._back = node;
        node.active = false;
    }

    private onLift(piece: Node): void {
        if (piece !== this.node || !this._frontMat) return;
        this.anim(1, this._cfg.liftTime, 'quadOut');
    }

    /** 没吸上、弹回池子：倒着演回去 */
    private onStick(piece: Node): void {
        if (piece !== this.node || !this._frontMat) return;
        this.anim(0, this._cfg.stickTime, 'sineInOut');
    }

    private anim(to: number, time: number, easing: 'quadOut' | 'sineInOut'): void {
        Tween.stopAllByTarget(this._state);
        this._back.active = true;
        tween(this._state)
            .to(time, { r: to }, { easing })
            .call(() => {
                if (to > 0) return;
                // 收尾这一笔得自己补：最后一次 paint 时 r 还没到 0，正面会留一道细缝
                this._state.r = 0;
                this.paint();
                this._back.active = false;
            })
            .start();
    }

    /** 用 lateUpdate：碎片在拖动 / 补位过程中每一帧都在动，越晚读位置，折痕跟得越紧 */
    protected lateUpdate(): void {
        if (this._frontMat && this._state.r > 0) this.paint();
    }

    private paint(): void {
        const cfg = this._cfg;
        peelLine(this.node, cfg.corner, this._state.r * cfg.liftRatio, cfg.creaseWidth, cfg.creaseGlow, this._line, this._param);
        this._frontMat.setProperty('peelLine', this._line);
        if (this._back.active) {
            this._backMat.setProperty('peelLine', this._line);
            this._backMat.setProperty('peelParam', this._param);
        }
    }
}
