import { _decorator, Component, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { RevealHost } from '../gameplay/RepairReveal';

const { ccclass, property } = _decorator;

/**
 * 一格修好之后的收尾动作「敲击」：修复图立刻收掉，`fx`（`Scene_BG/修复效果`）整棵亮出来演一遍 ——
 * 大烟雾从「起始缩放比」果冻弹回原尺寸（每一下都横向拉长 / 纵向压扁，随弹动衰减回原形）、
 * 几团小烟雾按数组序渐显渐隐（**一轮接一轮循环**，一直演到整段结束）、几个小锤子按数组序**依次**敲
 * （一个敲完收掉，隔「交接间隔」下一个才出现，同一时刻只露一个），都跑完整棵再收掉。
 *
 * 大烟雾和锤子两支柱是**同时**开跑的，也是它们俩决定整段什么时候结束 —— 那几个子节点在编辑器里是
 * 摆在不同位置上的一整个构图，不是叠在一起的三个阶段；只有锤子之间论先后。小烟雾只跟着循环，
 * 不参与「演完没有」的计数。整段演完才算这一格露面（`PIECE_SHOWN` 延后，同另外四个动作）。
 *
 * 角度和缩放都拿**节点自己在编辑器里的姿势**当基准（`onLoad` 只读一次，同 `FireFlicker`）：
 * 两个锤子现读一个 -31.24°、一个 38.33°，各自从自己的角度摆。
 *
 * 挂在槽位节点上，由 `PieceSlot.hammerAction` 指过来 —— 没配的槽位完全不碰。
 */
@ccclass('HammerAction')
export class HammerAction extends Component {
    @property({ type: Node, displayName: '修复效果根节点', tooltip: '整棵效果的根（GameLayer/Scene_BG/修复效果）。开场由本组件收起、演完再收起，编辑器里照旧可见可调' })
    fx: Node = null;

    @property({ type: Node, displayName: '大烟雾', tooltip: '从「起始缩放比」果冻弹回原尺寸' })
    smoke: Node = null;

    @property({ type: [Node], displayName: '小烟雾', tooltip: '按数组序依次渐显渐隐，每个都要挂 UIOpacity' })
    puffs: Node[] = [];

    @property({ type: [Node], displayName: '锤子', tooltip: '按数组序依次敲：一个敲完收掉、隔「交接间隔」下一个才出现，同一时刻只露一个' })
    hammers: Node[] = [];

    @property({ displayName: '起始缩放比', tooltip: '大烟雾起手缩到原尺寸的多少倍，再果冻弹回去' })
    smokeFrom = 0.6;

    @property({ displayName: '弹动时长（秒）', tooltip: 'elasticOut —— 冲过头再荡回来，就是「果冻」那一下' })
    smokeTime = 0.6;

    @property({ displayName: '变形幅度', tooltip: '果冻弹的每一下都横向拉长、纵向压扁这么多，再随弹动衰减回原形。0 = 只缩放不变形' })
    smokeWobble = 0.35;

    @property({ displayName: '小烟雾渐显时长（秒）' })
    puffUp = 0.25;

    @property({ displayName: '小烟雾渐隐时长（秒）' })
    puffDown = 0.35;

    @property({ displayName: '小烟雾先后间隔（秒）', tooltip: '第一轮里相邻两团起淡的时间差' })
    puffStagger = 0.18;

    @property({ displayName: '小烟雾循环间隔（秒）', tooltip: '一团演完一轮渐显渐隐之后隔这么久再来一轮，一直循环到整段敲击演完' })
    puffGap = 0.2;

    @property({ displayName: '抬起角度（度）', tooltip: '按节点自己在编辑器里的角度为基准加这么多，填负数就是反方向' })
    liftAngle = 22;

    @property({ displayName: '抬起时长（秒）' })
    liftTime = 0.18;

    @property({ displayName: '砸下时长（秒）', tooltip: '比抬起短很多才像「砸」' })
    hitTime = 0.09;

    @property({ displayName: '每个锤子敲几下' })
    strikeCount = 2;

    @property({ displayName: '交接间隔（秒）', tooltip: '上一个锤子收掉之后，隔这么久下一个才出现' })
    handoff = 0.1;

    private _live: Tween<any>[] = [];
    private _swing = { v: 0 };
    private _alive = false;
    private _smokeBase = new Vec3(1, 1, 1);
    private _hammerBase: number[] = [];

    /** 效果整棵配齐、这一格又有修复图才接得住；否则调用方照旧直接抛 PIECE_SHOWN */
    handles(host: RevealHost): boolean {
        return !!this.fx && !!this.smoke && this.puffs.length > 0 && this.hammers.length > 0 && !!host.showView;
    }

    protected onLoad(): void {
        this.fx.active = false;
        this._smokeBase.set(this.smoke.scale);
        this._hammerBase = this.hammers.map((n) => n.eulerAngles.z);
    }

    play(host: RevealHost, onDone: () => void): void {
        this.stop();
        host.showView.node.active = false;
        this.fx.active = true;
        for (let i = 1; i < this.hammers.length; i++) this.hammers[i].active = false;
        EventBus.emit(GameEvent.REPAIR_FX);

        this._alive = true;
        // 只有大烟雾和锤子这两支决定整段什么时候结束；小烟雾一直循环，不参与计数
        let pending = 2;
        const step = (): void => {
            if (--pending === 0) {
                this._alive = false;
                this.fx.active = false;
                EventBus.emit(GameEvent.REPAIR_FX_HIDE);
                onDone();
            }
        };

        const pop = { p: this.smokeFrom, w: 1 };
        this.paintSmoke(pop.p, pop.w);
        this._live.push(tween(pop)
            .to(this.smokeTime, { p: 1, w: 0 }, { easing: 'elasticOut', onUpdate: () => this.paintSmoke(pop.p, pop.w) })
            .call(step)
            .start());

        this.puffs.forEach((_puff, i) => this.loopPuff(i, true));

        this.strike(0, step);
    }

    /** 大烟雾：`p` 是整体缩放比，`w` 是压扁量（横向 ×(1 + 变形幅度×w)、纵向 ×(1 − 变形幅度×w)） */
    private paintSmoke(p: number, w: number): void {
        this.smoke.setScale(
            this._smokeBase.x * p * (1 + this.smokeWobble * w),
            this._smokeBase.y * p * (1 - this.smokeWobble * w),
            this._smokeBase.z,
        );
    }

    /** 一团小烟雾：渐显 → 渐隐 → 隔「循环间隔」再来一轮，一直轮到整段演完（`_alive` 落下来）为止 */
    private loopPuff(i: number, first: boolean): void {
        if (!this._alive) return;
        const puff = this.puffs[i];
        const op = puff.getComponent(UIOpacity);
        puff.active = true;
        op.opacity = 0;
        const fade = { v: 0 };
        this._live.push(tween(fade)
            .delay(first ? i * this.puffStagger : this.puffGap)
            .to(this.puffUp, { v: 1 }, { easing: 'sineOut', onUpdate: () => { op.opacity = fade.v * 255; } })
            .to(this.puffDown, { v: 0 }, { easing: 'sineIn', onUpdate: () => { op.opacity = fade.v * 255; } })
            .call(() => this.loopPuff(i, false))
            .start());
    }

    /** 第 i 个锤子：抬起 → 砸下重复 `strikeCount` 次，收掉之后隔 `handoff` 才轮到下一个，最后一个演完才回调 */
    private strike(i: number, done: () => void): void {
        if (i >= this.hammers.length) {
            done();
            return;
        }
        const node = this.hammers[i];
        const base = this._hammerBase[i];
        node.active = true;
        this._swing.v = 0;
        const paint = (): void => node.setRotationFromEuler(0, 0, base + this.liftAngle * this._swing.v);
        let chain: Tween<any> = tween(this._swing);
        for (let c = 0; c < this.strikeCount; c++) {
            chain = chain
                .to(this.liftTime, { v: 1 }, { easing: 'sineOut', onUpdate: paint })
                .to(this.hitTime, { v: 0 }, { easing: 'quadIn', onUpdate: paint });
        }
        this._live.push(chain
            .delay(this.handoff)
            .call(() => {
                node.active = false;
                this.strike(i + 1, done);
            })
            .start());
    }

    private stop(): void {
        this._alive = false;
        for (const tw of this._live) tw.stop();
        this._live.length = 0;
    }

    protected onDisable(): void {
        this.stop();
    }
}
