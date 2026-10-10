import { _decorator, Component, Node, Tween, UIOpacity, UITransform, Vec2, Vec3, tween } from 'cc';
import { RevealHost } from '../gameplay/RepairReveal';

const { ccclass, property } = _decorator;

/**
 * 一格修好之后的收尾动作「扫地」：扫把挪到物品正中间，**一开摆物品就同步按顺序依次渐隐**，
 * 摆完扫把立即收起 —— 最后一个物品隐完这一格才算露面。
 *
 * 没有扫地序列帧，摆动是程序算的（移动 + 旋转）。中点取各物品位置的平均值，物品位置取世界坐标
 * 再换算到扫把父节点空间，所以转屏 / 改布局都不会跑偏（和工程里「世界坐标一律现读」一致）。
 *
 * 挂在槽位节点上，由 `PieceSlot.sweepAction` 指过来 —— 没配的槽位完全不碰。
 */
@ccclass('BroomSweep')
export class BroomSweep extends Component {
    @property({ type: Node, displayName: '物品父节点', tooltip: '它下面的每个子节点依次被扫走' })
    items: Node = null;

    @property({ type: Vec2, displayName: '中点微调（px）', tooltip: '扫把中心相对物品中点的偏移' })
    offset = new Vec2(0, 0);

    @property({ displayName: '挪到中点的时长（秒）' })
    moveTime = 0.35;

    @property({ displayName: '摆动角度（度）', tooltip: '左右各摆到 ± 这个角度' })
    sweepAngle = 16;

    @property({ displayName: '摆动来回次数', tooltip: '1 = 摆过去再摆回来' })
    sweepCycles = 2;

    @property({ displayName: '摆动单程时长（秒）' })
    sweepTime = 0.15;

    @property({ displayName: '摆动时右移距离（px）', tooltip: '摆动期间扫把整体向右推进多少，看着像真的在扫；0 = 原地摆' })
    sweepMoveX = 120;

    @property({ displayName: '物品渐隐间隔（秒）', tooltip: '前一个隐完到下一个开始隐之间的停顿' })
    gap = 0.1;

    @property({ displayName: '物品渐隐时长（秒）', tooltip: '0 = 大约一帧内直接隐藏' })
    fadeTime = 0.3;

    private _live: Tween<any>[] = [];

    /** 有物品可扫、这一格又有修复图才接得住；否则调用方照旧直接抛 PIECE_SHOWN */
    handles(host: RevealHost): boolean {
        return !!this.items && this.items.children.length > 0 && !!host.showView;
    }

    play(host: RevealHost, onDone: () => void): void {
        this.stop();
        const broom = host.showView.node;
        const parent = broom.parent.getComponent(UITransform);
        const z = broom.position.z;

        // 中点 = 各物品位置的平均（世界坐标换算到扫把父节点空间）
        const kids = this.items.children;
        let mid = new Vec3(0, 0, z);
        for (const item of kids) {
            const p = parent.convertToNodeSpaceAR(item.worldPosition);
            mid.x += p.x / kids.length;
            mid.y += p.y / kids.length;
        }
        mid.x += this.offset.x;
        mid.y += this.offset.y;

        // 扫把挪到中点 → 一开摆物品就同步依次渐隐、扫把同时向右推进 → 摆完立即收起
        const chain = tween(broom).to(this.moveTime, { position: mid }, { easing: 'quadInOut' });
        chain.call(() => {
            this.fadeItems(onDone);
            this.advance(broom, mid, this.sweepCycles * 2 * this.sweepTime);
        });
        for (let i = 0; i < this.sweepCycles * 2; i++) {
            chain.to(this.sweepTime, { angle: i % 2 === 0 ? this.sweepAngle : 0 }, { easing: 'sineInOut' });
        }
        chain.call(() => { broom.active = false; });
        this._live.push(chain.start());
    }

    /** 摆动期间整体匀速向右推进，看着像在扫过去。和角度那条链是同一个节点上的两条 tween，
     *  各写各的属性（position / angle），引擎的 ActionManager 按目标累积动作、互不顶掉。 */
    private advance(broom: Node, from: Vec3, time: number): void {
        this._live.push(tween(broom)
            .to(time, { position: new Vec3(from.x + this.sweepMoveX, from.y, from.z) }, { easing: 'linear' })
            .start());
    }

    private fadeItems(onDone: () => void): void {
        const kids = this.items.children;
        kids.forEach((item, i) => {
            this._live.push(tween(item.getComponent(UIOpacity))
                .delay(i * (this.fadeTime + this.gap))
                .to(this.fadeTime, { opacity: 0 }, { easing: 'sineIn' })
                .call(() => {
                    item.active = false;
                    if (i === kids.length - 1) onDone();
                })
                .start());
        });
    }

    private stop(): void {
        for (const tw of this._live) tw.stop();
        this._live.length = 0;
    }

    protected onDisable(): void {
        this.stop();
    }
}
