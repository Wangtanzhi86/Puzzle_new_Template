import { _decorator } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { Particle2D } from '../effects/Particle2D';
import { CircleReveal } from './CircleReveal';
import { RevealHost } from './RepairReveal';

const { ccclass, property } = _decorator;

/**
 * 金色烟花 + 圆形扩散揭晓：吸附成功先在缺口中心炸一团金色粒子，再照旧从中心圆形扩出修复图。
 *
 * 就是 CircleReveal 加一段前奏 —— 扩散那套（材质、羽化、收尾收破损图）全部复用父类，
 * 所以这里只管两件事：把烟花节点挪到这一格中心、放完再调 super.play()。
 *
 * 挂在 EffectLayer 上（和 CircleReveal / SnapReveal 并列），全局一个实例，各槽位填
 * PieceSlot.fireworkReveal 指过来。开关是 FeatureFlags.fireworkReveal。
 */
@ccclass('FireworkReveal')
export class FireworkReveal extends CircleReveal {
    @property({ type: Particle2D, displayName: '金色烟花', tooltip: '粒子参数全在这个节点上；「进场就播」必须关掉（由本组件按吸附时机点放）' })
    burst: Particle2D = null;

    @property({ displayName: '烟花提前量（秒）', tooltip: '烟花先炸，隔这么久修复图才开始圆形扩散' })
    burstLead = 0.24;

    @property({ displayName: '烟花发射时长（秒）', tooltip: '发射这么久就掐掉，已出来的粒子自己飞完' })
    burstTime = 0.16;

    handles(host: RevealHost): boolean {
        return FeatureFlags.fireworkReveal && !!this.burst && !!this.revealEffect && !!host.showView;
    }

    play(host: RevealHost, onRevealed: () => void): void {
        this.burst.node.setWorldPosition(host.worldCenter);
        this.burst.resetSystem();
        this.scheduleOnce(() => this.burst.stopSystem(), this.burstTime);
        this.scheduleOnce(() => super.play(host, onRevealed), this.burstLead);
    }

    protected onDisable(): void {
        super.onDisable();
        if (this.burst) this.burst.stopSystem();
    }
}
