import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 在同一个 Sprite 上按 `frames` 顺序循环播放序列帧。
 * 位置 / 缩放 / 透明度一概不碰 —— 只换贴图，所以节点在编辑器里摆成什么样就是什么样。
 * 每帧尺寸要稳，Sprite 的 sizeMode 得是 RAW：TRIMMED / CUSTOM 都会让框跟着 trim 矩形抖。
 */
@ccclass('FrameLoop')
export class FrameLoop extends Component {
    @property({ type: Sprite, displayName: '图片组件' })
    sprite: Sprite = null;

    @property({ type: [SpriteFrame], displayName: '序列帧', tooltip: '按下标顺序循环播放；在资源管理器里框选后拖进来' })
    frames: SpriteFrame[] = [];

    @property({ displayName: '每帧时长（秒）', tooltip: '14 帧填 0.08 约 1.1 秒一轮' })
    frameInterval = 0.08;

    private _elapsed = 0;
    private _index = 0;

    protected onEnable(): void {
        this._elapsed = 0;
        this._index = 0;
        this.sprite.spriteFrame = this.frames[0];
    }

    protected update(dt: number): void {
        this._elapsed += dt;
        while (this._elapsed >= this.frameInterval) {
            this._elapsed -= this.frameInterval;
            this._index = (this._index + 1) % this.frames.length;
            this.sprite.spriteFrame = this.frames[this._index];
        }
    }
}
