import { _decorator, Component, Node, Tween, UIOpacity, UITransform, Vec2, Vec3, tween } from 'cc';
import { RevealHost } from '../gameplay/RepairReveal';

const { ccclass, property } = _decorator;

/**
 * 一格修好之后的收尾动作「通马桶」：修复图先平滑挪到指定位置并转个角度，再上下抽动几下；
 * 与此同时「脏水」每抽一下朝自己的底边缩一截（一次抽动排掉一档，不是一口气缩完）——
 * 抽完两者一起淡出，这一格才算露面。
 *
 * 挂在槽位节点上，由 `PieceSlot.flushAction` 指过来 —— 没配的槽位完全不碰。
 * 挪的是 `host.showView.node`（这一格自己那张修复图），所以不用另配「搋子」口。
 */
@ccclass('FlushAction')
export class FlushAction extends Component {
    @property({ type: Node, displayName: '脏水节点', tooltip: '抽动的同时它等比缩小、水面往下落，最后和修复图一起淡出' })
    water: Node = null;

    @property({ type: Vec2, displayName: '挪到位位置', tooltip: '相对槽位节点' })
    moveTo = new Vec2(-25.28, 2.107);

    @property({ displayName: '挪到位旋转（度）' })
    rotateTo = 24;

    @property({ displayName: '挪到位时长（秒）', tooltip: '缓动是 quadInOut —— 就是「这个过程平滑一点」那句' })
    moveTime = 0.35;

    @property({ displayName: '抽动次数' })
    bobCount = 3;

    @property({ displayName: '抽动幅度（px）', tooltip: '先往下压这么多再回原位，算一次' })
    bobDepth = 14;

    @property({ displayName: '抽动单程时长（秒）' })
    bobTime = 0.18;

    @property({ displayName: '脏水最终缩放', tooltip: '等比缩到原来的多少 —— x / y 一起缩、分「抽动次数」档走完。只缩 y 会把水压扁、宽的那截伸出马桶' })
    waterShrink = 0.2;

    @property({ displayName: '脏水额外下沉（px）', tooltip: '正数往下。底边本来就固定不动、上面往下落，这里再额外压这么多；填 0 就是只缩不下沉' })
    waterDrop = 0;

    @property({ displayName: '消失时长（秒）', tooltip: '0 = 大约一帧内直接隐藏' })
    fadeTime = 0.25;

    private _live: Tween<any>[] = [];

    /** 配了脏水、这一格又有修复图才接得住；否则调用方照旧直接抛 PIECE_SHOWN */
    handles(host: RevealHost): boolean {
        return !!this.water && !!host.showView;
    }

    play(host: RevealHost, onDone: () => void): void {
        this.stop();
        const view = host.showView.node;
        // 起点就是编辑器里摆的位置 / 角度 —— 前面那步（圆形扩散揭晓）只动材质，没碰过变换
        const target = new Vec3(this.moveTo.x, this.moveTo.y, view.position.z);
        this._live.push(tween(view)
            .to(this.moveTime, { position: target, angle: this.rotateTo }, { easing: 'quadInOut' })
            .call(() => this.drain(view, target, onDone))
            .start());
    }

    /** 抽动与排水分头跑，两条都完了才淡出 */
    private drain(view: Node, target: Vec3, onDone: () => void): void {
        let pending = 2;
        const step = (): void => {
            if (--pending === 0) this.fade(view, onDone);
        };

        const bob = { y: 0 };
        const put = (): void => view.setPosition(target.x, target.y + bob.y, target.z);
        const strokes = Math.max(1, this.bobCount);
        let chain = tween(bob);
        for (let i = 0; i < strokes; i++) {
            chain = chain
                .to(this.bobTime, { y: -this.bobDepth }, { easing: 'quadOut', onUpdate: put })
                .to(this.bobTime, { y: 0 }, { easing: 'quadIn', onUpdate: put });
        }
        this._live.push(chain.call(step).start());

        const water = this.water;
        const ut = water.getComponent(UITransform);
        const baseScale = water.scale.x;
        const baseX = water.position.x;
        // 底边固定不动：等比缩的同时水面往下落 —— 水缩成一小团，不会横向伸出马桶也没往底外穿
        const bottom = water.position.y - ut.height * water.scale.y * ut.anchorY;
        const drain = { s: 1, d: 0 };
        const paint = (): void => {
            const s = baseScale * drain.s;
            water.setScale(s, s, water.scale.z);
            water.setPosition(baseX, bottom + ut.height * s * ut.anchorY - this.waterDrop * drain.d, water.position.z);
        };
        // 一次抽动排掉一档：第 i 次压下去那半程把水缩到 i/strokes，抬起来那半程水位不动 —— 和时间轴上的抽动逐拍对齐
        let pour = tween(drain);
        for (let i = 1; i <= strokes; i++) {
            const t = i / strokes;
            pour = pour
                .to(this.bobTime, { s: 1 + (this.waterShrink - 1) * t, d: t }, { easing: 'sineOut', onUpdate: paint })
                .delay(this.bobTime);
        }
        this._live.push(pour.call(step).start());
    }

    private fade(view: Node, onDone: () => void): void {
        const water = this.water;
        const pot = view.getComponent(UIOpacity);
        const wot = water.getComponent(UIOpacity);
        const s = { a: 1 };
        this._live.push(tween(s)
            .to(this.fadeTime, { a: 0 }, {
                easing: 'sineIn',
                onUpdate: () => {
                    pot.opacity = s.a * 255;
                    wot.opacity = s.a * 255;
                },
            })
            .call(() => {
                view.active = false;
                water.active = false;
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
