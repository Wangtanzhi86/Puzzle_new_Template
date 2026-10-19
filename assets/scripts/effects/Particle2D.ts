import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Color, Vec2, Material, EffectAsset } from 'cc';
import { EventTrigger } from './EventTrigger';

const { ccclass, property } = _decorator;

const DEG2RAD = Math.PI / 180;
/** 原版 RANDOM_MINUS1_1：返回 [-1,1] */
function rand11() { return Math.random() * 2 - 1; }
function clamp255(v: number) { return v < 0 ? 0 : (v > 255 ? 255 : v); }

class P2DParticle {
    node: Node = null!;
    sprite: Sprite = null!;
    ui: UITransform = null!;
    alive = false;
    life = 0;
    totalLife = 1;
    pos = new Vec2();
    vel = new Vec2();
    radAcc = 0;
    tanAcc = 0;
    s0 = 0;
    s1 = 0;
    spin0 = 0;
    spin1 = 0;
    c0 = new Color();
    c1 = new Color();
    lastSize = -1;
    lastAngle = 1e9;
    lastColor = -1;
}

/**
 * 2.x `cc.ParticleSystem`（重力模式）的 1:1 复刻，从 CopyPuzzle 的 `effects/Particle2D.ts` 移植。
 *
 * 为什么不用 3.8 内置 `cc.ParticleSystem2D`：
 *   1) 内置的模块对象在编辑器预览里取不到，`angle / angleVar / speed` 这套 2.x 的发射角表达不了；
 *   2) 内置重力是 `gravityModifier * -9.8`，2.x 是直接加速度；
 *   3) 2.x 的 `resetSystem / stopSystem` 在内置组件里没有对应语义。
 * 所以是 Sprite 池 + cocos2d-x 原始积分公式，**所有数值都在属性检查器里调**。
 *
 * 与 CopyPuzzle 那版的差别（只有这两处）：
 *   - 所有字段加了 @property（原版是代码里赋值，编辑期改不了）；
 *   - 加色材质改成在面板上选 Effect + 打勾（原版由外部代码 new Material 传进来）。
 *
 * 起停：`playOnLoad` 打勾就进场播；否则等 `startEvents` 全部到齐；`stopEvents` 任一到达就停。
 * 事件名直接填 `GameEvent` 里的字符串（如 `PIECE_REPAIRED`、`LEVEL_COMPLETE`）。
 */
@ccclass('Particle2D')
export class Particle2D extends Component {
    @property({ type: SpriteFrame, displayName: '粒子贴图', tooltip: '留空 = 白方块' })
    spriteFrame: SpriteFrame | null = null;

    @property({ displayName: '加色混合', tooltip: '雪 / 光晕 / 火星这类发光效果勾上；烟不要勾（普通 alpha）' })
    additive = false;

    @property({ type: EffectAsset, displayName: '加色材质 Effect', tooltip: '勾了「加色混合」才用：选 SpriteAdd.effect' })
    additiveEffect: EffectAsset | null = null;

    // ---- 起停条件（全在属性检查器里配） ----

    @property({ displayName: '进场就播', tooltip: '打勾 = onEnable 立刻开始发射（飘雪就勾这个）' })
    playOnLoad = true;

    @property({ type: [String], displayName: '启动事件（全部到齐）', tooltip: '填 EventBus 事件名，如 PIECE_REPAIRED。留空 = 不靠事件启动' })
    startEvents: string[] = [];

    @property({ displayName: '启动延迟（秒）' })
    startDelay = 0;

    @property({ type: [String], displayName: '停止事件（任一到达）', tooltip: '填事件名，如 LEVEL_COMPLETE。留空 = 永不自动停' })
    stopEvents: string[] = [];

    @property({ displayName: '停止延迟（秒）' })
    stopDelay = 0;

    @property({ displayName: '只认槽位（-1 = 任意）', tooltip: '事件第一个参数是槽位序号时（PIECE_REPAIRED）可以只让某一块触发' })
    slotIndex = -1;

    // ---- 粒子参数（同名同义 2.x） ----

    @property({ displayName: '最大粒子数 / 每秒发射' }) totalParticles = 250;
    @property({ displayName: '每秒发射数' }) emissionRate = 350;
    @property({ displayName: '寿命（秒） / 寿命浮动' }) life = 1;
    @property({ displayName: '寿命浮动' }) lifeVar = 0;
    @property({ displayName: '发射角（度）' }) angle = 90;
    @property({ displayName: '发射角浮动' }) angleVar = 20;
    @property({ displayName: '初始大小 / 浮动' }) startSize = 50;
    @property({ displayName: '初始大小浮动' }) startSizeVar = 0;
    @property({ displayName: '结束大小 / 浮动' }) endSize = 0;
    @property({ displayName: '结束大小浮动' }) endSizeVar = 0;
    @property({ displayName: '初始自转 / 浮动' }) startSpin = 0;
    @property({ displayName: '初始自转浮动' }) startSpinVar = 0;
    @property({ displayName: '结束自转 / 浮动' }) endSpin = 0;
    @property({ displayName: '结束自转浮动' }) endSpinVar = 0;
    @property({ displayName: '起始颜色' }) startColor = new Color(255, 255, 255, 255);
    @property({ displayName: '起始颜色浮动' }) startColorVar = new Color(0, 0, 0, 0);
    @property({ displayName: '结束颜色' }) endColor = new Color(255, 255, 255, 0);
    @property({ displayName: '结束颜色浮动' }) endColorVar = new Color(0, 0, 0, 0);
    @property({ displayName: '发射点抖动范围' }) posVar = new Vec2(0, 0);
    @property({ displayName: '重力（px/s²）' }) gravity = new Vec2(0, 0);
    @property({ displayName: '速度 / 浮动' }) speed = 0;
    @property({ displayName: '速度浮动' }) speedVar = 0;
    @property({ displayName: '切向加速度 / 浮动' }) tangentialAccel = 0;
    @property({ displayName: '切向加速度浮动' }) tangentialAccelVar = 0;
    @property({ displayName: '径向加速度 / 浮动' }) radialAccel = 0;
    @property({ displayName: '径向加速度浮动' }) radialAccelVar = 0;
    @property({ displayName: '位置模式', tooltip: '1 = 相对发射器（2.x RELATIVE），0 = 世界坐标' }) positionType = 1;

    private _pool: P2DParticle[] = [];
    private _alive = 0;
    private _acc = 0;
    private _next = 0;
    private _stopped = true;
    private _built = false;
    private _c = new Color();
    private _mat: Material | null = null;
    private _trigger: EventTrigger | null = null;

    onLoad() {
        this._build();
        if (this.playOnLoad) this.resetSystem(); else this.stopSystem();
    }

    onEnable() {
        if (!this._trigger) {
            this._trigger = new EventTrigger(this, {
                playOnLoad: this.playOnLoad,
                startEvents: this.startEvents,
                startDelay: this.startDelay,
                stopEvents: this.stopEvents,
                stopDelay: this.stopDelay,
                slotIndex: this.slotIndex,
            }, () => this.resetSystem(), () => this.stopSystem());
        }
        this._trigger.start();
    }

    onDisable() {
        if (this._trigger) this._trigger.dispose();
        this._trigger = null;
    }

    onDestroy() {
        if (this._mat) { this._mat.destroy(); this._mat = null; }
    }

    private _build() {
        if (this._built) return;
        this._built = true;
        if (this.additive && this.additiveEffect && !this._mat) {
            this._mat = new Material();
            this._mat.initialize({ effectAsset: this.additiveEffect });
        }
        for (let i = 0; i < this.totalParticles; i++) {
            const n = new Node('p' + i);
            n.parent = this.node;
            n.layer = this.node.layer;
            const ui = n.addComponent(UITransform);
            ui.setContentSize(this.startSize, this.startSize);
            const sp = n.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = this.spriteFrame;
            if (this._mat) sp.customMaterial = this._mat;
            n.active = false;
            const p = new P2DParticle();
            p.node = n; p.sprite = sp; p.ui = ui;
            this._pool.push(p);
        }
    }

    /** 原版 resetSystem：清空粒子并重新开始发射 */
    resetSystem() {
        this._build();
        this._killAll();
        this._acc = 0;
        this._stopped = false;
        this.enabled = true;
    }

    /** 原版 stopSystem：停止发射，已发射的粒子自然消亡 */
    stopSystem() {
        this._stopped = true;
    }

    isFull() { return this._alive >= this.totalParticles; }

    private _killAll() {
        for (const p of this._pool) { p.alive = false; p.node.active = false; }
        this._alive = 0;
    }

    private _kill(p: P2DParticle) {
        p.alive = false;
        p.node.active = false;
        this._alive--;
    }

    private _spawn(): boolean {
        if (this._alive >= this.totalParticles) return false;
        let idx = -1;
        for (let i = 0; i < this.totalParticles; i++) {
            const j = (this._next + i) % this.totalParticles;
            if (!this._pool[j].alive) { idx = j; break; }
        }
        if (idx < 0) return false;
        this._next = (idx + 1) % this.totalParticles;
        const p = this._pool[idx];
        const a = (this.angle + this.angleVar * 0.5 * rand11()) * DEG2RAD;
        const sp = this.speed + this.speedVar * rand11();
        p.vel.set(Math.cos(a) * sp, Math.sin(a) * sp);
        p.pos.set(this.posVar.x * rand11(), this.posVar.y * rand11());
        p.totalLife = p.life = Math.max(0.01, this.life + this.lifeVar * rand11());
        p.s0 = this.startSize + this.startSizeVar * rand11();
        p.s1 = this.endSize + this.endSizeVar * rand11();
        p.radAcc = this.radialAccel + this.radialAccelVar * rand11();
        p.tanAcc = this.tangentialAccel + this.tangentialAccelVar * rand11();
        p.spin0 = this.startSpin + this.startSpinVar * rand11();
        p.spin1 = this.endSpin + this.endSpinVar * rand11();
        p.c0.set(clamp255(this.startColor.r + this.startColorVar.r * rand11()),
                 clamp255(this.startColor.g + this.startColorVar.g * rand11()),
                 clamp255(this.startColor.b + this.startColorVar.b * rand11()),
                 clamp255(this.startColor.a + this.startColorVar.a * rand11()));
        p.c1.set(clamp255(this.endColor.r + this.endColorVar.r * rand11()),
                 clamp255(this.endColor.g + this.endColorVar.g * rand11()),
                 clamp255(this.endColor.b + this.endColorVar.b * rand11()),
                 clamp255(this.endColor.a + this.endColorVar.a * rand11()));
        p.lastSize = -1; p.lastAngle = 1e9; p.lastColor = -1;
        p.alive = true;
        this._alive++;
        p.node.active = true;
        p.node.setPosition(p.pos.x, p.pos.y, 0);
        return true;
    }

    update(dt: number) {
        if (!this._built) return;
        if (dt > 0.1) dt = 0.1;   // 掉帧保护，避免一次积分穿模
        if (!this._stopped) {
            this._acc += this.emissionRate * dt;
            while (this._acc >= 1) {
                this._acc -= 1;
                if (!this._spawn()) { this._acc = 0; break; }
            }
        }
        if (this._alive === 0) return;
        for (const p of this._pool) {
            if (!p.alive) continue;
            p.life -= dt;
            if (p.life <= 0) { this._kill(p); continue; }
            const t = 1 - p.life / p.totalLife;
            const len = Math.sqrt(p.pos.x * p.pos.x + p.pos.y * p.pos.y);
            let rx = 0, ry = 0;
            if (len > 0) { rx = p.pos.x / len; ry = p.pos.y / len; }
            const tx = -ry, ty = rx;
            p.vel.x += (rx * p.radAcc + tx * p.tanAcc + this.gravity.x) * dt;
            p.vel.y += (ry * p.radAcc + ty * p.tanAcc + this.gravity.y) * dt;
            p.pos.x += p.vel.x * dt;
            p.pos.y += p.vel.y * dt;
            p.node.setPosition(p.pos.x, p.pos.y, 0);
            const size = p.s0 + (p.s1 - p.s0) * t;
            if (Math.abs(size - p.lastSize) > 0.05) { p.ui.setContentSize(size, size); p.lastSize = size; }
            const spin = p.spin0 + (p.spin1 - p.spin0) * t;
            if (Math.abs(spin - p.lastAngle) > 0.05) { p.node.angle = spin; p.lastAngle = spin; }
            const c = this._c;
            c.r = p.c0.r + (p.c1.r - p.c0.r) * t;
            c.g = p.c0.g + (p.c1.g - p.c0.g) * t;
            c.b = p.c0.b + (p.c1.b - p.c0.b) * t;
            c.a = p.c0.a + (p.c1.a - p.c0.a) * t;
            const key = ((c.r | 0) << 24) | ((c.g | 0) << 16) | ((c.b | 0) << 8) | (c.a | 0);
            if (key !== p.lastColor) { p.sprite.color = c; p.lastColor = key; }
        }
    }
}
