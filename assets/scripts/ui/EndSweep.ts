import { _decorator, Color, Component, EffectAsset, Material, Node, Sprite, Tween, UITransform, Vec4, tween } from 'cc';
import { EndCarousel } from './EndCarousel';

const { ccclass, property } = _decorator;

/** 扫描轴固定 45°（左下 → 右上），与 `repair-sweep.effect` 的坐标约定一致。 */
const AXIS_X = 0.7071067811865476;
const AXIS_Y = 0.7071067811865476;

interface Handle {
    node: Node;
    mat: Material;
    state: { p: number };
}

/**
 * 结束界面的扫光：Logo / 按钮 / 正中卡片各来一道，**延迟错开**，一轮扫完隔一会儿再来一轮。
 *
 * 和 `RepairSweep` 共用 `repair-sweep.effect`：光带几何算在世界坐标里，节点是目标的子节点 + 同尺寸同贴图，
 * 所以贴图 alpha 天然当裁剪 —— 圆形徽标、圆角卡片、带透明边的 Logo 都不会扫出方形光块。
 */
@ccclass('EndSweep')
export class EndSweep extends Component {
    @property({ type: EffectAsset, displayName: '扫光材质' }) sweepEffect: EffectAsset = null;
    @property({ type: Node, displayName: 'Logo 节点' }) logo: Node = null;
    @property({ type: Node, displayName: '按钮节点' }) button: Node = null;
    @property({ type: EndCarousel, displayName: '卡片带（扫正中那张）' }) carousel: EndCarousel = null;

    @property({ type: Color, displayName: '光带颜色', tooltip: 'alpha 就是光带峰值强度' })
    sweepColor = new Color(255, 250, 235, 190);

    @property({ displayName: '单次时长（秒）' }) time = 0.7;
    @property({ displayName: '光带半宽比' }) band = 0.22;
    @property({ displayName: '整图补光' }) flash = 0.14;

    @property({ displayName: 'Logo 延迟（秒）' }) logoDelay = 0.1;
    @property({ displayName: '按钮延迟（秒）' }) buttonDelay = 0.7;
    @property({ displayName: '卡片延迟（秒）', tooltip: '卡片带进场快滚约 1.1s，别扫在飞的那一下' }) cardDelay = 1.45;
    @property({ displayName: '循环间隔（秒）', tooltip: '0 = 只扫一轮' }) repeatGap = 2.2;

    private _live: Handle[] = [];
    private _color = new Vec4(1, 1, 1, 0.75);
    private _axis = new Vec4();
    private _params = new Vec4();

    protected onLoad(): void {
        const c = this.sweepColor;
        this._color.set(c.r / 255, c.g / 255, c.b / 255, c.a / 255);
    }

    protected onEnable(): void {
        this.stopAll();
        this.scheduleCycle();
    }

    protected onDisable(): void {
        this.unscheduleAllCallbacks();
        this.stopAll();
    }

    private scheduleCycle(): void {
        this.scheduleOnce(() => this.sweep(this.logo), this.logoDelay);
        this.scheduleOnce(() => this.sweep(this.button), this.buttonDelay);
        this.scheduleOnce(() => this.sweep(this.card()), this.cardDelay);
        if (this.repeatGap > 0) {
            this.scheduleOnce(() => this.scheduleCycle(), this.cardDelay + this.time + this.repeatGap);
        }
    }

    private card(): Node {
        if (!this.carousel) return null;
        const item = this.carousel.centerItem;
        const clip = item && item.getChildByName('Clip');
        return (clip && clip.getChildByName('Image')) || item;
    }

    private sweep(target: Node): void {
        if (!target || !target.activeInHierarchy || !this.sweepEffect) return;
        const sprite = target.getComponent(Sprite);
        const ui = target.getComponent(UITransform);
        if (!sprite || !sprite.spriteFrame || !ui) return;

        const w = ui.contentSize.width * target.worldScale.x;
        const h = ui.contentSize.height * target.worldScale.y;
        const pos = target.worldPosition;
        const minX = pos.x - w * ui.anchorX;
        const minY = pos.y - h * ui.anchorY;
        const from = minX * AXIS_X + minY * AXIS_Y;
        const span = (minX + w) * AXIS_X + (minY + h) * AXIS_Y - from;
        this._axis.set(AXIS_X, AXIS_Y, from, 1 / Math.max(0.001, span));

        const mat = new Material();
        mat.initialize({ effectAsset: this.sweepEffect, defines: { USE_TEXTURE: true } });
        mat.setProperty('sweepColor', this._color);
        mat.setProperty('sweepAxis', this._axis);

        const node = new Node('Sweep');
        node.setParent(target);
        node.setSiblingIndex(target.children.length - 1);
        node.addComponent(UITransform).setContentSize(ui.contentSize.width, ui.contentSize.height);
        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sprite.spriteFrame;
        sp.customMaterial = mat;

        const handle: Handle = { node, mat, state: { p: 0 } };
        this._live.push(handle);
        this.paint(handle, 0);
        tween(handle.state)
            .to(this.time, { p: 1 }, { onUpdate: (_t, ratio) => this.paint(handle, ratio ?? 0) })
            .call(() => this.stop(handle))
            .start();
    }

    private paint(handle: Handle, linear: number): void {
        const e = 1 - (1 - linear) * (1 - linear);
        handle.mat.setProperty('sweepParams', this._params.set(
            -this.band + e * (1 + this.band * 2),
            this.band,
            Math.sin(linear * Math.PI) * this.flash,
            0,
        ));
    }

    private stop(handle: Handle): void {
        const i = this._live.indexOf(handle);
        if (i < 0) return;
        this._live.splice(i, 1);
        Tween.stopAllByTarget(handle.state);
        const s = handle.node.getComponent(Sprite);
        if (s) s.customMaterial = null;
        handle.node.destroy();
        handle.mat.destroy();
    }

    private stopAll(): void {
        for (const h of this._live.slice()) this.stop(h);
    }
}
