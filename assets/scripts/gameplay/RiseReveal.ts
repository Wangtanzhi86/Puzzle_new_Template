import { _decorator, Component, EffectAsset, Material, Sprite, UIOpacity, UITransform, Vec4 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 原地「长出来」的循环：节点不动位置，图片从下往上一截截露出来，停一下，消失，再从头来。
 *
 * 露出的边界走 rise-reveal.effect（挂在图片自己的 Sprite 上），不是 Sprite 的竖向填充 ——
 * 填充只裁几何，边是硬的一刀切；交给片元按世界坐标算，才能给那条边一个羽化带。
 *
 * 一个循环的时间轴（总长 = riseTime + holdTime + fadeTime）：
 *   [0, rise)           alpha 0→255（一边往上长一边淡入）
 *   [rise, rise+hold)   不透明
 *   [.., 循环末)         透明度 255→0
 * 透明度走 UIOpacity（材质里乘了顶点色，所以照常生效），边界位置走材质 uniform。
 * fadeTime 填 0 就没有淡出，显示完「啪」一下消失再重来。
 */
@ccclass('RiseReveal')
export class RiseReveal extends Component {
    @property({ type: EffectAsset, displayName: '羽化材质' })
    revealEffect: EffectAsset = null;

    @property({ type: Sprite, displayName: '图片组件' })
    sprite: Sprite = null;

    @property({ type: UIOpacity, displayName: '透明度组件' })
    opacity: UIOpacity = null;

    @property({ displayName: '从下往上显示时长（秒）' })
    riseTime = 1.2;

    @property({ displayName: '完全显示后停留时长（秒）' })
    holdTime = 0.8;

    @property({ displayName: '消失时长（秒）', tooltip: '0 = 不淡出，显示完直接消失重来' })
    fadeTime = 0.4;

    @property({ displayName: '羽化带宽（px）', tooltip: '过渡带总高，按图片自身像素算 —— 越大边越虚，越小越硬' })
    edgeSoft = 28;

    private _mat: Material;
    private _ui: UITransform;
    private _reveal = new Vec4();
    private _elapsed = 0;

    protected onLoad(): void {
        this._ui = this.node.getComponent(UITransform);
        this._mat = new Material();
        this._mat.initialize({ effectAsset: this.revealEffect, defines: { USE_TEXTURE: true } });
    }

    protected onEnable(): void {
        this.sprite.customMaterial = this._mat;
        this._elapsed = 0;
        this.apply(0);
    }

    protected onDisable(): void {
        this.sprite.customMaterial = null;
    }

    protected onDestroy(): void {
        this._mat.destroy();
    }

    protected update(dt: number): void {
        this._elapsed += dt;
        this.apply(this._elapsed);
    }

    private apply(t: number): void {
        const rise = this.riseTime;
        const hold = rise + this.holdTime;
        const at = t % (hold + this.fadeTime);
        let shown = 1;
        if (at < rise) {
            shown = at / rise;
            this.opacity.opacity = 255 * shown;
        } else if (at < hold) {
            this.opacity.opacity = 255;
        } else {
            this.opacity.opacity = 255 * (1 - (at - hold) / this.fadeTime);
        }
        this.paint(shown);
    }

    /**
     * 显示线两头都得让出半个羽化带：shown = 0 时线在图片底边**以下**半个带（整个过渡带都在图外，
     * 所以是全透明），shown = 1 时线在顶边以上半个带（整个带也在图外，所以全不透明）。
     * 少让这一下，起点会先亮一条、终点会留一条没淡完的边。
     *
     * 世界尺寸每帧现算：转屏时 Canvas 缩放会变，世界尺度跟着变，缓存下来会错位。
     */
    private paint(shown: number): void {
        const scale = this.node.worldScale.y;
        const height = this._ui.height * scale;
        const bottom = this.node.worldPosition.y - this._ui.anchorY * height;
        const band = this.edgeSoft * scale;
        const line = bottom - band * 0.5 + shown * (height + band);
        this._mat.setProperty('reveal', this._reveal.set(line, 1 / band, 0, 0));
    }
}
