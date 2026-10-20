import { _decorator, Color, Component, EffectAsset, Material, Node, Sprite, UITransform, Vec2, Vec3, v3 } from 'cc';

const { ccclass } = _decorator;

/**
 * 进出场「速度感」：一层残影 + 一份缩放模糊材质。
 *
 * - 残影：克隆 N 个和目标一样的 Sprite 垫在底下，每个用**指数平滑**追前一个的世界变换，
 *   于是它们自然拖在后面（追得越快尾巴越短）。透明度按序号递减。纯节点，没有额外贴图。
 * - 缩放模糊：目标换成 zoom-blur 材质，沿 uv→中心方向多采样几次叠加，强度由调用方按速度给。
 *
 * 挂在飞行器（GameIntro 运行时建的 IntroZoom/Pick）上，所以残影**在同一个遮罩里**、跟着圆角一起裁。
 * 由 GameIntro 建、驱动、销毁 —— 它自己不管生命周期。
 */
@ccclass('IntroMotionBlur')
export class IntroMotionBlur extends Component {
    private _target: Sprite = null;
    private _mat: Material = null;
    private _ui: UITransform = null;
    private _ghosts: Node[] = [];
    private _pos: Vec3[] = [];
    private _scl: Vec3[] = [];
    private _lag = 16;
    private _strength = 0;

    setup(target: Sprite, effect: EffectAsset, count: number, opacity: number, lag: number): void {
        this._target = target;
        this._lag = lag;
        this._ui = this.node.getComponent(UITransform);
        const t = target.node.getComponent(UITransform);
        const wp = target.node.worldPosition;
        const ws = target.node.worldScale;
        for (let i = 0; i < count; i++) {
            const g = new Node('Ghost' + i);
            this.node.addChild(g);
            const ui = g.addComponent(UITransform);
            ui.setContentSize(t.width, t.height);
            ui.setAnchorPoint(t.anchorX, t.anchorY);
            const sp = g.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = target.spriteFrame;
            sp.color = new Color(255, 255, 255, Math.round(opacity * 255 * (1 - i / (count + 1))));
            g.setSiblingIndex(i);
            this._ghosts.push(g);
            this._pos.push(v3(wp.x, wp.y, 0));
            this._scl.push(v3(ws.x, ws.y, 1));
        }
        if (!effect) return;
        this._mat = new Material();
        this._mat.initialize({ effectAsset: effect });
        this._mat.setProperty('uCenter', new Vec2(0.5, 0.5));
        target.customMaterial = this._mat;
    }

    /** 0 = 清晰。交接给视频前必须是 0，否则首帧对不上 */
    setStrength(v: number): void {
        this._strength = v;
    }

    update(dt: number): void {
        const target = this._target;
        if (!target) return;
        if (this._ghosts.length) {
            const a = 1 - Math.exp(-this._lag * dt);
            const inv = this.node.worldScale.x || 1;
            let px = target.node.worldPosition.x;
            let py = target.node.worldPosition.y;
            let sx = target.node.worldScale.x;
            let sy = target.node.worldScale.y;
            for (let i = 0; i < this._ghosts.length; i++) {
                const p = this._pos[i];
                const s = this._scl[i];
                p.x += (px - p.x) * a;
                p.y += (py - p.y) * a;
                s.x += (sx - s.x) * a;
                s.y += (sy - s.y) * a;
                const g = this._ghosts[i];
                g.setPosition(this._ui.convertToNodeSpaceAR(p));
                g.setScale(s.x / inv, s.y / inv, 1);
                px = p.x;
                py = p.y;
                sx = s.x;
                sy = s.y;
            }
        }
        if (this._mat) this._mat.setProperty('uStrength', this._strength);
    }

    dispose(): void {
        for (const g of this._ghosts) g.destroy();
        this._ghosts.length = 0;
        this._pos.length = 0;
        this._scl.length = 0;
        if (this._target) this._target.customMaterial = null;
        this._mat = null;
        this._target = null;
        this._strength = 0;
    }
}
