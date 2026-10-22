import { _decorator, Component, Node, UITransform, VideoPlayer } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 结尾视频。完成背景那支画笔刷完之后（`END_SHOW`）先播这一段，播完（或玩家点一下跳过）
 * 才把画面交给 `CtaController` 亮结束界面。走的是 `winCount = 0` 那条主路径。
 *
 * 挂在 `VideoPlayer` 的**同一个节点**上，整棵平时 `active = false` —— 引擎的 `onDisable` 才把 video
 * 元素设成 `visibility: hidden`，光靠 `stop()` 藏不住。
 *
 * ⚠️ 它是**盖在画布之上的 DOM `<video>`**（引擎把元素 append 到 `game.container`），跟场景层级无关：
 *   ① 演的时候**播放区域那块地方的触摸到不了画布** —— 引擎的输入监听挂在 `#GameCanvas` 上，而 video
 *      元素在上面且没有 `pointer-events: none`。所以「点一下跳过」只能听引擎自己挂在元素上的那个
 *      `click`（`CLICKED`），借不了全局 `input` / `Button`；区域**外面**的触摸照旧到得了画布，
 *      而那会儿 23 格已经修完、玩法本来就没事可做（`LEVEL_COMPLETE` 之后空闲引导也停了）；
 *   ② 收摊必须把节点睡回去 —— 那之后触摸才穿得过去，结束界面那颗下载按钮才活过来。
 *
 * 视频**按「播放区域」铺满**（等比取大 = 盖住整个区域，多出来的那截用 `clip-path` 裁掉），不是铺满整屏：
 * 区域是 `Scene_BG` 那一块（和完成背景同一个框）。取小（完整显示）会在两侧露出底下的拼图，所以走取大 + 裁切。
 * ⚠️ `GameLayer` 上的 RECT `Mask` 裁不到它 —— `Mask` 只改画布侧的渲染，视频是画布之上的 DOM 元素，
 * 裁切只能自己写 `clip-path` 到元素上，见 `fit()`。
 */
@ccclass('EndVideo')
export class EndVideo extends Component {
    @property({ type: VideoPlayer, displayName: '视频播放器' })
    player: VideoPlayer = null;

    @property({ type: Node, displayName: '播放区域', tooltip: '视频等比铺满这个节点的世界框（取大 = 盖住，多出来的裁掉）。现在指 Scene_BG；留空 = 不动也不缩放' })
    region: Node = null;

    @property({ displayName: '兜底时长（秒）', tooltip: '自动播放被浏览器拦下、或 COMPLETED 不回调时，超过这么久就当它演完了，别再压着结束界面' })
    fallbackTime = 8;

    @property({ displayName: '结尾渐隐（秒）', tooltip: '播到「片长 − 这个秒数」开始把画面淡到透明，盖掉播完后闪回第一帧那一两帧。0 = 不淡' })
    fadeOut = 0;

    /** 演完（或被跳过）要回调谁。非空 = 还在演 */
    private _done: (() => void) | null = null;

    /** 元数据还没到时 scheduleFade 的重试次数，别无限等 */
    private _fadeTries = 0;

    protected onEnable(): void {
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.fit, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.fit, this);
        this.unscheduleAllCallbacks();
        if (!this.player) return;
        this.player.node.off(VideoPlayer.EventType.COMPLETED, this.done, this);
        this.player.node.off(VideoPlayer.EventType.CLICKED, this.done, this);
        this.player.node.off(VideoPlayer.EventType.META_LOADED, this.onMeta, this);
        this.player.stop();
        this.hideBox();
        this._done = null;
    }

    /** 起播。返回 false = 没配播放器，调用方照旧直接亮结束界面 */
    play(onDone: () => void): boolean {
        if (!this.player) return false;
        this._done = onDone;
        this._fadeTries = 0;
        this.node.active = true;
        this.clearFade();
        this.showBox();
        this.player.node.on(VideoPlayer.EventType.COMPLETED, this.done, this);
        this.player.node.on(VideoPlayer.EventType.CLICKED, this.done, this);
        this.player.node.on(VideoPlayer.EventType.META_LOADED, this.onMeta, this);
        this.begin();
        // 元数据已经被缓存过（同一个元素再放一次不会再抛 `META_LOADED`）时得先自己摆一次
        this.fit();
        this.scheduleFade();
        this.scheduleOnce(this.done, this.fallbackTime);
        return true;
    }

    /** 起播。**先试带声音**：结尾路前面必然有过触摸（玩家得拖碎片），页面已经拿到用户激活，
     *  浏览器多半放行。万一被拦就退成静音再放一次 —— 静音自动播永远允许，画面照演，只是没声。
     *
     *  ⚠️ 这一步**不走 `player.play()`**：引擎那条路（`video-player-impl-web.ts` 的 `canPlay()`
     *  里一句空 `catch`）把 rejection 吞了，外部无从知道被拦，也就没法退。这里直接拿元素放，
     *  播放状态由 DOM 事件回填（引擎那两个 `play` / `playing` 监听）照样跟得上；
     *  我们要的 `COMPLETED` / `CLICKED` 本来就是引擎从元素的 `ended` / `click` 转出来的。 */
    private begin = (): void => {
        const v = this.player.nativeVideo;
        if (!v) return;
        v.play().catch((): void => {
            this.player.mute = true;
            v.play().catch((): void => { /* 还不行就只剩兜底定时器了 */ });
        });
    };

    private onMeta = (): void => {
        this.fit();
        this.scheduleFade();
    };

    /** 按「片长 − fadeOut」排一次淡出。元数据还没到就隔 0.1s 再问，问到 duration 有值为止 */
    private scheduleFade = (): void => {
        if (this.fadeOut <= 0) return;
        const v = this.player.nativeVideo;
        const dur = v ? v.duration : NaN;
        if (!isFinite(dur) || dur <= 0) {
            if (this._fadeTries++ < 60) this.scheduleOnce(this.scheduleFade, 0.1);
            return;
        }
        this.scheduleOnce(this.fadeAway, Math.max(0, dur - this.fadeOut));
    };

    /** 把元素淡到透明。只能动元素自己的样式 —— 节点的 UIOpacity 管不到画布之上的 DOM 视频 */
    private fadeAway = (): void => {
        const v = this.player.nativeVideo;
        if (!v) return;
        v.style.transition = 'opacity ' + this.fadeOut + 's linear';
        v.style.opacity = '0';
    };

    private clearFade(): void {
        const v = this.player.nativeVideo;
        if (!v) return;
        v.style.transition = '';
        v.style.opacity = '';
    }

    /** 把元素从版面里摘掉（`display:none`）。引擎停播只设 `visibility:hidden`，而 `fit()`
     *  把元素盒子按 cover 放大过 —— 盒子本身比窗口大，页面没 `overflow:hidden` 时它会在右侧 / 下方
     *  撑出滚动条（2026-10-22 实锤：480×854 的片子放进 1920×1280 画布、k=4 ⇒ 盒子约 1200×2135 CSS px）。
     *  宽度 / 高度 / transform 一个字都不动，`play()` 里把 `display` 放回来就行。 */
    private hideBox(): void {
        const v = this.player && this.player.nativeVideo;
        if (v) v.style.display = 'none';
    }

    private showBox(): void {
        const v = this.player && this.player.nativeVideo;
        if (v) v.style.display = '';
    }

    /** 收摊。`COMPLETED` / `CLICKED` / 兜底三条都走这儿，`_done` 先清掉所以再进来就直接返回 */
    private done = (): void => {
        const cb = this._done;
        if (!cb) return;
        this._done = null;
        this.node.active = false;
        cb();
    };

    /** 铺满「播放区域」：等比缩到**盖住整个区域**（取大），居中摆到区域中心，再把溢出区域的那截裁掉。
     *
     *  取大必然有一边超出去，而视频是画布之上的 DOM 元素、`GameLayer` 的 RECT `Mask` 管不到它，
     *  所以溢出得自己裁：`clip-path: inset()` 写在**元素自己的像素空间**里（引擎每帧只回写
     *  transform / width / height / object-fit，不动 clip-path）。窗口按 `区域÷倍率` 换回元素像素，
     *  元素盒子与片源原始像素等大（`keepAspectRatio` 开着时引擎在 `META_LOADED` 那一下设的），
     *  两边相除正好消掉，所以这里可以直接用片源的像素算。
     *
     *  **倍率也按片源的原始像素算**，不按节点尺寸 —— 同上：引擎设节点尺寸那一句排在
     *  `node.emit(META_LOADED)` **后面**，我们这个回调跑的时候节点尺寸还是场景里那个 720×1280。
     *  `ORIENTATION_CHANGED` 会重算（转屏后区域被 `LandscapeLayout` 挪了位置、也放大了）。 */
    private fit = (): void => {
        if (!this.player || !this.region) return;
        const v = this.player.nativeVideo;
        const ui = this.player.node.getComponent(UITransform);
        const w = (v && v.videoWidth) || (ui && ui.width);
        const h = (v && v.videoHeight) || (ui && ui.height);
        if (!w || !h) return;
        // 区域的框一律手算：`contentSize × worldScale` + `anchorPoint`（中心要按锚点折一下）。
        // 不使用 `getBoundingBoxToWorld()` —— 它会把活着的子节点并进来，而这底下挂着整棵拼图场景
        const t = this.region.getComponent(UITransform);
        const s = this.region.worldScale;
        const p = this.region.worldPosition;
        const rw = t.width * s.x;
        const rh = t.height * s.y;
        const k = Math.max(rw / w, rh / h);
        this.player.node.setWorldPosition(p.x + (0.5 - t.anchorX) * rw, p.y + (0.5 - t.anchorY) * rh, 0);
        this.player.node.setScale(k, k, 1);
        if (!v) return;
        const cutX = (w - rw / k) / 2;
        const cutY = (h - rh / k) / 2;
        v.style.clipPath = `inset(${cutY}px ${cutX}px)`;
    };
}
