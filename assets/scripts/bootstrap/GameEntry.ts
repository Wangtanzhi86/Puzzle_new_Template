import { _decorator, Component, screen, Sprite, UITransform } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { frameSize, visibleSize } from '../core/UISpace';
import { LevelFactory } from '../level/LevelFactory';
import { applyScreenPolicy } from '../ui/ScreenAdapter';

const { ccclass, property } = _decorator;

/** 唯一入口。撑满屏幕 → 检测方向 → 广播事件 → 让关卡自己长出来。 */
@ccclass('GameEntry')
export class GameEntry extends Component {
    @property({ type: LevelFactory, displayName: '关卡工厂' }) levelFactory: LevelFactory = null;

    private _portrait = true;
    /** 选中的关卡序号（现在关卡内容只有一套，先存着当接口） */
    private _levelId = 0;

    protected onLoad(): void {
        // 赶在第一帧的 Widget 对齐之前切策略，撑满屏幕这步才不会闪一下
        applyScreenPolicy();
        screen.on('window-resize', this.onResize, this);
    }

    protected start(): void {
        this._portrait = isPortrait();
        EventBus.emit(GameEvent.GAME_INIT);
        EventBus.emit(GameEvent.ORIENTATION_CHANGED, this._portrait);
        // 先亮选关（Canvas/Change），玩家点完关卡才建关 —— 建早了会在挡板后面自己演起来
        EventBus.on(GameEvent.LEVEL_SELECTED, this.onLevelSelected, this);
    }

    private onLevelSelected(levelId: number): void {
        EventBus.off(GameEvent.LEVEL_SELECTED, this.onLevelSelected, this);
        this._levelId = levelId;
        this.levelFactory.build();
        // 建关会顺手把空闲引导的计时器安上；开场动画和「点击开始」期间不许它抢戏
        EventBus.emit(GameEvent.GUIDE_HOLD);
        this.scheduleOnce(this.probe, 0.5);
    }

    private probe(): void {
        try {
            const c = this.node;
            const ut = (p: string) => c.getChildByPath(p).getComponent(UITransform);
            const bg = c.getChildByPath('BackgroundLayer/Bg_Sprite');
            const sp = bg.getComponent(Sprite);
            const progress = c.getChildByName('ProgressLayer') || c.getChildByPath('UILayer/ProgressLayer');
            console.log('[Probe] frame=' + JSON.stringify(frameSize())
                + ' visible=' + JSON.stringify(visibleSize())
                + ' canvas=' + c.getComponent(UITransform).width + 'x' + c.getComponent(UITransform).height
                + ' layer=' + ut('BackgroundLayer').height
                + ' bg=' + ut('BackgroundLayer/Bg_Sprite').width + 'x' + ut('BackgroundLayer/Bg_Sprite').height
                + ' type=' + sp.type + ' insetT=' + sp.spriteFrame.insetTop
                + ' game=' + ut('GameLayer').height
                + ' sceneBg=' + ut('GameLayer/Scene_BG').height
                + ' pool=' + ut('PiecePoolLayer').height
                + ' progressY=' + (progress ? progress.position.y : 'n/a'));
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
    const frame = frameSize();
    return frame.height >= frame.width;
}
