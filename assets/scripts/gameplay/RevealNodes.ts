import { _decorator, Node, UIOpacity, Vec3, tween } from 'cc';
import { SlotAfterSnap } from './SlotAfterSnap';

const { ccclass, property } = _decorator;

/**
 * 吸附之后同时打开几个节点（Slot_02：石膏胳膊 + 男主表情）。挂在 Slot_02 上。
 * 打开时做一次淡入 + 轻微放大，避免硬切。
 */
@ccclass('RevealNodes')
export class RevealNodes extends SlotAfterSnap {
    @property({ type: [Node], displayName: '要同时打开的节点' })
    nodes: Node[] = [];

    @property({ displayName: '淡入时长（秒）' })
    fadeTime = 0.35;

    @property({ displayName: '起始缩放', tooltip: '1 = 只淡入不缩放；0.9 = 从小一号放大到原尺寸' })
    scaleFrom = 0.9;

    play(done: () => void): void {
        const list = this.nodes.filter((node) => !!node);
        if (!list.length || this.fadeTime <= 0) {
            for (const node of list) node.active = true;
            done();
            return;
        }
        for (const node of list) {
            let opacity = node.getComponent(UIOpacity);
            if (!opacity) opacity = node.addComponent(UIOpacity);
            const target: Vec3 = node.scale.clone();
            node.active = true;
            opacity.opacity = 0;
            node.setScale(target.x * this.scaleFrom, target.y * this.scaleFrom, target.z);
            tween(opacity).to(this.fadeTime, { opacity: 255 }, { easing: 'quadOut' }).start();
            tween(node).to(this.fadeTime, { scale: target }, { easing: 'quadOut' }).start();
        }
        this.scheduleOnce(done, this.fadeTime);
    }
}
