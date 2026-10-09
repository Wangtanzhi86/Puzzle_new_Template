import { _decorator, Component, UIOpacity, Vec3 } from 'cc';

const { ccclass, property, requireComponent } = _decorator;

/**
 * 环境物的呼吸式浮动：以节点在编辑器里摆的位置为中心走一条正弦轨迹，来回摆动，
 * 同时透明度在 0–255 之间起伏。
 *
 * 相位取 theta = t / period * 2π：
 *   x = 中心 x + amplitude · sin(theta)      —— 左右各摆一个幅度，两端自然减速
 *   y = 中心 y + bobAmplitude · sin(2θ)      —— 一个来回里上下起伏两次，轨迹成波浪
 *   透明度 = 127.5 · (1 - cos(theta))        —— 0 → 255 → 0
 *
 * 所以摆到两端时正好全透明、扫过中间时最清楚，换向那一下看不见，不会「顿」一下。
 */
@ccclass('SwayMotion')
@requireComponent(UIOpacity)
export class SwayMotion extends Component {
    @property({ displayName: '左右摆幅（px）', tooltip: '以节点当前位置为中心，左右各摆这么远' })
    amplitude = 60;

    @property({ displayName: '上下起伏（px）', tooltip: '一个来回里起伏两次；填 0 就走直线' })
    bobAmplitude = 16;

    @property({ displayName: '一次来回时长（秒）' })
    period = 3.2;

    @property({ type: UIOpacity, displayName: '透明度组件' })
    opacity: UIOpacity = null;

    private _center = new Vec3();
    private _elapsed = 0;

    protected onLoad(): void {
        this._center.set(this.node.position);
    }

    protected onEnable(): void {
        this._elapsed = 0;
        this.apply(0);
    }

    protected update(dt: number): void {
        this._elapsed += dt;
        this.apply(this._elapsed);
    }

    private apply(t: number): void {
        const theta = (t / this.period) * Math.PI * 2;
        const { x, y, z } = this._center;
        this.node.setPosition(
            x + this.amplitude * Math.sin(theta),
            y + this.bobAmplitude * Math.sin(theta * 2),
            z,
        );
        this.opacity.opacity = 127.5 * (1 - Math.cos(theta));
    }
}
