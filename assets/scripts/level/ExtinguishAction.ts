import { _decorator, Component, Node, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { RevealHost } from '../gameplay/RepairReveal';

const { ccclass, property } = _decorator;

/**
 * 一格修好之后的收尾动作「灭火」，四段串行：① 抬到原位上方 → 落回原位（这一趟叫「到位」，还是待机
 * 那张图）；② 到位之后**上下摇晃**几下；③ 摇完才换成「喷射」那张（对齐到瓶身不动）；④ 火焰渐隐、
 * 淡完隐藏，灭火器紧跟着淡掉，这一格才算露面。
 *
 * **两张贴图的画布一样大**（都是 1536×1024），只是自动裁切框不同：待机框在画布右侧一条竖条里，
 * 喷射框几乎铺满整张画布（多出来的是左边那团雾）。而 Sprite 开着 `trim` 时是「**裁切框铺满节点框**」
 * ——换一张裁切框更大的图，内容会被按比例缩进去、位置也跟着跑，瓶身会跳一下。
 * 对齐量按两张裁切框的比现算：缩放 = 两张裁切框尺寸之比，位移 = 两张 `offset`（裁切框中心相对
 * 整张画布中心的偏移）之差。这样**画布坐标到节点坐标的映射**两张完全一致，瓶身一个像素都不动。
 * 全部现算，改节点尺寸 / 换图都不用回来改常量。
 *
 * 挂在槽位节点上，由 `PieceSlot.extinguishAction` 指过来 —— 没配的槽位完全不碰。
 */
@ccclass('ExtinguishAction')
export class ExtinguishAction extends Component {
    @property({ type: SpriteFrame, displayName: '喷射贴图', tooltip: '上下摇晃**摇完**才换上的那张（喷出雾的姿势）。没配这一格整套动作不生效' })
    mistFrame: SpriteFrame = null;

    @property({ type: Node, displayName: '火焰节点', tooltip: '换图之后它渐隐、淡完隐藏（要挂 UIOpacity）' })
    fire: Node = null;

    @property({ displayName: '抬起高度（px）', tooltip: '先抬到原位上方这么多，再落回原位 —— 这一趟就是「到位」；填 0 就是原地不动' })
    rise = 60;

    @property({ displayName: '落位时长（秒）', tooltip: '从抬起的高度落回原位要多久' })
    dropTime = 0.9;

    @property({ displayName: '摇晃次数', tooltip: '到位之后上下摇晃几个来回' })
    shakeCount = 3;

    @property({ displayName: '摇晃幅度（px）', tooltip: '摇晃时往上荡出去多少，填负数就变成先往下' })
    shakeDepth = 20;

    @property({ displayName: '单程摇晃时长（秒）', tooltip: '一上或一下要多久，蹦一个来回落两趟 —— 总时长 = 摇晃次数 × 这个 × 2' })
    shakeTime = 0.12;

    @property({ displayName: '火焰起淡延迟（秒）', tooltip: '从**换图**那一刻算起，隔这么久火才开始淡' })
    fireDelay = 0.2;

    @property({ displayName: '火焰渐隐时长（秒）' })
    fireFadeTime = 0.45;

    @property({ displayName: '灭火器渐隐时长（秒）', tooltip: '火灭了之后灭火器淡掉；填 0 就是直接收掉（和「喷瓶」那样硬隐藏）' })
    mistFadeTime = 0.3;

    private _live: Tween<any>[] = [];

    /** 配了喷射图、火焰节点，这一格又有修复图才接得住；否则调用方照旧直接抛 PIECE_SHOWN */
    handles(host: RevealHost): boolean {
        return !!this.mistFrame && !!this.fire && !!host.showView;
    }

    play(host: RevealHost, onDone: () => void): void {
        this.stop();
        const view = host.showView.node;
        const base = view.position.clone();
        const baseScale = view.scale.clone();
        view.setPosition(base.x, base.y + this.rise, base.z);

        const drop = { y: base.y + this.rise };
        this._live.push(tween(drop)
            .to(this.dropTime, { y: base.y }, { easing: 'sineInOut', onUpdate: () => view.setPosition(base.x, drop.y, base.z) })
            .call(() => this.shake(view, base, () => this.spray(view, base, baseScale, onDone)))
            .start());
    }

    /** 到位之后上下摇晃：来回 `shakeCount` 次，一上一下算两趟，摇完才回调 */
    private shake(view: Node, base: Vec3, done: () => void): void {
        EventBus.emit(GameEvent.EXTINGUISH_SHAKE);
        const bob = { v: 0 };
        const paint = (): void => view.setPosition(base.x, base.y + this.shakeDepth * bob.v, base.z);
        let chain: Tween<any> = tween(bob);
        for (let c = 0; c < this.shakeCount; c++) {
            chain = chain
                .to(this.shakeTime, { v: 1 }, { easing: 'sineInOut', onUpdate: paint })
                .to(this.shakeTime, { v: 0 }, { easing: 'sineInOut', onUpdate: paint });
        }
        this._live.push(chain.call(done).start());
    }

    /** 摇完才换「喷射」那张（按两张裁切框对齐到瓶身不动）→ 火焰渐隐 → 淡完轮到灭火器自己 */
    private spray(view: Node, base: Vec3, baseScale: Vec3, onDone: () => void): void {
        const sprite = view.getComponent(Sprite);
        const ut = view.getComponent(UITransform);
        const w = ut.width;
        const h = ut.height;
        const from = sprite.spriteFrame;
        sprite.spriteFrame = this.mistFrame;
        // CUSTOM 的 Sprite 一换帧就会把节点框改成贴图尺寸（同 `PieceGlow.apply` 那个坑），钉回去
        ut.setContentSize(w, h);

        const kx = this.mistFrame.rect.width / from.rect.width;
        const ky = this.mistFrame.rect.height / from.rect.height;
        const dx = (this.mistFrame.offset.x - from.offset.x) * w / from.rect.width + (0.5 - ut.anchorX) * w * (1 - kx);
        const dy = (this.mistFrame.offset.y - from.offset.y) * h / from.rect.height + (0.5 - ut.anchorY) * h * (1 - ky);
        view.setScale(baseScale.x * kx, baseScale.y * ky, baseScale.z);
        view.setPosition(base.x + dx * baseScale.x, base.y + dy * baseScale.y, base.z);
        EventBus.emit(GameEvent.EXTINGUISH_SPRAY);

        const fire = this.fire.getComponent(UIOpacity);
        const fade = { a: fire.opacity / 255 };
        this._live.push(tween(fade)
            .delay(this.fireDelay)
            .to(this.fireFadeTime, { a: 0 }, {
                easing: 'sineIn',
                onUpdate: () => { fire.opacity = fade.a * 255; },
            })
            .call(() => {
                this.fire.active = false;
                EventBus.emit(GameEvent.FIRE_HIDE);
                this.fadeOut(view, onDone);
            })
            .start());
    }

    /** 灭火器收尾：淡掉再隐藏（`mistFadeTime` 填 0 就跳过淡出，直接硬隐藏） */
    private fadeOut(view: Node, onDone: () => void): void {
        const op = view.getComponent(UIOpacity);
        if (!this.mistFadeTime || !op) {
            view.active = false;
            onDone();
            return;
        }
        const fade = { a: op.opacity / 255 };
        this._live.push(tween(fade)
            .to(this.mistFadeTime, { a: 0 }, {
                easing: 'sineIn',
                onUpdate: () => { op.opacity = fade.a * 255; },
            })
            .call(() => {
                view.active = false;
                onDone();
            })
            .start());
    }

    private stop(): void {
        for (const tw of this._live) tw.stop();
        this._live.length = 0;
    }

    protected onDisable(): void {
        this.stop();
    }
}
