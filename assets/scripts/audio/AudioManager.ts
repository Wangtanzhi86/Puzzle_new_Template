import { _decorator, AudioClip, AudioSource, Component, Enum, Input, input, Node, Tween, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 配置列表里「激活事件」「结束事件」两个下拉框的选项。
 * 除 NONE 以外，值就是 GameEvent 的名字本身，可以直接丢给 EventBus；
 * GameEvent 里加了新事件、想拿它当音频触发点，就在这里补一条。
 * `BUTTON_DOWN` 是唯一的例外 —— 它不是一个 EventBus 事件，是「按下 `buttons` 里那些按钮的那一瞬」。
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
    REPAIR_PROGRESS = 'REPAIR_PROGRESS',
    LEVEL_COMPLETE = 'LEVEL_COMPLETE',
    END_SHOW = 'END_SHOW',
    END_DROP = 'END_DROP',
    GUIDE_HIDE = 'GUIDE_HIDE',
    CTA_SHOW = 'CTA_SHOW',
    CTA_CLICK = 'CTA_CLICK',
    ORIENTATION_CHANGED = 'ORIENTATION_CHANGED',
    AUDIO_MUTE = 'AUDIO_MUTE',
    /** 不是 GameEvent：按下「按压音效按钮」列表里那些按钮的那一瞬 */
    BUTTON_DOWN = 'BUTTON_DOWN',
}

/**
 * 终局之后仍然要放的那几条：结束界面自己的音（`END_DROP`）、胜利风铃（`LEVEL_COMPLETE`）
 * 与按钮按下去的那一声（`BUTTON_DOWN`）。
 * 三者都贴在 `stopAll` 那一刻的近旁（结束界面亮出来 / 跳商店），没有这条豁免就是永远听不见 ——
 * 风铃最惨：最后一格吸附成功下一帧就 `mraid.open` 跳商店，`CTA_CLICK` 当场停全部；
 * 按压的那一声同理，松手就是 `CTA_CLICK`，不豁免的话它连按着的那一段都播不完。
 */
const POST_OVER: AudioEvent[] = [AudioEvent.END_DROP, AudioEvent.LEVEL_COMPLETE, AudioEvent.BUTTON_DOWN];

/** 一条音频配置：什么时候响、响什么、多大声、什么时候停 */
@ccclass('AudioCue')
export class AudioCue {
    @property({ type: Enum(AudioEvent), displayName: '激活事件', tooltip: '选「NONE」= 常驻：不绑任何事件，玩家首次点击屏幕后一直循环' })
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

    @property({ displayName: '循环间隔（秒）', tooltip: '常驻音专用：一遍放完先静这么久再从头起播。0 = 引擎的无限循环，遍与遍之间没有间隔' })
    loopGap = 0;

    @property({ type: Enum(AudioEvent), displayName: '结束事件', tooltip: '选「NONE」= 不主动停：一次性音效播完即止，常驻的一直循环' })
    stopEvent: AudioEvent = AudioEvent.NONE;
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
 * 1. 玩家第一次碰屏幕之前一声都不出（含 BGM）。碰哪儿都算 —— 碎片池那条路走 PIECE_PICK；
 * 2. 广告被切到后台整体静音，回来接着放常驻音（一次性音效不补）；
 * 3. 结束界面亮出来（`END_SHOW`）就停掉全部、也不再起新的；点 CTA 跳商店再兜一次。
 *
 * `END_SHOW` 是关场事件本身，绑在它上面的条目必然被自己的 stopAll 掐掉 ——
 * 结束界面要响的和终局才响的那两条走 `END_DROP`（logo / 按钮开始下落，晚 `bgFadeTime`，
 * 见 `CtaController`）与 `LEVEL_COMPLETE`（胜利风铃），见 `POST_OVER`。
 *
 * 条目有两种「多一个格子」：
 * - `sequence`：按顺序播的列表，每触发一次换下一条（音阶 1-6）；
 * - `loopGap`：常驻音每一遍之间留一段静默（女主哭泣），末尾按 `fadeOut` 淡下去。
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

    @property({ displayName: '总音量' })
    volume = 1;

    private _channels: Channel[] = [];
    private _nodes: Node = null;
    private _unlocked = false;
    private _muted = false;
    private _closed = false;

    protected onEnable(): void {
        if (!FeatureFlags.audio) return;
        // 解锁这两条必须排在 build() 里那些监听前面：第一次拖碎片时 PIECE_PICK
        // 得先把闸门打开，配置里那一声才放得出来（EventBus 按注册顺序派发）
        input.on(Input.EventType.TOUCH_START, this.unlock, this);
        EventBus.on(GameEvent.PIECE_PICK, this.unlock, this);
        EventBus.on(GameEvent.END_SHOW, this.onEnd, this);
        EventBus.on(GameEvent.CTA_CLICK, this.onCtaClick, this);
        EventBus.on(GameEvent.AUDIO_MUTE, this.onMute, this);
        this.build();
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.unlock, this);
        EventBus.off(GameEvent.PIECE_PICK, this.unlock, this);
        EventBus.off(GameEvent.END_SHOW, this.onEnd, this);
        EventBus.off(GameEvent.CTA_CLICK, this.onCtaClick, this);
        EventBus.off(GameEvent.AUDIO_MUTE, this.onMute, this);
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
            ch.onStart = (): void => this.playCue(ch);
            ch.onButton = (): void => {
                this.unlock();
                this.playCue(ch);
            };
            ch.onStop = (): void => this.stopChannel(ch);
            if (!ch.resident) {
                if (cue.event === AudioEvent.BUTTON_DOWN) {
                    for (const btn of this.buttons) btn.on(Node.EventType.TOUCH_START, ch.onButton, this);
                } else {
                    EventBus.on(cue.event, ch.onStart);
                }
            }
            if (cue.stopEvent !== AudioEvent.NONE) EventBus.on(cue.stopEvent, ch.onStop);
            this._channels.push(ch);
        }
    }

    /** 第一次真实触摸。碎片池上的触摸被 content 认领、全局 input 收不到，那条路由 PIECE_PICK 顶上 */
    private unlock(): void {
        if (this._unlocked) return;
        this._unlocked = true;
        for (const ch of this._channels) if (ch.resident) this.playCue(ch);
    }

    private playCue(ch: Channel): void {
        if (this._muted || !this._unlocked) return;
        // 终局之后才响的那两条本来就发生在关场之后，不受 `_closed` 拦（见 POST_OVER）
        if (this._closed && !POST_OVER.includes(ch.cue.event)) return;
        const clip = this.nextClip(ch);
        if (!clip) return;
        const source = ch.source;
        source.clip = clip;
        // 带间隔的循环必须把引擎的 loop 关掉：`loop = true` 时 `ENDED` 永远不来，
        // 遍与遍之间就没法留静默
        ch.gapLoop = ch.resident && ch.cue.loopGap > 0;
        source.loop = ch.resident && !ch.gapLoop;
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

    private onCtaClick(): void {
        this.stopAll();
    }

    /** 关场停全部。两条例外见 `POST_OVER` —— 它们本来就是要盖在关场那一刻上的 */
    private stopAll(): void {
        this._closed = true;
        for (const ch of this._channels) {
            if (!POST_OVER.includes(ch.cue.event)) this.stopChannel(ch);
        }
    }

    private onMute(muted: boolean): void {
        this._muted = muted;
        for (const ch of this._channels) {
            if (!ch.live) continue;
            if (muted) ch.source.pause();
            else if (ch.resident && !this._closed) ch.source.play();
        }
    }
}
