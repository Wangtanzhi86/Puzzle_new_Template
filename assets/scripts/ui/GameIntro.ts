import { _decorator, Component } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { EndVideo } from '../platform/EndVideo';

const { ccclass, property } = _decorator;

/**
 * 点关开场：玩家点完关卡，直接起播 `IntroLayer/开头视频`。
 *
 * 不再把点中的关卡图搬到全屏层放大，也不再有残影 / 缩放模糊 —— 那套已删；
 * 视频播完（或点一下跳过、或 `EndVideo.fallbackTime` 兜底）才收场。
 */
@ccclass('GameIntro')
export class GameIntro extends Component {
    @property({ type: EndVideo, displayName: '开头视频', tooltip: '留空 = 点关直接进游戏' })
    video: EndVideo = null;

    @property({ displayName: '跳过开场视频', tooltip: '勾上 = 点关直接进游戏（照常发 GAME_START），不播视频' })
    skip = false;

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_SELECTED, this.onLevelSelected, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_SELECTED, this.onLevelSelected, this);
    }

    private onLevelSelected = (): void => {
        if (this.skip || !this.video || !this.video.play(this.finish)) this.finish();
    };

    private finish = (): void => {
        this.node.active = false;
        EventBus.emit(GameEvent.GUIDE_RESUME);
        EventBus.emit(GameEvent.GAME_START);
    };
}
