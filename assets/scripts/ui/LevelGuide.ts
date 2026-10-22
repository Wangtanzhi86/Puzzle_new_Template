import { _decorator, Component, Input, input, Node, screen, ScrollView, Tween, tween, UITransform, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 选关引导：手指在第一关按钮上反复「按下去 → 抬起来」。
 * 玩家一碰屏幕（含滑动列表）就暂停；手松开 / 滚动停下后，只有目标按钮在列表可视区里露出足够多才继续演。
 * 节点放在 `Canvas/Change` 里（选关一关掉它跟着一起没），不拦截任何触摸。
 */
@ccclass('LevelGuide')
export class LevelGuide extends Component {
    @property({ type: Node, displayName: '目标按钮' }) target: Node = null;

    @property({ type: Node, displayName: '手指' }) finger: Node = null;

    @property({ type: ScrollView, displayName: '选关滚动视图' }) scroll: ScrollView = null;

    @property({ displayName: '起点偏移（相对按钮中心，px）' }) offset = new Vec3(80, -60, 0);

    @property({ displayName: '按下去用时（秒）' }) pressTime = 0.35;

    @property({ displayName: '抬起来用时（秒）' }) liftTime = 0.25;

    @property({ displayName: '两下之间停顿（秒）' }) gap = 0.35;

    @property({ displayName: '松手到恢复（秒）' }) resumeDelay = 0.2;

    @property({ displayName: '要求露出比例（0~1）', tooltip: '目标按钮至少这么大一块在可视区里，引导才继续' }) minVisible = 0.8;

    private _center = new Vec3();
    private _from = new Vec3();

    protected onEnable (): void {
        input.on(Input.EventType.TOUCH_START, this.pause, this);
        input.on(Input.EventType.TOUCH_END, this.onRelease, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onRelease, this);
        if (this.scroll) {
            this.scroll.node.on(ScrollView.EventType.SCROLL_BEGAN, this.pause, this);
            this.scroll.node.on(ScrollView.EventType.SCROLLING, this.pause, this);
            this.scroll.node.on(ScrollView.EventType.SCROLL_ENDED, this.onRelease, this);
        }
        screen.on('window-resize', this.onResize, this);
        // 首帧的 Widget / 选关 content 还没对齐，这时读第一关世界坐标会拿到设计稿 1280 的旧位置
        // （长屏第一关已经上移，手指却停在下面）。先藏手，等下一帧布局落定再起播。
        this.stopTween();
        this.scheduleOnce(this.restart, 0);
    }

    protected onDisable (): void {
        input.off(Input.EventType.TOUCH_START, this.pause, this);
        input.off(Input.EventType.TOUCH_END, this.onRelease, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onRelease, this);
        if (this.scroll) {
            this.scroll.node.off(ScrollView.EventType.SCROLL_BEGAN, this.pause, this);
            this.scroll.node.off(ScrollView.EventType.SCROLLING, this.pause, this);
            this.scroll.node.off(ScrollView.EventType.SCROLL_ENDED, this.onRelease, this);
        }
        screen.off('window-resize', this.onResize, this);
        this.unschedule(this.tryPlay);
        this.unschedule(this.restart);
        this.stopTween();
    }

    /** 一碰屏幕 / 开始滚动：先停下 */
    pause (): void {
        this.unschedule(this.tryPlay);
        this.unschedule(this.restart);
        this.stopTween();
    }

    /** 窗口尺寸变了：content 的 Widget 会重新贴顶，等下一帧再按第一关的新世界坐标重摆手指 */
    private onResize = (): void => {
        this.unschedule(this.tryPlay);
        this.unschedule(this.restart);
        this.stopTween();
        this.scheduleOnce(this.restart, 0);
    };

    private restart = (): void => {
        this.play();
    };

    private onRelease (): void {
        this.unschedule(this.tryPlay);
        this.scheduleOnce(this.tryPlay, this.resumeDelay);
    }

    /** 目标按钮露够了才接着演 */
    private tryPlay (): void {
        if (!this.visibleEnough()) return;
        this.play();
    }

    private play (): void {
        if (!this.target || !this.finger) return;
        if (!this.visibleEnough()) {
            this.stopTween();
            return;
        }
        const ui = this.node.getComponent(UITransform);
        ui.convertToNodeSpaceAR(this.target.worldPosition, this._center);
        this._from.set(this._center.x + this.offset.x, this._center.y + this.offset.y, 0);
        this.stopTween();
        this.finger.active = true;
        this.finger.setPosition(this._from);
        const to = this._center.clone();
        const back = this._from.clone();
        tween(this.finger)
            .repeatForever(
                tween()
                    .to(this.pressTime, { position: to })
                    .to(this.liftTime, { position: back })
                    .delay(this.gap),
            )
            .start();
    }

    private stopTween (): void {
        if (!this.finger) return;
        Tween.stopAllByTarget(this.finger);
        this.finger.active = false;
    }

    /** 目标按钮在滚动视图可视区里的露出比例够不够 */
    private visibleEnough (): boolean {
        if (!this.target || !this.scroll || !this.scroll.content) return true;
        const view = this.scroll.content.parent;
        const viewUi = view.getComponent(UITransform);
        const targetUi = this.target.getComponent(UITransform);
        if (!viewUi || !targetUi) return true;
        const tw = targetUi.width * this.target.worldScale.x;
        const th = targetUi.height * this.target.worldScale.y;
        if (tw <= 0 || th <= 0) return true;
        const p = new Vec3();
        viewUi.convertToNodeSpaceAR(this.target.worldPosition, p);
        const vw = viewUi.width;
        const vh = viewUi.height;
        const left = p.x - tw * 0.5;
        const right = p.x + tw * 0.5;
        const bottom = p.y - th * 0.5;
        const top = p.y + th * 0.5;
        const viewLeft = -vw * viewUi.anchorX;
        const viewRight = viewLeft + vw;
        const viewBottom = -vh * viewUi.anchorY;
        const viewTop = viewBottom + vh;
        const ix = Math.max(0, Math.min(right, viewRight) - Math.max(left, viewLeft));
        const iy = Math.max(0, Math.min(top, viewTop) - Math.max(bottom, viewBottom));
        return (ix * iy) / (tw * th) >= this.minVisible;
    }
}
