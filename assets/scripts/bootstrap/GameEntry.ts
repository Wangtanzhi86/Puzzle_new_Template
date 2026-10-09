import { _decorator, Component, screen, Sprite, UITransform, view } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { LevelFactory } from '../level/LevelFactory';
import { applyScreenPolicy } from '../ui/ScreenAdapter';

const { ccclass, property } = _decorator;

/** 唯一入口。撑满屏幕 → 检测方向 → 广播事件 → 让关卡自己长出来。 */
@ccclass('GameEntry')
export class GameEntry extends Component {
    @property({ type: LevelFactory, displayName: '关卡工厂' }) levelFactory: LevelFactory = null;

    private _portrait = true;

    protected onLoad(): void {
        // 赶在第一帧的 Widget 对齐之前切策略，撑满屏幕这步才不会闪一下
        applyScreenPolicy();
        screen.on('window-resize', this.onResize, this);
    }

    protected start(): void {
        this._portrait = isPortrait();
        EventBus.emit(GameEvent.GAME_INIT);
        EventBus.emit(GameEvent.ORIENTATION_CHANGED, this._portrait);
        this.levelFactory.build();
        this.scheduleOnce(this.probe, 0.5);
    }

    private probe(): void {
        try {
            const c = this.node;
            const ut = (p: string) => c.getChildByPath(p).getComponent(UITransform);
            const bg = c.getChildByPath('BackgroundLayer/Bg_Sprite');
            const sp = bg.getComponent(Sprite);
            console.log('[Probe] frame=' + JSON.stringify(view.getFrameSize())
                + ' visible=' + JSON.stringify(view.getVisibleSize())
                + ' canvas=' + c.getComponent(UITransform).width + 'x' + c.getComponent(UITransform).height
                + ' layer=' + ut('BackgroundLayer').height
                + ' bg=' + ut('BackgroundLayer/Bg_Sprite').width + 'x' + ut('BackgroundLayer/Bg_Sprite').height
                + ' type=' + sp.type + ' insetT=' + sp.spriteFrame.insetTop
                + ' game=' + ut('GameLayer').height
                + ' sceneBg=' + ut('GameLayer/Scene_BG').height
                + ' pool=' + ut('PiecePoolLayer').height
                + ' progressY=' + c.getChildByPath('UILayer/ProgressLayer').position.y);
        } catch (e) {
            console.log('[Probe] err ' + (e as Error).message);
        }
    }

    protected onDestroy(): void {
        screen.off('window-resize', this.onResize, this);
        EventBus.offTarget(this);
    }

    private onResize(): void {
        const resized = applyScreenPolicy();
        const portrait = isPortrait();
        if (!resized && portrait === this._portrait) return;
        this._portrait = portrait;
        EventBus.emit(GameEvent.ORIENTATION_CHANGED, portrait);
    }
}

/** 用窗口真实比例判方向：撑满之后 getVisibleSize() 跟着策略走，方形窗口会被它判成竖屏。 */
function isPortrait (): boolean {
    const frame = view.getFrameSize();
    return frame.height >= frame.width;
}
