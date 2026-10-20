import { _decorator, Component } from 'cc';
import { Particle2D } from '../effects/Particle2D';

const { ccclass, property } = _decorator;

/**
 * 正中卡片那一圈「四散」：直接复用工程里现成的 `Particle2D`（2.x 粒子复刻），
 * 不自己撒 Sprite —— 加色材质、发射角、速度、颜色渐变全在 Inspector 里调。
 *
 * 粒子系统是持续发射的，所以这里只让它开一小会儿：`resetSystem()` 发射 `emitTime` 秒后 `stopSystem()`，
 * 已发射的粒子自然消亡。
 */
@ccclass('CardBurst')
export class CardBurst extends Component {
    @property({ type: Particle2D, displayName: '粒子系统' }) fx: Particle2D = null;
    @property({ displayName: '发射时长（秒）' }) emitTime = 0.08;

    burst (): void {
        if (!this.fx) return;
        this.fx.resetSystem();
        this.scheduleOnce(() => this.fx && this.fx.stopSystem(), this.emitTime);
    }
}
