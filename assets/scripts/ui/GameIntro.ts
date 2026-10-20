import { _decorator, Component, EffectAsset, Mask, Node, Sprite, Tween, tween, UITransform, v3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { EndVideo } from '../platform/EndVideo';
import { LevelSelect } from './LevelSelect';
import { IntroMotionBlur } from './IntroMotionBlur';
import { RoundedClip } from './RoundedClip';

const { ccclass, property } = _decorator;

/**
 * 进关开场：点完关卡，把那张集图从卡片里**连着放大到铺满整屏**，然后无缝换成开头视频。
 *
 * 无缝的前提只有一个：**视频首帧和这张图是同一张画**。所以放大终点的取景必须和 EndVideo.fit()
 * 一模一样（等比取大 = cover、居中），到位那一刻画面和视频第一帧像素级重合；这时候把静图收掉、
 * 把视频揭开，观众只看到「图继续动起来」。
 *
 * 放大走的是卡片的 Window/Fill 那个节点（720×1280 的原图，只是被圆角和 258×222 的框裁着）。
 * 它得先从 Window 底下**按世界变换**挪到全屏层，否则一出框就被圆角遮罩切没了。
 * 圆角在飞出去的头 cornerFade 秒里抹平成 0，避免角上一圈方角突然蹦出来。
 *
 * 视频用 playCovered 起播（画面藏着、照常解码），等它首帧解出来 **且** 放大到位，
 * 同一帧里「收静图 + 揭开视频」。播放器完全放不出来时就退回老路：图铺满就收场。
 */
@ccclass('GameIntro')
export class GameIntro extends Component {
    @property({ type: LevelSelect, displayName: '选关', tooltip: '从它的 items 里取点中的那张卡片' })
    select: LevelSelect = null;

    @property({ type: EndVideo, displayName: '开头视频', tooltip: '留空 = 只放大静图，铺满就算开场结束' })
    video: EndVideo = null;

    @property({ displayName: '跳过开场放大', tooltip: '勾上 = 选关后隔一帧直接进入游戏（照常发 GAME_START），不演从卡片放大铺满那一段' })
    skip = false;

    @property({ type: Node, displayName: '铺满区域', tooltip: '视频铺满这个世界框（取大 = 盖住）。留空 = 画布' })
    region: Node = null;

    @property({ displayName: '飞到中心的时长（秒）' })
    flyTime = 0.34;

    @property({ displayName: '放大铺满的时长（秒）' })
    zoomTime = 0.5;

    @property({ displayName: '飞出时的圆角（px）', tooltip: '和卡片的圆角一致；飞出去的头「圆角抹平时长」里减到 0' })
    cornerRadius = 26;

    @property({ displayName: '圆角抹平时长（秒）' })
    cornerFade = 0.22;

    @property({ displayName: '等视频首帧的上限（秒）', tooltip: '超时就直接揭开视频（黑一下总比压着画面强）' })
    readyTimeout = 1.2;

    @property({ type: EffectAsset, displayName: '缩放模糊材质', tooltip: 'assets/ReusableDragFx/zoom-blur.effect；留空 = 只留残影' })
    blurEffect: EffectAsset = null;

    @property({ displayName: '残影个数' })
    ghostCount = 4;

    @property({ displayName: '残影起始透明度' })
    ghostOpacity = 0.35;

    @property({ displayName: '残影跟随速度', tooltip: '越大尾巴越短；飞行段再改这个就能改「拖影长度」' })
    ghostLag = 16;

    @property({ displayName: '模糊最大强度', tooltip: '0.1 左右就有明显糊边了；收尾会自动归 0' })
    blurMax = 0.12;

    private _layer: Node = null;
    private _pick: Node = null;
    private _clip: RoundedClip = null;
    private _coverK = 1;
    private _cornerT = 0;
    private _zoomed = false;
    private _swapped = false;
    private _playing = false;
    private _ready = false;
    private _waiting = false;
    private _blur: IntroMotionBlur = null;
    private _mask: Mask = null;
    private _zooming = false;
    private _zoomT = 0;

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_SELECTED, this.onLevelSelected, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_SELECTED, this.onLevelSelected, this);
        this.unscheduleAllCallbacks();
        if (this._pick) Tween.stopAllByTarget(this._pick);
        this.clearBlur();
        this._pick = null;
        this._mask = null;
        this._zooming = false;
        this._zoomT = 0;
        this._clip = null;
        this._layer = null;
        this._zoomed = false;
        this._swapped = false;
        this._playing = false;
        this._ready = false;
        this._waiting = false;
    }

    protected update(dt: number): void {
        const clip = this._clip;
        if (clip && this.cornerRadius > 0 && this.cornerFade > 0 && this._cornerT < this.cornerFade) {
            this._cornerT = Math.min(this.cornerFade, this._cornerT + dt);
            clip.radius = this.cornerRadius * (1 - this._cornerT / this.cornerFade);
            clip.apply();
            // 圆角抹完就撤掉遮罩：全屏了看不到角，也免得自定义材质过模板测试
            if (this._cornerT >= this.cornerFade && this._mask) this._mask.enabled = false;
        }
        if (this._zooming) this._zoomT += dt;
        if (this._blur) {
            let k = 0.3;
            if (this._zooming) {
                const u = Math.min(1, this._zoomT / this.zoomTime);
                k = u < 0.6 ? 0.3 + 0.7 * (u / 0.6) : (1 - u) / 0.4;
            }
            this._blur.setStrength(this.blurMax * Math.max(0, k));
        }
    }

    private onLevelSelected = (index: number): void => {
        if (this.skip) {
            this.scheduleOnce(this.finish, 0);
            return;
        }
        const card = this.select && this.select.items[index];
        const fill = card ? this.findFill(card) : null;
        if (!fill) {
            if (!this.video || !this.video.play(this.finish)) this.finish();
            return;
        }
        const canvas = this.node.parent;
        const fu = fill.getComponent(UITransform);
        const s = fill.worldScale;
        const p = fill.worldPosition;
        const cx = p.x + (0.5 - fu.anchorX) * fu.width * s.x;
        const cy = p.y + (0.5 - fu.anchorY) * fu.height * s.y;

        const layer = this.buildLayer(canvas);
        const pick = new Node('Pick');
        layer.addChild(pick);
        const pu = pick.addComponent(UITransform);
        pu.setContentSize(fu.width, fu.height);
        pu.setAnchorPoint(0.5, 0.5);
        pick.setWorldPosition(cx, cy, 0);
        pick.setWorldScale(s.x, s.y, 1);
        const clip = pick.addComponent(RoundedClip);
        clip.radius = this.cornerRadius;
        clip.apply();

        // 原图按 0 偏移塞进裁剪框：框和它一样大，位置就是刚才那个世界中心
        fill.setParent(pick);
        fu.setAnchorPoint(0.5, 0.5);
        fill.setPosition(0, 0, 0);
        fill.setScale(1, 1, 1);

        const region = this.region || canvas;
        const ru = region.getComponent(UITransform);
        const rs = region.worldScale;
        const rp = region.worldPosition;
        const rw = ru.width * rs.x;
        const rh = ru.height * rs.y;
        const rcx = rp.x + (0.5 - ru.anchorX) * rw;
        const rcy = rp.y + (0.5 - ru.anchorY) * rh;
        const local = layer.getComponent(UITransform).convertToNodeSpaceAR(v3(rcx, rcy, 0));

        this._layer = layer;
        this._pick = pick;
        this._clip = clip;
        this._mask = pick.getComponent(Mask);
        const sp = fill.getComponent(Sprite);
        if (sp) {
            const blur = pick.addComponent(IntroMotionBlur);
            blur.setup(sp, this.blurEffect, this.ghostCount, this.ghostOpacity, this.ghostLag);
            this._blur = blur;
        }
        this._coverK = Math.max(rw / fu.width, rh / fu.height);
        const fitK = Math.min(rw / fu.width, rh / fu.height);

        tween(pick)
            .to(this.flyTime, { position: v3(local.x, local.y, 0), scale: v3(fitK, fitK, 1) }, { easing: 'quadOut' })
            .call(() => this.startZoom())
            .start();
    };

    private startZoom = (): void => {
        if (!this._pick) return;
        this._zooming = true;
        this._zoomT = 0;
        this._playing = true;
        if (!this.video || !this.video.playCovered(this.finish, this.onVideoReady)) this._playing = false;
        tween(this._pick)
            .to(this.zoomTime, { scale: v3(this._coverK, this._coverK, 1) }, { easing: 'quadIn' })
            .call(() => {
                this._zoomed = true;
                this.trySwap();
            })
            .start();
    };

    private onVideoReady = (): void => {
        this._ready = true;
        this.trySwap();
    };

    private trySwap(): void {
        if (this._swapped || !this._zoomed) return;
        if (this._ready) {
            this.swap();
            return;
        }
        if (!this._playing) {
            this.finish();
            return;
        }
        if (this._waiting) return;
        this._waiting = true;
        this.scheduleOnce(() => {
            if (!this._swapped) this.swap();
        }, this.readyTimeout);
    }

    private swap(): void {
        if (this._swapped) return;
        this._swapped = true;
        this.clearBlur();
        if (this._layer) this._layer.active = false;
        if (this.video) this.video.reveal();
    }

    private buildLayer(canvas: Node): Node {
        const old = canvas.getChildByName('IntroZoom');
        if (old) old.destroy();
        const layer = new Node('IntroZoom');
        const ui = layer.addComponent(UITransform);
        const cu = canvas.getComponent(UITransform);
        ui.setContentSize(cu.width, cu.height);
        ui.setAnchorPoint(0.5, 0.5);
        canvas.addChild(layer);
        layer.setPosition(0, 0, 0);
        layer.setSiblingIndex(canvas.children.length - 1);
        return layer;
    }

    private findFill(root: Node): Node {
        const stack: Node[] = [root];
        while (stack.length) {
            const n = stack.pop();
            if (n.name === 'Fill') return n;
            for (const c of n.children) stack.push(c);
        }
        return null;
    }

    private clearBlur(): void {
        if (!this._blur) return;
        this._blur.dispose();
        this._blur = null;
    }

    private finish = (): void => {
        this.clearBlur();
        if (this._layer) this._layer.active = false;
        this.node.active = false;
        EventBus.emit(GameEvent.GUIDE_RESUME);
        EventBus.emit(GameEvent.GAME_START);
    };
}
