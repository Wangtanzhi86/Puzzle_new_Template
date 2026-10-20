import { _decorator, Node, UIOpacity, tween } from 'cc';
import { SlotAfterSnap } from './SlotAfterSnap';

const { ccclass, property } = _decorator;

/**
 * 毯子修好之后：女主淡出、女主姿势变化淡入 —— 两张图交叉过渡，不硬切。
 * 新姿势节点排在旧节点后面（兄弟序更靠后），淡入时压在淡出的旧图上。
 *
 * 挂在 Slot_04 上，默认勾「等本格揭晓演完再开始」。
 */
@ccclass('PoseCrossFade')
export class PoseCrossFade extends SlotAfterSnap {
    @property({ type: Node, displayName: '淡出的节点' })
    hideNode: Node = null;

    @property({ type: Node, displayName: '淡入的节点' })
    showNode: Node = null;

    @property({ displayName: '过渡时长（秒）', tooltip: '0 = 硬切' })
    fadeTime = 0.35;

    play(done: () => void): void {
        const show = this.showNode;
        const hide = this.hideNode;
        if (!show || !hide || this.fadeTime <= 0) {
            if (show) show.active = true;
            if (hide) hide.active = false;
            done();
            return;
        }
        show.active = true;
        const showOp = this.opacityOf(show);
        const hideOp = this.opacityOf(hide);
        showOp.opacity = 0;
        tween(showOp).to(this.fadeTime, { opacity: 255 }).start();
        tween(hideOp)
            .to(this.fadeTime, { opacity: 0 })
            .call(() => { hide.active = false; })
            .start();
        this.scheduleOnce(done, this.fadeTime);
    }

    private opacityOf(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    }
}
