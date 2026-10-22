import { _decorator, AudioClip, AudioSource, Component, Enum, Input, input, Node, Tween, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EndCarousel } from '../ui/EndCarousel';
import { LevelSelect } from '../ui/LevelSelect';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 配置列表里「激活事件」「结束事件」两个下拉框的选项。
 * 除 NONE 以外，值就是 GameEvent 的名字本身，可以直接丢给 EventBus；
 * GameEvent 里加了新事件、想拿它当音频触发点，就在这里补一条。
 * 两个例外不在 EventBus 上，都由 `AudioManager` 自己点名：
 * `BUTTON_DOWN` = 按下 `buttons` 里那些按钮的那一瞬；`LAST_SHOWN` = 最后一格露面那一下。
 */
export enum AudioEvent {
    NONE = 'NONE',
    GAME_INIT = 'GAME_INIT',
    LEVEL_BUILT = 'LEVEL_BUILT',
    POOL_BUILT = 'POOL_BUILT',
    PIECE_PICK = 'PIECE_PICK',
    PIECE_DRAG = 'PIECE_DRAG',
    PIECE_SNAP_SUCCESS = 'PIECE_SNAP_SUCCESS',
    PIECE_SNAP_FAIL = 'PIECE_SNAP_FAIL',
    PIECE_REPAIRED = 'PIECE_REPAIRED',
    REPAIR_FAILED = 'REPAIR_FAILED',
    PIECE_SHOWN = 'PIECE_SHOWN',
    /** 剧情气泡开始播放：载荷是气泡序号 1/2/3，三条 cue 用「激活事件的槽位」各认一个 */
    BUBBLE_SHOW = 'BUBBLE_SHOW',
    /** 胶带揭晓：每一条胶带开始擦出时抛一次（`TapeWipe.play`） */
    TAPE_STRIP = 'TAPE_STRIP',
    REPAIR_PROGRESS = 'REPAIR_PROGRESS',
    LEVEL_COMPLETE = 'LEVEL_COMPLETE',
    END_SHOW = 'END_SHOW',
    END_DROP = 'END_DROP',
    AUTO_PLAY = 'AUTO_PLAY',
    GAME_OVER = 'GAME_OVER',
    GUIDE_HIDE = 'GUIDE_HIDE',
    CTA_SHOW = 'CTA_SHOW',
    CTA_CLICK = 'CTA_CLICK',
    ORIENTATION_CHANGED = 'ORIENTATION_CHANGED',
    AUDIO_MUTE = 'AUDIO_MUTE',
    /** 不是 GameEvent：最后一格露面那一下（背景开始扩散）。`PIECE_SHOWN` 每格都发，这条只认凑满总数的那一次 */
    LAST_SHOWN = 'LAST_SHOWN',
    /** 不是 GameEvent：按下「按压音效按钮」列表里那些按钮的那一瞬 */
    BUTTON_DOWN = 'BUTTON_DOWN',
    /** 不是 GameEvent：结束界面卡片带被真正拖动起来的那一刻（EndCarousel.onSlideStart）。
     *  停下不看「结束事件」—— 由 onSettle 直接收声 */
    CAROUSEL_SLIDE = 'CAROUSEL_SLIDE',
    /** 不是 GameEvent：选了锁着的关卡、锁图标开始晃的那一刻（LevelSelect.onLockShake） */
    LOCK_SHAKE = 'LOCK_SHAKE',
}

/**
 * 自动打关期间一声都不出的几条：那一段全是系统在替玩家放，再响一遍「拿起 / 放置」就成了六连音。
 * 那一段有自己的常驻音（激活事件选 `AUTO_PLAY`），`AUTO_PLAY` 起、`GAME_OVER` 止。
 */
const AUTO_SILENT: AudioEvent[] = [AudioEvent.PIECE_PICK, AudioEvent.PIECE_SNAP_SUCCESS];

/**
 * 关场之后仍然要放的那几条：结束界面自己的音（`END_DROP`）、胜利风铃（`LEVEL_COMPLETE`）、
 * 按钮按压 / 轮播滑动，以及压在 `END_SHOW` 之后才起的第三句气泡（`BUBBLE_SHOW`）。
 * 它们都贴在 `stopAll` 那一刻的近旁（结束界面亮出来 / 跳商店），没有这条豁免就是永远听不见 ——
 * 风铃最惨：最后一格吸附成功下一帧就 `mraid.open` 跳商店，`CTA_CLICK` 当场停全部；
 * 气泡 3 同理，它和 `END_SHOW` 在同一拍，停全部会把它整句掐掉。
 */
const POST_OVER: AudioEvent[] = [AudioEvent.END_DROP, AudioEvent.LEVEL_COMPLETE, AudioEvent.BUTTON_DOWN, AudioEvent.CAROUSEL_SLIDE, AudioEvent.BUBBLE_SHOW];

/** 一条音频配置：什么时候响、响什么、多大声、什么时候停 */
@ccclass('AudioCue')
export class AudioCue {
    @property({ type: Enum(AudioEvent), displayName: '激活事件', tooltip: '选「NONE」= 常驻：不绑任何事件；点关卡解锁音频、开场视频演完（GAME_START）后一直循环' })
    event: AudioEvent = AudioEvent.NONE;

    @property({ type: AudioClip, displayName: '音效', tooltip: '填了「顺序音效列表」的话这一格作废' })
    clip: AudioClip = null;

    @property({ type: [AudioClip], displayName: '顺序音效列表', tooltip: '非空时按顺序播：每触发一次播下一条，一轮放完回到第一条（音阶 1-6 就是它）' })
    sequence: AudioClip[] = [];

    @property({ displayName: '音量', tooltip: '与总音量相乘' })
    volume = 1;

    @property({ displayName: '渐入时长（秒）', tooltip: '起播时音量从 0 涨上来。0 = 直接满音量。BGM 这种循环的用得上，一次性音效一般留 0' })
    fadeIn = 0;

    @property({ displayName: '渐出时长（秒）', tooltip: '停止时音量先降到 0 再真停。0 = 当场停。带间隔的循环里，它也是每一遍末尾那一下渐出' })
    fadeOut = 0;

    @property({ displayName: '循环播放', tooltip: '非常驻的一条也一直循环，放到「结束事件」为止（自动打关那条就是它）。起播按「渐入」、停下按「渐出」' })
    loop = false;

    @property({ displayName: '循环间隔（秒）', tooltip: '配了「循环播放」或常驻音才用得上：一遍放完先静这么久再从头起播。0 = 引擎的无限循环，遍与遍之间没有间隔' })
    loopGap = 0;

    @property({ type: Enum(AudioEvent), displayName: '结束事件', tooltip: '选「NONE」= 不主动停：一次性音效播完即止，常驻的一直循环' })
    stopEvent: AudioEvent = AudioEvent.NONE;

    @property({ displayName: '激活事件的槽位', tooltip: '只对「激活事件」有效：-1 = 事件一来就播；≥0 = 只有载荷第一个参数（槽位号）等于它才播。例：只在小三序列帧那一格修复时响，就填那一格的序号' })
    startSlot = -1;

    @property({ displayName: '结束事件的槽位', tooltip: '只对「结束事件」有效：-1 = 事件一来就停；≥0 = 只有载荷第一个参数（槽位号）等于它才停。例：风声「结束事件」选 PIECE_REPAIRED、这里填 0，就和 FxSnow 在同一个槽位停下' })
    stopSlot = -1;
}

/** 一条配置对应一个 AudioSource：共用一份就停不掉单条 */
interface Channel {
    cue: AudioCue;
    source: AudioSource;
    /** 常驻音（激活事件选 NONE）：一直循环 */
    resident: boolean;
    /** 带间隔的循环（常驻 + 配了 `loopGap`）：引擎的 `loop` 关掉，靠 `ENDED` 接下一遍 */
    gapLoop: boolean;
    /** 「顺序音效列表」播到第几条 */
    seq: number;
    /** 起播了、还没被停过 —— 「跳转停全部」和「后台回来要不要接着放」都看它 */
    live: boolean;
    /** 0–1 的音量系数。渐入渐出推的就是它，不直接写 source.volume —— 那样 fade 就没有起点 */
    gain: { v: number };
    onStart: () => void;
    /** 按下按钮那一条走它：先解锁再响（玩家第一下就点 CTA 的话，全局 `input` 那条解锁收不到那一下） */
    onButton: () => void;
    onStop: () => void;
}

/**
 * 音频总控。配置列表里一条一条写「什么时候响、响什么、多大声、什么时候停」，
 * BGM 和常驻背景音就是把「激活事件」留成 NONE。
 *
 * 三条硬规矩（AppLovin 合规，§8.4）：
 * 1. 玩家第一次碰屏幕之前一声都不出（含 BGM）。碰哪儿都算 —— 碎片池那条路走 PIECE_PICK，
 *    选关按钮走 LEVEL_SELECTED。**常驻音还要再等一拍**：开场视频演完（`GAME_START`）才起，
 *    免得跟片源音轨抢；
 * 2. 广告被切到后台整体静音，回来接着放常驻音（一次性音效不补）；
 * 3. 结束界面亮出来（`END_SHOW`）就停掉全部、也不再起新的；点 CTA 跳商店再兜一次。
 *
 * `END_SHOW` 是关场事件本身，绑在它上面的条目必然被自己的 stopAll 掐掉 ——
 * 结束界面要响的、终局才响的、以及 `END_SHOW` 之后才起的第三句气泡，都见 `POST_OVER`：
 * `END_DROP`（logo / 按钮开始下落，晚 `bgFadeTime`）、`LEVEL_COMPLETE`（胜利风铃）、
 * `BUBBLE_SHOW`（气泡音效，按 1 / 2 / 3 分条）。
 *
 * 条目有两种「多一个格子」：
 * - `sequence`：按顺序播的列表，每触发一次换下一条；
 * - `loopGap`：循环的那几条每一遍之间留一段静默，末尾按 `fadeOut` 淡下去。
 *
 * 循环有两条路（`playCue` 里合成 `source.loop`）：常驻音（激活事件 NONE）与勾了「循环播放」的非常驻条目
 * —— 后者靠「结束事件」收（自动打关音：`AUTO_PLAY` 起、`GAME_OVER` 止）。
 * 那一段里 `AUTO_SILENT` 那几条一律不响。
 *
 * 按钮那一类（激活事件 = `BUTTON_DOWN`）不走 EventBus：它听 `buttons` 里那些节点的 `TOUCH_START`。
 * 不用 `CTA_CLICK` —— 那是松手才发，而且 `openStore()` 排在它**前面**，等它响时商店已经在开了。
 */
@ccclass('AudioManager')
export class AudioManager extends Component {
    @property({ type: [AudioCue], displayName: '音频配置', tooltip: 'BGM 与常驻背景音把「激活事件」留成 NONE' })
    cues: AudioCue[] = [];

    @property({ type: [Node], displayName: '按压音效按钮', tooltip: '按下去那一刻响「激活事件 = 按下按钮」那条音效。三颗 CTA（常驻按钮 / 结束界面 / 失败界面）都挂进来' })
    buttons: Node[] = [];

    @property({ type: EndCarousel, displayName: '结束界面卡片带', tooltip: '「激活事件 = 卡片滑动停下」那条音效听它的落定回调' })
    carousel: EndCarousel = null;

    @property({ type: LevelSelect, displayName: '选关', tooltip: '「激活事件 = 点了锁着的关卡」那条音效听它的锁晃动回调' })
    select: LevelSelect = null;

    @property({ displayName: '总音量' })
    volume = 1;

    private _channels: Channel[] = [];
    private _nodes: Node = null;
    /** 页面已拿到用户激活（点关卡那一刻）—— 一次性音效从这儿起就能响 */
    private _unlocked = false;
    /** 开场演完了（`GAME_START`）—— BGM 与常驻音要等这一下，别跟开头视频的音轨抢 */
    private _started = false;
    private _muted = false;
    private _closed = false;
    /** 系统接管中（`AUTO_PLAY` 起、`GAME_OVER` 止）：这段时间 `AUTO_SILENT` 那几条不响 */
    private _auto = false;
    private _total = 0;
    private _shown = 0;

    protected onEnable(): void {
        if (!FeatureFlags.audio) return;
        // 解锁这两条必须排在 build() 里那些监听前面：第一次拖碎片时 PIECE_PICK
        // 得先把闸门打开，配置里那一声才放得出来（EventBus 按注册顺序派发）
        input.on(Input.EventType.TOUCH_START, this.unlock, this);
        EventBus.on(GameEvent.PIECE_PICK, this.unlock, this);
        // 点关卡就算用户激活：此后的一次性音效立刻能响，常驻的还要等开场视频演完
        EventBus.on(GameEvent.LEVEL_SELECTED, this.unlock, this);
        EventBus.on(GameEvent.GAME_START, this.onGameStart, this);
        EventBus.on(GameEvent.END_SHOW, this.onEnd, this);
        EventBus.on(GameEvent.CTA_CLICK, this.onCtaClick, this);
        EventBus.on(GameEvent.AUDIO_MUTE, this.onMute, this);
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.PIECE_SHOWN, this.onShown, this);
        EventBus.on(GameEvent.AUTO_PLAY, this.onAutoPlay, this);
        EventBus.on(GameEvent.GAME_OVER, this.onGameOver, this);
        this.build();
        if (this.carousel) {
            this.carousel.onSlideStart = this.onCarouselSlide;
            this.carousel.onSettle = this.onCarouselSettle;
        }
        if (this.select) this.select.onLockShake = this.onLockShake;
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.unlock, this);
        EventBus.off(GameEvent.PIECE_PICK, this.unlock, this);
        EventBus.off(GameEvent.LEVEL_SELECTED, this.unlock, this);
        EventBus.off(GameEvent.GAME_START, this.onGameStart, this);
        EventBus.off(GameEvent.END_SHOW, this.onEnd, this);
        EventBus.off(GameEvent.CTA_CLICK, this.onCtaClick, this);
        EventBus.off(GameEvent.AUDIO_MUTE, this.onMute, this);
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.PIECE_SHOWN, this.onShown, this);
        EventBus.off(GameEvent.AUTO_PLAY, this.onAutoPlay, this);
        EventBus.off(GameEvent.GAME_OVER, this.onGameOver, this);
        if (this.carousel) {
            this.carousel.onSlideStart = null;
            this.carousel.onSettle = null;
        }
        if (this.select) this.select.onLockShake = null;
        for (const ch of this._channels) {
            EventBus.off(ch.cue.event, ch.onStart);
            EventBus.off(ch.cue.stopEvent, ch.onStop);
            for (const btn of this.buttons) btn.off(Node.EventType.TOUCH_START, ch.onButton, this);
            Tween.stopAllByTarget(ch.gain);
        }
        // 循环那两条是靠 scheduleOnce 接的，禁用了还留着到点就会打到已经拆掉的声道上
        this.unscheduleAllCallbacks();
        this._channels = [];
        if (this._nodes) {
            // 先摘下来再销毁：`destroy()` 要等这一帧末才真移除，编辑器里不跑帧 ——
            // 节点会一直挂在 `Canvas` 下，下一次存场景就被写进文件（实测见过一个 `AudioChannels`）
            this._nodes.removeFromParent();
            this._nodes.destroy();
            this._nodes = null;
        }
    }

    private build(): void {
        this._nodes = new Node('AudioChannels');
        this._nodes.setParent(this.node);
        // 所有声道挤在同一个宿主节点上，所以 `ENDED` 只挂一条 —— 载荷第一个参数就是哪个 source 放完的
        this._nodes.on(AudioSource.EventType.ENDED, this.onEnded, this);
        for (const cue of this.cues) {
            if (!cue.clip && !cue.sequence.length) continue;
            const source = this._nodes.addComponent(AudioSource);
            source.playOnAwake = false;
            const ch: Channel = {
                cue,
                source,
                resident: cue.event === AudioEvent.NONE,
                gapLoop: false,
                seq: 0,
                live: false,
                gain: { v: 1 },
                onStart: null,
                onButton: null,
                onStop: null,
            };
            const at = cue.startSlot;
            ch.onStart = (idx?: number): void => {
                if (at >= 0 && idx !== at) return;
                this.playCue(ch);
            };
            ch.onButton = (): void => {
                this.unlock();
                this.playCue(ch);
            };
            const slot = cue.stopSlot;
            ch.onStop = (idx?: number): void => {
                if (slot >= 0 && idx !== slot) return;
                this.stopChannel(ch);
            };
            if (!ch.resident) {
                if (cue.event === AudioEvent.BUTTON_DOWN) {
                    for (const btn of this.buttons) btn.on(Node.EventType.TOUCH_START, ch.onButton, this);
                } else if (cue.event !== AudioEvent.LAST_SHOWN && cue.event !== AudioEvent.CAROUSEL_SLIDE && cue.event !== AudioEvent.LOCK_SHAKE) {
                    // LAST_SHOWN / CAROUSEL_SLIDE 都不是总线事件，由下面的 onShown / onCarouselSlide 自己点名
                    EventBus.on(cue.event, ch.onStart);
                }
            }
            if (cue.stopEvent !== AudioEvent.NONE) EventBus.on(cue.stopEvent, ch.onStop);
            this._channels.push(ch);
        }
    }

    /** 第一次真实触摸。碎片池上的触摸被 content 认领、全局 input 收不到，那条路由 PIECE_PICK 顶上；
     *  选关按钮同理，所以 `LEVEL_SELECTED` 也直接走这条。只开闸，不出声 —— 常驻音见 `startResidents` */
    private unlock(): void {
        if (this._unlocked) return;
        this._unlocked = true;
        this.startResidents();
    }

    /** 开场（选关 → 挡板 → 开头视频）演完：这时候才让 BGM 与常驻音进来 */
    private onGameStart(): void {
        this._started = true;
        this.startResidents();
    }

    private startResidents(): void {
        if (!this._unlocked || !this._started || this._muted || this._closed) return;
        for (const ch of this._channels) if (ch.resident && !ch.live) this.playCue(ch);
    }

    private playCue(ch: Channel): void {
        if (this._muted || !this._unlocked) return;
        // 终局之后才响的那两条本来就发生在关场之后，不受 `_closed` 拦（见 POST_OVER）
        if (this._closed && POST_OVER.indexOf(ch.cue.event) < 0) return;
        if (this._auto && AUTO_SILENT.indexOf(ch.cue.event) >= 0) return;
        const clip = this.nextClip(ch);
        if (!clip) return;
        const source = ch.source;
        source.clip = clip;
        // 带间隔的循环必须把引擎的 loop 关掉：`loop = true` 时 `ENDED` 永远不来，
        // 遍与遍之间就没法留静默
        const looping = ch.resident || ch.cue.loop;
        ch.gapLoop = looping && ch.cue.loopGap > 0;
        source.loop = looping && !ch.gapLoop;
        this.fade(ch, 0, 1, ch.cue.fadeIn);
        source.play();
        ch.live = true;
        this.fadeOutTail(ch, clip);
    }

    /** 「顺序音效列表」：每触发一次取下一格，一轮放完回到第一条。没配列表就用「音效」那一格 */
    private nextClip(ch: Channel): AudioClip {
        const list = ch.cue.sequence;
        if (!list.length) return ch.cue.clip;
        const clip = list[ch.seq];
        ch.seq = (ch.seq + 1) % list.length;
        return clip;
    }

    /** 带间隔的循环：每一遍末尾那一段渐出。用时长倒推起点 —— 这样它正好淡到这一遍结束，
     *  而不是在已经没声音的间隔里空淡。时长取不到就让它自然收尾，间隔照旧
     */
    private fadeOutTail(ch: Channel, clip: AudioClip): void {
        const out = ch.cue.fadeOut;
        if (!ch.gapLoop || out <= 0) return;
        const duration = clip.getDuration();
        if (duration <= out) return;
        this.scheduleOnce((): void => {
            if (ch.live && !this._muted) this.fade(ch, ch.gain.v, 0, out);
        }, duration - out);
    }

    /** 某条放完了。带间隔的循环在这儿排下一遍 —— 引擎的 `ENDED` 在暂停期间不来，
     *  所以切后台回来接着放的那一条后面自然接得上，不用额外照顾
     */
    private onEnded(source: AudioSource): void {
        if (this._closed) return;
        for (const ch of this._channels) {
            if (ch.source !== source || !ch.live || !ch.gapLoop) continue;
            this.scheduleOnce((): void => {
                if (ch.live && !this._closed) this.playCue(ch);
            }, ch.cue.loopGap);
        }
    }

    /** 「最后一格露面」的判法：`PIECE_SHOWN` 每格都发，凑满 `LEVEL_BUILT` 报的总数才是最后那一下
     *  —— 和 `SceneBgSwap` 内部同一个判断（背景就是这一拍开始扩散的），§5 不让改发射方、也不让加事件名，
     *  所以这边自己数一遍。 */
    private onLevelBuilt(data: unknown[]): void {
        this._total = 0;
        for (let i = 0; i < data.length; i++) if (!(data[i] as { slot: { prefilled: boolean } }).slot.prefilled) this._total++;
        this._shown = 0;
    }

    private onShown(): void {
        this._shown++;
        if (this._shown < this._total) return;
        for (const ch of this._channels) {
            if (ch.cue.event === AudioEvent.LAST_SHOWN) this.playCue(ch);
        }
    }

    private onAutoPlay(): void {
        this._auto = true;
    }

    private onGameOver(): void {
        this._auto = false;
    }

    private stopChannel(ch: Channel): void {
        const source = ch.source;
        if (ch.live && ch.cue.fadeOut > 0) {
            this.fade(ch, ch.gain.v, 0, ch.cue.fadeOut, (): void => source.stop());
        } else {
            source.stop();
        }
        ch.live = false;
    }

    /**
     * 把 gain 从 from 推到 to。from 要显式给：tween 是从**当前值**起步的，
     * 渐入时当前值还是上一次留下的满音量，不写死 0 就会「从 1 涨到 1」——一声都不渐。
     * time <= 0 就是当场到位；给了 done 就等推完再回调（渐出靠它压住 stop）。
     */
    private fade(ch: Channel, from: number, to: number, time: number, done?: () => void): void {
        Tween.stopAllByTarget(ch.gain);
        ch.gain.v = from;
        this.applyGain(ch);
        if (time <= 0) {
            ch.gain.v = to;
            this.applyGain(ch);
            if (done) done();
            return;
        }
        const tw = tween(ch.gain)
            .to(time, { v: to }, { easing: 'sineInOut', onUpdate: (): void => this.applyGain(ch) });
        if (done) tw.call(done);
        tw.start();
    }

    private applyGain(ch: Channel): void {
        ch.source.volume = ch.cue.volume * this.volume * ch.gain.v;
    }

    /** 结束界面亮出来（`SceneBgSwap` 换完底图）：全部停掉，也不再起新的 */
    private onEnd(): void {
        this.stopAll();
    }

    /** 点了锁着的关卡：先解锁再响（这一下发生在选关，全局 input 那条路不一定收到） */
    private onLockShake = (): void => {
        this.unlock();
        for (const ch of this._channels) {
            if (ch.cue.event === AudioEvent.LOCK_SHAKE) this.playCue(ch);
        }
    };

    /** 卡片被拖动起来：只认 CAROUSEL_SLIDE 那一条，不是总线事件 */
    private onCarouselSlide = (): void => {
        for (const ch of this._channels) {
            if (ch.cue.event === AudioEvent.CAROUSEL_SLIDE) this.playCue(ch);
        }
    };

    /** 卡片滑动停下：同一条收声（配了渐出就按渐出走） */
    private onCarouselSettle = (): void => {
        for (const ch of this._channels) {
            if (ch.cue.event === AudioEvent.CAROUSEL_SLIDE && ch.live) this.stopChannel(ch);
        }
    };

    private onCtaClick(): void {
        this.stopAll();
    }

    /** 关场停全部。例外见 `POST_OVER` —— 它们本来就是要盖在关场那一刻上的 */
    private stopAll(): void {
        this._closed = true;
        for (const ch of this._channels) {
            if (POST_OVER.indexOf(ch.cue.event) < 0) this.stopChannel(ch);
        }
    }

    private onMute(muted: boolean): void {
        this._muted = muted;
        for (const ch of this._channels) {
            if (!ch.live) continue;
            if (muted) ch.source.pause();
            else if ((ch.resident || ch.cue.loop) && !this._closed) ch.source.play();
        }
    }
}
