import { _decorator, AudioClip, AudioSource, Component, Enum, Input, input, Node, Tween, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 配置列表里「激活事件」「结束事件」两个下拉框的选项。
 * 除 NONE 以外，值就是 GameEvent 的名字本身，可以直接丢给 EventBus；
 * GameEvent 里加了新事件、想拿它当音频触发点，就在这里补一条。
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
    EXTINGUISH_SPRAY = 'EXTINGUISH_SPRAY',
    EXTINGUISH_SHAKE = 'EXTINGUISH_SHAKE',
    FIRE_HIDE = 'FIRE_HIDE',
    REPAIR_FX = 'REPAIR_FX',
    REPAIR_FX_HIDE = 'REPAIR_FX_HIDE',
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
}

/** 一条音频配置：什么时候响、响什么、多大声、什么时候停 */
@ccclass('AudioCue')
export class AudioCue {
    @property({ type: Enum(AudioEvent), displayName: '激活事件', tooltip: '选「NONE」= 常驻：不绑任何事件，玩家首次点击屏幕后一直循环' })
    event: AudioEvent = AudioEvent.NONE;

    @property({ type: AudioClip, displayName: '音效' })
    clip: AudioClip = null;

    @property({ displayName: '音量', tooltip: '与总音量相乘' })
    volume = 1;

    @property({ displayName: '渐入时长（秒）', tooltip: '起播时音量从 0 涨上来。0 = 直接满音量。BGM 这种循环的用得上，一次性音效一般留 0' })
    fadeIn = 0;

    @property({ displayName: '渐出时长（秒）', tooltip: '停止时音量先降到 0 再真停。0 = 当场停' })
    fadeOut = 0;

    @property({ displayName: '循环播放', tooltip: '起播后一直循环，直到「结束事件」把它停掉。常驻音（激活事件选 NONE）本来就循环，不用勾这个' })
    loop = false;

    @property({ displayName: '循环间隔（秒）', tooltip: '一轮播完到下一轮起播之间空多久。0 = 无缝接上（走 AudioSource 自己的循环）；填了正数就一轮一轮排：播到剩「渐出时长」那么长开始渐出 → 停 → 空这么久 → 再渐入重来 —— 想有渐入渐出就必须填这个' })
    loopGap = 0;

    @property({ type: Enum(AudioEvent), displayName: '结束事件', tooltip: '选「NONE」= 不主动停：一次性音效播完即止，常驻的一直循环' })
    stopEvent: AudioEvent = AudioEvent.NONE;

    @property({ displayName: '结束事件只认第几格', tooltip: '0 = 任意一格都停（默认）。填 N = 只有第 N 格（Slot_0N，按碎片排列序）抛那个结束事件时才停。⚠️ 只对带着槽位序号的结束事件有意义（修复后露面 / 修好 / 修错了）—— 配别的等于永不主动停' })
    stopSlot = 0;
}

/** 一条配置对应一个 AudioSource：共用一份就停不掉单条 */
interface Channel {
    cue: AudioCue;
    source: AudioSource;
    /** 常驻音（激活事件选 NONE）：一直循环 */
    resident: boolean;
    /** 起播了、还没被停过 —— 「跳转停全部」和「后台回来要不要接着放」都看它 */
    live: boolean;
    /** 0–1 的音量系数。渐入渐出推的就是它，不直接写 source.volume —— 那样 fade 就没有起点 */
    gain: { v: number };
    onStart: () => void;
    /** 结束事件带什么参数就收什么 —— 「只认第几格」那条要读事件里的槽位序号 */
    onStop: (...args: any[]) => void;
    /** 带间隔的循环排在那儿的那次定时（渐出 / 空档 / 下一轮），停这条时要能撤掉 */
    tick: () => void;
}

/**
 * 音频总控。配置列表里一条一条写「什么时候响、响什么、多大声、什么时候停」，
 * BGM 和常驻背景音就是把「激活事件」留成 NONE。
 *
 * 三条硬规矩（AppLovin 合规，§8.4）：
 * 1. 玩家第一次碰屏幕之前一声都不出（含 BGM）。碰哪儿都算 —— 碎片池那条路走 PIECE_PICK；
 * 2. 广告被切到后台整体静音，回来接着放常驻音（一次性音效不补）；
 * 3. 结束界面亮出来（`END_SHOW`）就停掉全部、也不再起新的；`GAME_OVER`（终局那一跳之前）与点 CTA
 *    跳商店各再兜一次。⚠️ `GAME_OVER` 这条是**给失败动画留的位**：那段视频自带声音（DOM 元素，
 *    不归这儿管），播它之前必须先让游戏这盘音停下来，否则两路声音叠在一起（§18）。
 *
 * `END_SHOW` 是关场事件本身，绑在它上面的条目必然被自己的 stopAll 掐掉 ——
 * 结束界面要响的走 `END_DROP`（logo / 按钮开始下落，晚 `bgFadeTime`，见 `CtaController`）。
 */
@ccclass('AudioManager')
export class AudioManager extends Component {
    @property({ type: [AudioCue], displayName: '音频配置', tooltip: 'BGM 与常驻背景音把「激活事件」留成 NONE' })
    cues: AudioCue[] = [];

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
        EventBus.on(GameEvent.GAME_OVER, this.onEnd, this);
        EventBus.on(GameEvent.CTA_CLICK, this.onCtaClick, this);
        EventBus.on(GameEvent.AUDIO_MUTE, this.onMute, this);
        this.build();
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.unlock, this);
        EventBus.off(GameEvent.PIECE_PICK, this.unlock, this);
        EventBus.off(GameEvent.END_SHOW, this.onEnd, this);
        EventBus.off(GameEvent.GAME_OVER, this.onEnd, this);
        EventBus.off(GameEvent.CTA_CLICK, this.onCtaClick, this);
        EventBus.off(GameEvent.AUDIO_MUTE, this.onMute, this);
        for (const ch of this._channels) {
            EventBus.off(ch.cue.event, ch.onStart);
            EventBus.off(ch.cue.stopEvent, ch.onStop);
            Tween.stopAllByTarget(ch.gain);
            this.cancel(ch);
        }
        this._channels = [];
        if (this._nodes) {
            this._nodes.destroy();
            this._nodes = null;
        }
    }

    private build(): void {
        this._nodes = new Node('AudioChannels');
        this._nodes.setParent(this.node);
        for (const cue of this.cues) {
            if (!cue.clip) continue;
            const source = this._nodes.addComponent(AudioSource);
            source.playOnAwake = false;
            const ch: Channel = {
                cue,
                source,
                resident: cue.event === AudioEvent.NONE,
                live: false,
                gain: { v: 1 },
                onStart: null,
                onStop: null,
                tick: null,
            };
            ch.onStart = (): void => this.playCue(ch);
            // 「只认第几格」是给常驻音用的（第 6 格修好才停女人哭那种）：
            // 结束事件带着槽位序号来时先对一下，不是那一格就不停
            ch.onStop = cue.stopSlot > 0
                ? (slotIndex: number): void => { if (slotIndex === cue.stopSlot - 1) this.stopChannel(ch); }
                : (): void => this.stopChannel(ch);
            if (!ch.resident) EventBus.on(cue.event, ch.onStart);
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
        // 绑在 END_DROP 上的那条就是结束界面自己的音，本来就发生在关场之后，不受 `_closed` 拦
        if (this._closed && ch.cue.event !== AudioEvent.END_DROP) return;
        const source = ch.source;
        source.clip = ch.cue.clip;
        const repeats = ch.resident || ch.cue.loop;
        // 填了「循环间隔」就不交给 AudioSource 自己的 loop —— 那个是无缝接上的，
        // 中间既没有空档也没有渐出。改成一轮一轮自己排，才能「渐入 → 播 → 渐出 → 空 → 再来」
        source.loop = repeats && ch.cue.loopGap <= 0;
        this.fade(ch, 0, 1, ch.cue.fadeIn);
        source.play();
        ch.live = true;
        if (repeats && ch.cue.loopGap > 0) this.cycle(ch);
    }

    /** 带间隔的一轮：播到「还剩渐出时长那么长」就开始渐出，停了空 `循环间隔` 再整轮重来 */
    private cycle(ch: Channel): void {
        this.plan(ch, Math.max(0, ch.cue.clip.getDuration() - ch.cue.fadeOut), (): void => {
            this.fade(ch, ch.gain.v, 0, ch.cue.fadeOut, (): void => {
                ch.source.stop();
                this.plan(ch, ch.cue.loopGap, (): void => this.playCue(ch));
            });
        });
    }

    /** 排一次定时，并把这次的回调记在通道上 —— 停这条 / 静音 / 销毁时要能撤掉 */
    private plan(ch: Channel, delay: number, fn: () => void): void {
        ch.tick = fn;
        this.scheduleOnce(fn, delay);
    }

    private stopChannel(ch: Channel): void {
        this.cancel(ch);
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

    /** 关场：结束界面亮出来（`SceneBgSwap` 换完底图）/ 终局那一跳之前。全部停掉，也不再起新的 */
    private onEnd(): void {
        this.stopAll();
    }

    private onCtaClick(): void {
        this.stopAll();
    }

    private stopAll(): void {
        this._closed = true;
        for (const ch of this._channels) this.stopChannel(ch);
    }

    private cancel(ch: Channel): void {
        if (!ch.tick) return;
        this.unschedule(ch.tick);
        ch.tick = null;
    }

    private onMute(muted: boolean): void {
        this._muted = muted;
        for (const ch of this._channels) {
            if (!ch.live) continue;
            if (muted) {
                // 带间隔的那条排的定时得撤掉：不然回来时它已经在「空档」里，
                // 下一轮接不上，这声就再也不响了
                this.cancel(ch);
                ch.source.pause();
            } else if (ch.resident && !this._closed) {
                // 带间隔的从整轮开头重放（`play()` 在暂停过的源上是从暂停处接着走的，
                // 那样这一轮的时长就对不上了）
                if (ch.cue.loopGap > 0) {
                    ch.source.stop();
                    this.playCue(ch);
                } else {
                    ch.source.play();
                }
            }
        }
    }
}
