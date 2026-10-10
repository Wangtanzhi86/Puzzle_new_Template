import { _decorator, Component, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 循环待机动作：以编辑器里摆的位置和缩放为基准走正弦 —— 左右 / 上下飘，横向 / 纵向拉伸。
 * 挂在节点自己身上，开局一直演，不碰玩法、不抛事件、不改透明度。
 */
@ccclass('IdleMotion')
export class IdleMotion extends Component {
    @property({ displayName: '左右摆幅（px）' }) swayX = 0;
    @property({ displayName: '上下摆幅（px）' }) swayY = 0;

    @property({ displayName: '横向拉伸幅度', tooltip: '0.12 = 在基准宽度的基础上 ±12%，绕锚点长' })
    stretchX = 0;

    @property({ displayName: '纵向拉伸幅度', tooltip: '0.12 = 在基准高度的基础上 ±12%，绕锚点长' })
    stretchY = 0;

    @property({ displayName: '一次循环时长（秒）' })
    period = 3;

    @property({ displayName: '起始相位', tooltip: '0–1，多个节点填不同的值就能错开起跑' })
    phase = 0;

    private _basePos = new Vec3();
    private _baseScale = new Vec3();
    private _t = 0;

    protected onLoad(): void {
        this._basePos.set(this.node.position);
        this._baseScale.set(this.node.scale);
    }

    protected onEnable(): void {
        this._t = this.phase * this.period;
    }

    protected update(dt: number): void {
        this._t = (this._t + dt) % this.period;
        const s = Math.sin((this._t / this.period) * Math.PI * 2);
        this.node.setPosition(
            this._basePos.x + this.swayX * s,
            this._basePos.y + this.swayY * s,
            this._basePos.z,
        );
        this.node.setScale(
            this._baseScale.x * (1 + this.stretchX * s),
            this._baseScale.y * (1 + this.stretchY * s),
            this._baseScale.z,
        );
    }
}
