import { _decorator, Component, EffectAsset, Material, Sprite, Tween, UITransform, Vec4, tween } from 'cc';
import { FeatureFlags } from '../config/FeatureFlags';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';

const { ccclass, property } = _decorator;

interface SweepHandle {
    sprite: Sprite;
    mat: Material;
    /** xy 圆心（世界坐标）/ z 已扫圈数 / w 羽化 —— 每格一份，互不踩 */
    params: Vec4;
    state: { p: number };
}

/**
 * 开局把每个槽位的白色描边「从中心转出来」：以 Broken 自己的中心为原点，顺时针扫过 360°，
 * 扫到哪儿才显示哪儿。走的是 `effects/radial-sweep.effect`，材质挂在破损图自己的 Sprite 上，
 * 扫完摘掉材质，最终就是一张普通图。
 *
 * 挂在 EffectLayer 上（全局一个实例），不用往槽位填引用 —— 它自己听 LEVEL_BUILT 拿槽位表。
 * 建关时就先把材质挂上、进度按 0 封住（这时开场层还盖着屏幕），GAME_START 之后才逐格转出来；
 * 预填槽位跳过（那一格由 PrefillFlight 的飞入 + 金色烟花接管）。
 *
 * 开关是 `FeatureFlags.radialSweep` —— 关掉就完全不挂材质，开场照旧直接显示描边。
 */
@ccclass('RadialSweep')
export class RadialSweep extends Component {
    @property({ type: EffectAsset, displayName: '扫入材质', tooltip: 'effects/radial-sweep.effect' })
    sweepEffect: EffectAsset = null;

    @property({ displayName: '整圈时长（秒）', tooltip: '单格从正上方转满 360° 用多久' })
    sweepTime = 1.2;

    @property({ displayName: '每格错开（秒）', tooltip: '一格开始后隔这么久，下一格再开始' })
    stagger = 0.15;

    @property({ displayName: '起点延迟（秒）', tooltip: 'GAME_START 之后等多久才开始第一格' })
    delay = 0;

    @property({ displayName: '边缘羽化（占一圈）', tooltip: '扫过的那条边有多虚；0.06 大约是一圈的 6%' })
    feather = 0.06;

    private _live = new Map<Sprite, SweepHandle>();
    private _data: SlotData[] = [];
    private _started = false;

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.GAME_START, this.onGameStart, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.GAME_START, this.onGameStart, this);
        this.unscheduleAllCallbacks();
        this.releaseAll();
        this._started = false;
    }

    private onLevelBuilt(data: SlotData[]): void {
        this._data = data;
        this._started = false;
        this.releaseAll();
        if (!FeatureFlags.radialSweep || !this.sweepEffect) return;
        for (const d of this._data) {
            if (d.slot.prefilled) continue;
            this.attach(d.slot.brokenView);
        }
    }

    private onGameStart(): void {
        if (this._started) return;
        this._started = true;
        let at = this.delay;
        for (const d of this._data) {
            if (d.slot.prefilled) continue;
            const handle = d.slot.brokenView ? this._live.get(d.slot.brokenView) : null;
            if (!handle) continue;
            this.scheduleOnce(() => this.play(handle), at);
            at += this.stagger;
        }
    }

    /** 建关就挂材质、进度 0：开场层还盖着屏幕，先把描边封住，GAME_START 之后才转 */
    private attach(sprite: Sprite): void {
        if (!sprite || this._live.has(sprite)) return;
        const node = sprite.node;
        const ut = node.getComponent(UITransform);
        if (!ut) return;

        const scale = node.worldScale;
        const at = node.worldPosition;
        const w = ut.width * scale.x;
        const h = ut.height * scale.y;
        const params = new Vec4(
            at.x + (0.5 - ut.anchorX) * w,
            at.y + (0.5 - ut.anchorY) * h,
            0,
            this.feather,
        );

        const mat = new Material();
        mat.initialize({ effectAsset: this.sweepEffect, defines: { USE_TEXTURE: true } });
        mat.setProperty('sweepParams', params);
        sprite.customMaterial = mat;

        this._live.set(sprite, { sprite, mat, params, state: { p: 0 } });
    }

    private play(handle: SweepHandle): void {
        if (!this._live.has(handle.sprite)) return;
        // 走到 1 只够实心那一段扫满，最后那一条羽化边还得再走一个 feather
        tween(handle.state)
            .to(this.sweepTime, { p: 1 + this.feather }, { onUpdate: () => this.paint(handle) })
            .call(() => this.finish(handle.sprite))
            .start();
    }

    private paint(handle: SweepHandle): void {
        handle.params.z = handle.state.p;
        handle.mat.setProperty('sweepParams', handle.params);
    }

    private releaseAll(): void {
        for (const sprite of Array.from(this._live.keys())) this.finish(sprite);
    }

    /** 扫完（或中途收摊）摘掉材质。和 CircleReveal 一样必须显式销毁 —— 引擎只销毁 MaterialInstance */
    private finish(sprite: Sprite): void {
        const handle = this._live.get(sprite);
        if (!handle) return;
        this._live.delete(sprite);
        Tween.stopAllByTarget(handle.state);
        if (handle.sprite.isValid) handle.sprite.customMaterial = null;
        handle.mat.destroy();
    }
}
