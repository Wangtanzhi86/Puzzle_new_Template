import { _decorator, Component, Node, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, Vec2, Vec3, tween } from 'cc';
import { RevealHost } from '../gameplay/RepairReveal';
import { RepairedSlot } from './RepairedSlot';

const { ccclass, property } = _decorator;

/**
 * 一格修好之后的收尾动作「喷瓶」：修复图先在原地左右摇几下（假装在摇晃），换成「喷雾」那张 ——
 * 它从上方缓缓落到位，落的过程中两团气体**从上到下**依次渐隐，落完连同修复图一起收掉，
 * 这一格才算露面。
 *
 * 两张贴图的画布不一样大（无喷雾 81×192、有喷雾 230×222），瓶子在画面里的位置和大小都不同，
 * 直接换贴图会跳一下。`mistScale` / `mistOffset` 就是对齐量：喷雾图缩放这个倍数、再按这个位移
 * 挪过去，瓶身就重合了（默认值是按当前这两张图量出来的，换美术要重新量）。
 * 位移写在**贴图像素**里，运行时按节点自己的旋转转过去 —— 场景里给节点摆的角度不影响对齐。
 *
 * 挂在槽位节点上，由 `PieceSlot.sprayAction` 指过来 —— 没配的槽位完全不碰。
 */
@ccclass('SprayAction')
export class SprayAction extends Component {
    @property({ type: SpriteFrame, displayName: '无喷雾贴图', tooltip: '摇晃用的那张。留空就一直用节点上原来那张' })
    noMistFrame: SpriteFrame = null;

    @property({ type: SpriteFrame, displayName: '喷雾贴图', tooltip: '落下 + 渐隐气体的就是它，没配这一格整套动作不生效' })
    mistFrame: SpriteFrame = null;

    @property({ type: [Node], displayName: '气体节点', tooltip: '喷雾那张开始下落的同时它们渐隐、淡完隐藏（要挂 UIOpacity）。按世界纵坐标从上到下依次淡，不是同时' })
    gases: Node[] = [];

    @property({ displayName: '摇晃次数', tooltip: '一个来回（往左摆再往右摆）算一次' })
    shakeCount = 3;

    @property({ displayName: '摇晃角度（度）', tooltip: '左右各摆这么多，按节点自己的 z 旋转算' })
    shakeAngle = 8;

    @property({ displayName: '摇晃单程时长（秒）' })
    shakeTime = 0.12;

    @property({ displayName: '起始高度（px）', tooltip: '换图后先抬到落点上方这么多，再往下落一次；填 0 就是原地不动' })
    mistRise = 60;

    @property({ displayName: '下落时长（秒）' })
    mistDropTime = 0.9;

    @property({ displayName: '气体渐隐时长（秒）', tooltip: '每一团自己淡完花的时间' })
    gasFadeTime = 0.45;

    @property({ displayName: '气体先后间隔（秒）', tooltip: '相邻两团起淡的时间差，排在上面的先淡。乘以团数 − 1 再加渐隐时长，最好别超过下落时长' })
    gasStagger = 0.35;

    @property({ displayName: '喷雾图缩放', tooltip: '对齐两个瓶子用：喷雾图相对它自己原始像素的倍数（这两张图量出来是 1.265）' })
    mistScale = 1.265;

    @property({ type: Vec2, displayName: '喷雾图偏移（px）', tooltip: '贴图像素、相对无喷雾那张的底边中点（量出来是 -99.03, 42.87）；会跟着节点自己的旋转走' })
    mistOffset = new Vec2(-99.03, 42.87);

    private _live: Tween<any>[] = [];

    /** 配了喷雾图、这一格又有修复图才接得住；否则调用方照旧直接抛 PIECE_SHOWN */
    handles(host: RevealHost): boolean {
        return !!this.mistFrame && !!host.showView;
    }

    play(host: RevealHost, onDone: () => void): void {
        this.stop();
        const slot = host.showView;
        const view = slot.node;
        const base = view.position.clone();
        const baseAngle = view.angle;
        // 摇晃：在编辑器里摆的角度上左右晃，晃完精确停回原角度（下面的对齐量读的就是它）
        const rock = { a: 0 };
        const put = (): void => { view.angle = baseAngle + rock.a; };
        let chain = tween(rock);
        for (let i = 0; i < this.shakeCount; i++) {
            chain = chain
                .to(this.shakeTime, { a: this.shakeAngle }, { easing: 'sineOut', onUpdate: put })
                .to(this.shakeTime, { a: -this.shakeAngle }, { easing: 'sineIn', onUpdate: put });
        }
        this._live.push(chain
            .to(this.shakeTime, { a: 0 }, { easing: 'sineOut', onUpdate: put })
            .call(() => this.spray(slot, base, onDone)).start());
    }

    /** 换图 + 下落：喷雾那张按量好的倍率 / 位移摆回瓶身原来的位置，抬到上方再落一次，落的过程中气体从上到下渐隐 */
    private spray(slot: RepairedSlot, base: Vec3, onDone: () => void): void {
        const view = slot.node;
        const baseScale = view.scale.clone();
        const sprite = view.getComponent(Sprite);
        const ut = view.getComponent(UITransform);
        if (this.noMistFrame) this.setFrame(sprite, ut, this.noMistFrame);
        this.setFrame(sprite, ut, this.mistFrame);

        // 位移写在贴图像素里（和节点旋转无关），换算到父节点空间要按节点自己的角度转一次
        const ang = view.eulerAngles.z * Math.PI / 180;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const dx = this.mistOffset.x * baseScale.x;
        const dy = this.mistOffset.y * baseScale.y;
        const at = new Vec3(base.x + dx * c - dy * s, base.y + dx * s + dy * c, base.z);
        view.setScale(baseScale.x * this.mistScale, baseScale.y * this.mistScale, baseScale.z);

        // 气体从上到下依次渐隐：按世界纵坐标排，越靠上的越早起
        const gases = this.gases.slice().sort((a, b) => b.worldPosition.y - a.worldPosition.y);
        let pending = gases.length + 1;
        const step = (): void => {
            if (--pending === 0) {
                slot.hide();
                onDone();
            }
        };

        const drop = { y: at.y + this.mistRise };
        const put = (): void => view.setPosition(at.x, drop.y, at.z);
        put();
        this._live.push(tween(drop)
            .to(this.mistDropTime, { y: at.y }, { easing: 'sineInOut', onUpdate: put })
            .call(step)
            .start());

        gases.forEach((g, i) => {
            const op = g.getComponent(UIOpacity);
            const fade = { a: op.opacity / 255 };
            this._live.push(tween(fade)
                .delay(i * this.gasStagger)
                .to(this.gasFadeTime, { a: 0 }, {
                    easing: 'sineIn',
                    onUpdate: () => { op.opacity = fade.a * 255; },
                })
                .call(() => {
                    g.active = false;
                    step();
                })
                .start());
        });
    }

    /** 换贴图时把节点框钉到那张图的原始画布尺寸 —— 两张的框不一样大，不钉就会跟着裁边跳 */
    private setFrame(sprite: Sprite, ut: UITransform, frame: SpriteFrame): void {
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        ut.setContentSize(frame.originalSize.width, frame.originalSize.height);
    }

    private stop(): void {
        for (const tw of this._live) tw.stop();
        this._live.length = 0;
    }

    protected onDisable(): void {
        this.stop();
    }
}
