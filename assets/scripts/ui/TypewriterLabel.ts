import { _decorator, Component, Label, Tween, UIOpacity, tween } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 打字机文字：气泡出现时把 Label 从空逐字敲出来，敲完停 `hold` 秒再回调。
 * 只负责这一条文字与气泡的淡入淡出，什么时候显示 / 隐藏由 `BubbleSequence` 决定。
 *
 * 节点平时是睡的（`active = false`），`play()` 才叫醒；所以不要依赖 `onLoad`，
 * 需要的不透明度和 Label 一律在第一次用时现取。
 */
@ccclass('TypewriterLabel')
export class TypewriterLabel extends Component {
    @property({ type: Label, displayName: '文字 Label' }) label: Label = null;

    @property({ multiline: true, displayName: '台词', tooltip: '按字逐个显示；换行照常生效' })
    text = '';

    @property({ displayName: '每秒字数', tooltip: '0 = 不逐字，直接整段出现' }) charsPerSecond = 16;

    @property({ displayName: '淡入时长（秒）' }) fadeIn = 0.2;

    @property({ displayName: '读完停留（秒）', tooltip: '最后一个字显示后停这么久才回调，留出阅读时间' }) hold = 0.5;

    @property({ displayName: '淡出时长（秒）' }) fadeOut = 0.2;

    private _op: UIOpacity = null;
    private _chars: string[] = [];
    private _shown = 0;
    private _elapsed = 0;
    private _typing = false;
    private _done: (() => void) | null = null;

    /** 叫醒气泡，开始逐字显示；`done` 在最后一个字停够 `hold` 之后触发。 */
    play (done: () => void): void {
        this.unschedule(this.finish);
        this._done = done;
        this._chars = Array.from(this.text || '');
        this._shown = 0;
        this._elapsed = 0;
        this._typing = true;
        if (this.label) this.label.string = '';

        this.node.active = true;
        const op = this.opacity();
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        if (this.fadeIn > 0) tween(op).to(this.fadeIn, { opacity: 255 }, { easing: 'quadOut' }).start();
        else op.opacity = 255;
    }

    /** 淡出并睡下；`done` 在气泡真正藏好之后触发。 */
    hide (done?: () => void): void {
        this._typing = false;
        this.unschedule(this.finish);
        this._done = null;

        const op = this.opacity();
        Tween.stopAllByTarget(op);
        if (this.fadeOut <= 0 || !this.node.active) {
            op.opacity = 0;
            this.node.active = false;
            if (done) done();
            return;
        }
        tween(op)
            .to(this.fadeOut, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                this.node.active = false;
                op.opacity = 255;
                if (done) done();
            })
            .start();
    }

    protected update (dt: number): void {
        if (!this._typing || !this.label) return;
        this._elapsed += dt;
        const count = this.charsPerSecond > 0
            ? Math.min(this._chars.length, Math.floor(this._elapsed * this.charsPerSecond))
            : this._chars.length;
        if (count !== this._shown) {
            this._shown = count;
            this.label.string = this._chars.slice(0, count).join('');
        }
        if (count >= this._chars.length) {
            this._typing = false;
            if (this.hold > 0) this.scheduleOnce(this.finish, this.hold);
            else this.finish();
        }
    }

    protected onDisable (): void {
        this._typing = false;
        this.unscheduleAllCallbacks();
        if (this._op) Tween.stopAllByTarget(this._op);
    }

    private finish = (): void => {
        const done = this._done;
        this._done = null;
        if (done) done();
    };

    private opacity (): UIOpacity {
        if (!this._op) this._op = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
        return this._op;
    }
}
