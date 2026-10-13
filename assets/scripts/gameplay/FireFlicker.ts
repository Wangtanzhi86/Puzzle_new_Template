import { _decorator, Component, UITransform, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 火焰跳动：每帧改 `UITransform.contentSize` 做纵向拉伸 / 横向伸缩，**底边钉在原地**，
 * 只有上半截在动。
 *
 * 为什么不直接用 `IdleMotion`：那份是绕锚点走 `scale`，节点锚点在中心，火苗会连底一起
 * 上下缩 —— 看着像整块在呼吸，不像火在往上窜。这里改尺寸，同时把 `position.y` 按
 * `(新高度 − 基准高度) / 2` 抬一下，底边就纹丝不动；横向是对称伸缩，底线中心也自然不动。
 *
 * 基准取 `onLoad` 那一刻编辑器里摆的尺寸 / 位置，每帧都是「基准 ± 幅度」现算，不会越演越偏。
 * 编辑器里存的值一个都不改（`update` 只在运行期跑）。
 */
@ccclass('FireFlicker')
export class FireFlicker extends Component {
    @property({ displayName: '横向伸缩幅度', tooltip: '0.08 = 在基准宽度上 ±8%，左右对称、底线中心不动' })
    stretchX = 0.08;

    @property({ displayName: '纵向拉伸幅度', tooltip: '0.15 = 在基准高度上 ±15%。底边钉住，这部分全长在上半截' })
    stretchY = 0.15;

    @property({ displayName: '一次循环时长（秒）' })
    period = 0.6;

    @property({ displayName: '起始相位', tooltip: '0–1，多个节点填不同的值就能错开起跑' })
    phase = 0;

    @property({ displayName: '抖动权重', tooltip: '0 = 纯正弦（匀速呼吸）；0.3–0.5 叠一层快谐波，更像火苗乱窜' })
    wobble = 0.35;

    private _w = 0;
    private _h = 0;
    private _base = new Vec3();
    private _t = 0;

    protected onLoad(): void {
        const ut = this.node.getComponent(UITransform);
        this._w = ut.width;
        this._h = ut.height;
        this._base.set(this.node.position);
    }

    protected onEnable(): void {
        this._t = this.phase * this.period;
    }

    protected update(dt: number): void {
        this._t = (this._t + dt) % this.period;
        const a = (this._t / this.period) * Math.PI * 2;
        // 基频 + 一层 2.7 倍频的谐波：`wobble` 填 0 就退化成纯正弦
        const s = Math.sin(a) + this.wobble * Math.sin(a * 2.7 + 1.3);
        const h = this._h * (1 + this.stretchY * s);
        this.node.getComponent(UITransform).setContentSize(this._w * (1 + this.stretchX * s), h);
        this.node.setPosition(this._base.x, this._base.y + (h - this._h) * 0.5, this._base.z);
    }
}
