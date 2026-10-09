import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/**
 * 横竖屏各一张底图：转屏时换 `Bg_Sprite` 的 spriteFrame。
 *
 * 竖屏那张不另配口 —— `onLoad` 读的就是场景里挂在 `Bg_Sprite` 上的那张，转回来原样还回去
 *（和 `SceneBgSwap` 一样「图只配一处」）。两张都铺满画布，靠 `Bg_Sprite` 自己的四边 Widget 与
 * `type = SLICED`：横屏新图的 inset 现在是 0，等于纯拉伸，要护住边上的构图元素就改那张图的 `.meta`
 *（跟竖版 `背景图.jpg` 一样四边配 160）→ 重新导入 → 看 Game View。
 */
@ccclass('BackgroundSwap')
export class BackgroundSwap extends Component {
    @property({ type: Sprite, displayName: '整体背景（Bg_Sprite）' }) bg: Sprite = null;
    @property({ type: SpriteFrame, displayName: '横屏背景图' }) landscapeFrame: SpriteFrame = null;

    private _portraitFrame: SpriteFrame = null;

    protected onLoad(): void {
        this._portraitFrame = this.bg.spriteFrame;
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
    }

    private onOrientation(portrait: boolean): void {
        this.bg.spriteFrame = portrait ? this._portraitFrame : this.landscapeFrame;
    }
}
