import { _decorator, Button, Component, Node, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { EndVideo } from './EndVideo';
import { MraidBridge } from './MraidBridge';

const { ccclass, property } = _decorator;

/** 一次下落的动画状态：tween 推它，`apply()` 再写回节点 —— 位置和落地压扁共用一条时间轴 */
interface Drop {
    state: { y: number; squash: number };
    node: Node;
    x: number;
    base: Vec3;
}

/**
 * 结束界面。`SceneBgSwap` 把底板换完之后抛 `END_SHOW`，这里才亮出 `End`：
 * 配了结尾视频就先把它播完（或玩家点一下跳过），再
 * 背景淡入 → logo / 按钮从屏幕上方落下 → 落地弹两下（每下压扁再回弹）。
 *
 * 亮出来之前整棵子树 `active = false` —— AppLovin QA 专门查「看不见却能点到」。
 * 关音效不在这儿：`AudioManager` 自己也听 `END_SHOW`，免得两个模块互相持有引用；
 * 结尾视频起播和它同一拍，所以视频自己的音轨不会和游戏那盘音叠在一起。
 *
 * 那条路只在「修满全部槽位」时才走到。现在终局由 `EndgameCta` 接管（修满 `winCount` 个就跳商店），
 * 这里照旧留着 —— `EndgameCta.winCount` 填 0 就退回这套。
 */
@ccclass('CtaController')
export class CtaController extends Component {
    @property({ type: Node, displayName: '结束卡根节点（End）' }) ctaRoot: Node = null;
    @property({ type: Node, displayName: '背景（bg）' }) bg: Node = null;
    @property({ type: Node, displayName: 'logo 节点' }) logo: Node = null;
    @property({ type: Button, displayName: '下载按钮' }) ctaButton: Button = null;
    @property({ type: MraidBridge, displayName: 'MRAID 桥' }) bridge: MraidBridge = null;
    @property({ type: EndVideo, displayName: '结尾视频', tooltip: '留空 = 不演视频，`END_SHOW` 一到就亮结束界面' }) endVideo: EndVideo = null;

    @property({ type: [Node], displayName: '结束界面出现时收掉的节点', tooltip: '亮卡之前先收掉这些 gameplay 节点（例：BrokenLayer）—— 它们会被结束卡盖住，留着只是白画' })
    hideNodes: Node[] = [];

    @property({ type: [Node], displayName: '等这些节点藏好再亮', tooltip: '留空 = 立即亮。例：三个剧情气泡，等最后一句演完、气泡藏好再进结束界面' })
    waitNodes: Node[] = [];

    @property({ displayName: '等气泡的缓冲（秒）', tooltip: 'END_SHOW 后先等这么久再检查，避开同一帧的 PIECE_SHOWN 回调' }) waitGrace = 0.1;
    @property({ displayName: '气泡检查间隔（秒）' }) waitPoll = 0.05;

    @property({ displayName: '背景淡入时长（秒）', tooltip: '淡完这两个才开始往下落' }) bgFadeTime = 0.25;
    @property({ displayName: '下落时长（秒）' }) dropTime = 0.5;
    @property({ displayName: '出发高度（屏幕顶边之上 px）', tooltip: '两个都从这儿起步，再落到编辑器里摆好的位置' }) dropMargin = 140;
    @property({ displayName: '按钮的间隔（秒）', tooltip: '按钮比 logo 晚这么多开始下落' }) stagger = 0.18;
    @property({ displayName: '弹跳次数' }) bounces = 2;
    @property({ displayName: '首次弹跳高度（px）' }) bounceHeight = 140;
    @property({ displayName: '弹跳衰减', tooltip: '每一下的高度 = 上一下 × 这个值' }) bounceDecay = 0.45;
    @property({ displayName: '首次弹跳时长（秒）', tooltip: '一个来回。后面的按高度的平方根缩' }) bounceTime = 0.42;
    @property({ displayName: '落地压扁幅度', tooltip: '落地瞬间横向拉宽 / 纵向压扁的比例。0 = 没有形变' }) squash = 0.16;
    @property({ displayName: '压扁单程时长（秒）' }) squashTime = 0.08;

    private _fade: UIOpacity = null;
    private _drops: Drop[] = [];
    private _waiting = false;

    protected onLoad(): void {
        if (this.ctaRoot) this.ctaRoot.active = false;
        this._fade = this.bg ? this.bg.getComponent(UIOpacity) : null;
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.END_SHOW, this.onEndShow, this);
        if (this.ctaButton) this.ctaButton.node.on(Button.EventType.CLICK, this.onClick, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.END_SHOW, this.onEndShow, this);
        if (this.ctaButton) this.ctaButton.node.off(Button.EventType.CLICK, this.onClick, this);
        for (const d of this._drops) Tween.stopAllByTarget(d.state);
        this._drops.length = 0;
        this._waiting = false;
        this.unscheduleAllCallbacks();
    }

    /** `END_SHOW` 一到：配了结尾视频就先演它，演完（或玩家点一下跳过）再亮结束界面。
     *  没配 / 没配播放器就让 `play()` 返回 false，照旧当场亮 —— 视频这一拍是可选表现，不能卡住 CTA。 */
    private onEndShow(): void {
        if (this._waiting) return;
        this._waiting = true;
        // 等一帧再判：`END_SHOW` 可能比 `BubbleSequence` 的 `PIECE_SHOWN` 回调先到，
        // 此刻最后一个气泡还没醒，直接判会当成「没有气泡」当场亮结束界面。
        this.scheduleOnce(this.beginEnd, this.waitGrace);
    }

    private beginEnd(): void {
        if (this.hasVisibleWaitNode()) {
            this.schedule(this.checkWaitNodes, this.waitPoll);
            return;
        }
        this._waiting = false;
        this.playEnd();
    }

    private checkWaitNodes(): void {
        if (this.hasVisibleWaitNode()) return;
        this.unschedule(this.checkWaitNodes);
        this._waiting = false;
        this.playEnd();
    }

    private hasVisibleWaitNode(): boolean {
        for (const n of this.waitNodes) if (n && n.activeInHierarchy) return true;
        return false;
    }

    private playEnd(): void {
        if (this.endVideo && this.endVideo.play((): void => this.show())) return;
        this.show();
    }

    show(): void {
        if (!this.ctaRoot) return;
        for (const n of this.hideNodes) if (n) n.active = false;
        this.ctaRoot.active = true;
        if (this._fade) {
            this._fade.opacity = 0;
            tween(this._fade).to(this.bgFadeTime, { opacity: 255 }).start();
        }
        EventBus.emit(GameEvent.CTA_SHOW);
        this.drop(this.logo, this.bgFadeTime);
        this.drop(this.ctaButton.node, this.bgFadeTime + this.stagger);
        this.scheduleOnce((): void => EventBus.emit(GameEvent.END_DROP), this.bgFadeTime);
    }

    /**
     * 从屏幕上方落到节点在编辑器里摆好的位置，落地弹 `bounces` 下、每下压扁再回弹。
     * 只写 `position.y` 和 `scale` —— x 和 z 一概不动。
     *
     * 出发高度按本节点（`CtaLayer`，运行时被 Widget 撑成画布）的高度现算，所以长屏、横屏
     * 都是从框外进来的，不用另配一个数。
     */
    private drop(node: Node, delay: number): void {
        const restY = node.position.y;
        const top = this.node.getComponent(UITransform).height * 0.5 + this.dropMargin;
        const d: Drop = { state: { y: top, squash: 0 }, node, x: node.position.x, base: node.scale.clone() };
        this._drops.push(d);

        node.setPosition(d.x, top, node.position.z);

        const tw = tween(d.state)
            .delay(delay)
            .to(this.dropTime, { y: restY }, { easing: 'quadIn', onUpdate: () => this.applyDrop(d) })
            .to(this.squashTime, { squash: this.squash }, { onUpdate: () => this.applyDrop(d) })
            .to(this.squashTime, { squash: 0 }, { onUpdate: () => this.applyDrop(d) });

        let height = this.bounceHeight;
        let span = this.bounceTime;
        for (let i = 0; i < this.bounces; i++) {
            tw.to(span * 0.5, { y: restY + height }, { easing: 'quadOut', onUpdate: () => this.applyDrop(d) })
                .to(span * 0.5, { y: restY }, { easing: 'quadIn', onUpdate: () => this.applyDrop(d) })
                .to(this.squashTime, { squash: this.squash }, { onUpdate: () => this.applyDrop(d) })
                .to(this.squashTime, { squash: 0 }, { onUpdate: () => this.applyDrop(d) });
            height *= this.bounceDecay;
            span *= Math.sqrt(this.bounceDecay);
        }
        tw.start();
    }

    private applyDrop(d: Drop): void {
        d.node.setPosition(d.x, d.state.y, d.node.position.z);
        d.node.setScale(d.base.x * (1 + d.state.squash), d.base.y * (1 - d.state.squash), d.base.z);
    }

    private onClick(): void {
        // 跳转排在埋点前面：EventBus.emit 不兜异常，任何监听方（现在的、以后的）抛一下，
        // 后面这句就永远不执行 —— 表现是「点了没反应」，而且什么都不报。
        this.bridge.openStore();
        EventBus.emit(GameEvent.CTA_CLICK);
    }
}
