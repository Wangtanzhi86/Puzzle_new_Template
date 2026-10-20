import { _decorator, Color, Component, game, Game, gfx, Material, ParticleSystem2D, screen, Sprite, SpriteFrame, Tween, tween, UIOpacity, UITransform, Vec3, Vec4, view } from 'cc';
import { DragVisualEvents } from './DragVisualEvents';
const { ccclass, property, disallowMultiple, executionOrder } = _decorator;

/** Reusable drag visuals. Match logic communicates only through the bound source node's events. */
@ccclass('DragGlowVisual')
@disallowMultiple
@executionOrder(-20)
export class DragGlowVisual extends Component {
    @property({ type: Sprite, displayName: '道具图片（必需）' }) public sourceSprite: Sprite | null = null;
    @property({ type: UITransform, displayName: '道具尺寸（必需）' }) public sourceTransform: UITransform | null = null;
    @property({ type: ParticleSystem2D, displayName: '柔光圆点粒子（必需）' }) public particles: ParticleSystem2D | null = null;
    @property({ type: UITransform, displayName: '粒子空间尺寸组件（必需）' }) public particleTransform: UITransform | null = null;
    @property({ type: Sprite, displayName: '轮廓光图片组件（必需）' }) public glowSprite: Sprite | null = null;
    @property({ type: UITransform, displayName: '轮廓光尺寸组件（必需）' }) public glowTransform: UITransform | null = null;
    @property({ type: UIOpacity, displayName: '轮廓光透明度组件（必需）' }) public glowOpacity: UIOpacity | null = null;
    @property({ min: 0.5, max: 5, displayName: '亮边宽度（屏幕像素）' }) public edgeWidth = 2;
    @property({ min: 4, max: 24, displayName: '柔光范围（屏幕像素）' }) public glowRadius = 12;
    @property({ min: 0.1, max: 3, displayName: '柔光强度' }) public glowStrength = 1.65;
    @property({ type: Color, displayName: '轮廓光颜色' }) public glowColor = new Color(255, 252, 247, 255);
    @property({ min: 4, max: 80, displayName: '圆光点每秒数量' }) public particleRate = 30;
    @property({ min: 4, max: 24, displayName: '圆光点贴图直径（屏幕像素）' }) public particleSize = 5.5;
    @property({ min: 0, max: 8, displayName: '圆光点大小变化（屏幕像素）' }) public particleSizeVariation = 4;
    @property({ min: 0.2, max: 1.2, displayName: '圆光点寿命（秒）' }) public particleLifetime = 0.75;
    @property({ min: 0, max: 24, displayName: '道具近旁发射扩展（屏幕像素）' }) public particlePadding = 3;
    @property({ min: 0, max: 30, displayName: '圆光点轻漂速度（屏幕像素每秒）' }) public particleSpeed = 2;
    @property({ min: 0.03, max: 0.3, displayName: '拿起显光时间' }) public pickupDuration = 0.08;
    @property({ min: 0.03, max: 0.3, displayName: '松手收尾时间' }) public releaseDuration = 0.12;

    private material: Material | null = null;
    private particleMaterial: Material | null = null;
    private particlesRunning = false;
    private prepared = false;
    private dragging = false;
    private background = false;
    private readonly visibility = { glow: 0, dots: 0 };
    private readonly local = new Vec3();
    private readonly unitScale = new Vec3(1, 1, 1);

    /** 参考物可以是运行时才有的（池化碎片）—— 那时由 `bind()` 再 prepare，先别报错 */
    protected onLoad(): void { if (this.sourceSprite) this.prepare(); }

    /**
     * 运行时晚绑定：把这一套光效临时指到一件「拿起来那一刻才存在」的道具上。
     * 图形要与道具同图（`validImage` 的硬约束），所以图片也一起传进来。
     * 返回 false 表示这套光效配不上这件道具（内部已 console.error）。
     */
    public bind(sourceSprite: Sprite, sourceTransform: UITransform, glowFrame: SpriteFrame): boolean {
        this.dragging = false;
        this.prepared = false;
        this.sourceSprite = sourceSprite;
        this.sourceTransform = sourceTransform;
        this.glowSprite!.spriteFrame = glowFrame;
        // 之前因为绑定失效被自禁用过：重新启用会走 onEnable，那里就会 prepare
        if (!this.enabled) { this.enabled = true; return this.prepared; }
        return this.prepare();
    }
    private fail(field: string): false {
        console.error('[DragGlowVisual] 节点「' + this.node.name + '」' + field + '，停止本拖动视觉效果。');
        return false;
    }
    private validBindings(): boolean {
        if (!(this.sourceSprite instanceof Sprite) || !this.sourceSprite.isValid) return this.fail('sourceSprite 缺失或类型错误');
        if (!(this.sourceTransform instanceof UITransform) || !this.sourceTransform.isValid
            || this.sourceTransform.node !== this.sourceSprite.node) return this.fail('sourceTransform 缺失或与 sourceSprite 不属于同一道具');
        if (!(this.glowSprite instanceof Sprite) || !this.glowSprite.isValid) return this.fail('glowSprite 缺失或类型错误');
        if (!(this.glowTransform instanceof UITransform) || !this.glowTransform.isValid
            || this.glowTransform.node !== this.glowSprite.node) return this.fail('glowTransform 缺失或绑定错误');
        if (!(this.glowOpacity instanceof UIOpacity) || !this.glowOpacity.isValid
            || this.glowOpacity.node !== this.glowSprite.node) return this.fail('glowOpacity 缺失或绑定错误');
        if (!(this.particles instanceof ParticleSystem2D) || !this.particles.isValid) return this.fail('particles 缺失或类型错误');
        if (!(this.particleTransform instanceof UITransform) || !this.particleTransform.isValid
            || this.particleTransform.node !== this.particles.node) return this.fail('particleTransform 缺失或绑定错误');
        if (this.glowSprite.node.parent !== this.node || this.particles.node.parent !== this.node || !this.node.parent)
            return this.fail('轮廓光与圆点粒子必须预建在本特效容器内，容器须位于拖动显示层');
        return true;
    }
    private prepare(): boolean {
        if (!this.validBindings() || !this.validImage() || !this.validParameters() || !this.validParticleSetup()) return false;
        if (!this.glowSprite!.customMaterial?.isValid) return this.fail('glowSprite.customMaterial 未绑定有效的轮廓光材质');
        this.material = this.glowSprite!.getMaterialInstance(0);
        if (!this.material?.isValid || this.material.passes.length !== 1) return this.fail('轮廓光材质必须具有一个有效渲染 Pass');
        const pass = this.material.passes[0];
        const missing = ['uvRect', 'uvParams', 'appearance', 'glowColor'].filter(name => !pass.getHandle(name));
        if (missing.length) return this.fail('轮廓光材质缺少 Shader 参数：' + missing.join('、'));
        this.particleMaterial = this.particles!.getMaterialInstance(0);
        if (!this.particleMaterial?.isValid || !this.particleMaterial.passes[0]?.getHandle('dotTint'))
            return this.fail('particles.customMaterial 缺少 dotTint Shader 参数');
        this.prepared = true;
        this.clear();
        return true;
    }
    private validImage(): boolean {
        const source = this.sourceSprite!, frame = source.spriteFrame;
        if (!frame?.isValid || !frame.texture?.isValid) return this.fail('sourceSprite.spriteFrame 或贴图缺失');
        if (this.glowSprite!.spriteFrame !== frame) return this.fail('光效 Sprite.spriteFrame 必须显式绑定与道具相同的图片');
        if (source.type !== Sprite.Type.SIMPLE || !source.trim || this.glowSprite!.type !== Sprite.Type.SIMPLE || !this.glowSprite!.trim)
            return this.fail('道具与光效 Sprite 必须使用 Simple 类型并启用 Trim');
        if (frame.rotated || frame.packable) return this.fail('道具图片必须关闭 Packable 且不可旋转打包');
        return true;
    }
    private validParticleSetup(): boolean {
        const particles = this.particles!;
        if (!particles.spriteFrame?.isValid || !particles.spriteFrame.texture?.isValid)
            return this.fail('particles.spriteFrame 未绑定有效的柔光圆点贴图');
        const pass = particles.customMaterial?.passes[0];
        const blend = pass?.blendState.targets[0];
        if (!particles.custom || particles.playOnLoad || particles.autoRemoveOnFinish
            || particles.positionType !== ParticleSystem2D.PositionType.FREE
            || !particles.customMaterial?.isValid || !blend
            || blend.blendSrc !== gfx.BlendFactor.SRC_ALPHA || blend.blendDst !== gfx.BlendFactor.ONE)
            return this.fail('particles 必须绑定圆点加法材质，使用 Custom／Free，关闭自动播放和自动销毁');
        return true;
    }
    private validParameters(): boolean {
        const checks = [
            [this.edgeWidth, 0.5, 5], [this.glowRadius, 4, 24], [this.glowStrength, 0.1, 3],
            [this.particleRate, 4, 80], [this.particleSize, 4, 24], [this.particleSizeVariation, 0, 8],
            [this.particleLifetime, 0.2, 1.2], [this.particlePadding, 0, 24], [this.particleSpeed, 0, 30],
            [this.pickupDuration, 0.03, 0.3], [this.releaseDuration, 0.03, 0.3],
        ];
        if (checks.some(([value, min, max]) => !Number.isFinite(value) || value < min || value > max)
            || this.particleSizeVariation >= this.particleSize || !(this.glowColor instanceof Color))
            return this.fail('光效颜色或数值配置无效');
        return true;
    }
    protected onEnable(): void {
        if (!this.prepared && this.sourceSprite && !this.prepare()) { this.enabled = false; return; }
        this.background = false;
        if (this.sourceTransform) {
            this.sourceTransform.node.on(DragVisualEvents.BEGIN, this.beginDrag, this);
            this.sourceTransform.node.on(DragVisualEvents.END, this.endDrag, this);
            this.sourceTransform.node.on(DragVisualEvents.CLEAR, this.clear, this);
        }
        game.on(Game.EVENT_HIDE, this.onBackground, this);
        game.on(Game.EVENT_SHOW, this.onForeground, this);
    }
    public beginDrag(): void {
        if (!this.enabledInHierarchy || this.background) return;
        this.clear();
        if (!this.validBindings() || !this.validImage() || !this.validParameters()
            || !this.validParticleSetup() || !this.syncGlow() || !this.syncEmitter()) { this.enabled = false; return; }
        this.dragging = true;
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
        this.particles!.node.setSiblingIndex(this.node.children.length - 1);
        this.visibility.dots = 1;
        this.particleMaterial!.setProperty('dotTint', new Vec4(1, 1, 1, 1));
        if (this.particles!.enabledInHierarchy) this.startParticles();
        tween(this.visibility).to(this.pickupDuration, { glow: 1 }, { easing: 'quadOut' }).start();
    }
    public endDrag(): void {
        if (!this.prepared) return;
        this.dragging = false;
        // Keep already born particles in world space during the brief release fade.
        this.particles!.emissionRate = 0;
        Tween.stopAllByTarget(this.visibility);
        tween(this.visibility).to(this.releaseDuration, { glow: 0, dots: 0 }, { easing: 'quadOut' })
            .call(() => this.clearParticles()).start();
    }
    private startParticles(): void {
        this.particles!.emissionRate = this.particleRate;
        this.particles!.resetSystem();
        this.particlesRunning = true;
    }
    private clearParticles(): void {
        this.particlesRunning = false;
        if (!this.particles?.isValid) return;
        this.particles.emissionRate = 0;
        this.particles.resetSystem();
        this.particles.stopSystem();
    }
    public clear(): void {
        Tween.stopAllByTarget(this.visibility);
        this.visibility.glow = 0; this.visibility.dots = 0; this.dragging = false;
        if (this.glowOpacity?.isValid) this.glowOpacity.opacity = 0;
        if (this.particleMaterial?.isValid) this.particleMaterial.setProperty('dotTint', new Vec4(1, 1, 1, 0));
        this.clearParticles();
    }
    private pixelsPerWorldUnit(): number {
        return Math.max(0.0001, Math.min(view.getScaleX(), view.getScaleY()) / screen.devicePixelRatio);
    }
    private readCenter(out: Vec3): void {
        const source = this.sourceTransform!;
        out.set((0.5 - source.anchorX) * source.width, (0.5 - source.anchorY) * source.height, 0);
        Vec3.transformMat4(out, out, source.node.worldMatrix);
    }
    private syncGlow(): boolean {
        if (!this.material?.isValid) return this.fail('轮廓光材质已失效');
        const source = this.sourceTransform!, frame = this.sourceSprite!.spriteFrame!;
        const scale = source.node.worldScale, pixels = this.pixelsPerWorldUnit();
        const width = source.width, height = source.height;
        if (![width, height, scale.x, scale.y].every(Number.isFinite) || width <= 0 || height <= 0
            || Math.abs(scale.x) < 0.0001 || Math.abs(scale.y) < 0.0001)
            return this.fail('sourceTransform 宽高或世界缩放无效');
        const px = Math.abs(scale.x) * pixels, py = Math.abs(scale.y) * pixels;
        const marginX = (this.glowRadius + this.edgeWidth + 2) / px;
        const marginY = (this.glowRadius + this.edgeWidth + 2) / py;
        this.readCenter(this.local);
        this.glowSprite!.node.setWorldPosition(this.local);
        this.glowSprite!.node.setWorldRotation(source.node.worldRotation);
        this.glowSprite!.node.setWorldScale(scale);
        this.glowTransform!.setAnchorPoint(0.5, 0.5);
        this.glowTransform!.setContentSize(width + marginX * 2, height + marginY * 2);
        const rect = frame.rect, texture = frame.texture!;
        this.material!.setProperty('uvRect', new Vec4(rect.x / texture.width, rect.y / texture.height,
            rect.width / texture.width, rect.height / texture.height));
        this.material!.setProperty('uvParams', new Vec4(1 + marginX * 2 / width, 1 + marginY * 2 / height,
            1 / (width * px), 1 / (height * py)));
        this.material!.setProperty('appearance', new Vec4(this.edgeWidth, this.glowRadius, 0.97, this.glowStrength));
        this.material!.setProperty('glowColor', this.glowColor);
        return true;
    }
    private syncEmitter(): boolean {
        const source = this.sourceTransform!, particles = this.particles!, pixels = this.pixelsPerWorldUnit();
        const m = source.node.worldMatrix;
        const width = Math.abs(m.m00) * source.width + Math.abs(m.m04) * source.height;
        const height = Math.abs(m.m01) * source.width + Math.abs(m.m05) * source.height;
        if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0)
            return this.fail('道具世界尺寸无效，无法配置粒子范围');
        this.readCenter(this.local);
        particles.node.setWorldPosition(this.local);
        particles.node.setWorldRotation(0, 0, 0, 1);
        particles.node.setWorldScale(this.unitScale);
        const halfWidth = width * 0.5 + this.particlePadding / pixels;
        const halfHeight = height * 0.5 + this.particlePadding / pixels;
        this.particleTransform!.setContentSize(halfWidth * 2, halfHeight * 2);
        particles.sourcePos.set(0, 0);
        particles.posVar.set(halfWidth, halfHeight);
        particles.life = this.particleLifetime;
        particles.lifeVar = this.particleLifetime * 0.3;
        particles.startSize = this.particleSize / pixels;
        particles.startSizeVar = this.particleSizeVariation / pixels;
        particles.endSize = this.particleSize * 0.55 / pixels;
        particles.endSizeVar = this.particleSizeVariation * 0.45 / pixels;
        particles.speed = this.particleSpeed / pixels;
        particles.speedVar = this.particleSpeed * 0.6 / pixels;
        return true;
    }
    protected lateUpdate(): void {
        if (!this.prepared || this.background) return;
        if (!this.validBindings()) { this.clear(); this.enabled = false; return; }
        if (this.dragging && !this.sourceTransform!.node.activeInHierarchy) { this.clear(); return; }
        if (this.dragging || this.visibility.glow > 0) {
            if (!this.validImage() || !this.validParticleSetup()
                || (this.sourceTransform!.node.activeInHierarchy && !this.syncGlow())) {
                this.clear(); this.enabled = false; return;
            }
        }
        if (this.dragging) {
            if (!this.syncEmitter()) { this.clear(); this.enabled = false; return; }
            // Explicitly disabled particle components suppress only this effect.
            if (!this.particles!.enabledInHierarchy) {
                if (this.particlesRunning) this.clearParticles();
            } else if (!this.particlesRunning) this.startParticles();
        }
        if (!this.particleMaterial?.isValid) { this.fail('圆点粒子材质已失效'); this.clear(); this.enabled = false; return; }
        this.particleMaterial.setProperty('dotTint', new Vec4(1, 1, 1, this.visibility.dots));
        this.glowOpacity!.opacity = Math.round(this.visibility.glow * 255);
    }
    private onBackground(): void { this.background = true; this.clear(); }
    private onForeground(): void { this.background = false; }
    protected onDisable(): void {
        if (this.sourceTransform?.isValid) {
            this.sourceTransform.node.off(DragVisualEvents.BEGIN, this.beginDrag, this);
            this.sourceTransform.node.off(DragVisualEvents.END, this.endDrag, this);
            this.sourceTransform.node.off(DragVisualEvents.CLEAR, this.clear, this);
        }
        game.off(Game.EVENT_HIDE, this.onBackground, this);
        game.off(Game.EVENT_SHOW, this.onForeground, this);
        this.clear();
    }
    protected onDestroy(): void {
        this.clear();
        // The bound Sprite owns the material instance; ParticleSystem2D owns its transient particles.
        this.material = null; this.particleMaterial = null; this.prepared = false;
    }
}
