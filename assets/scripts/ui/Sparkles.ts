import { _decorator, Color, Component, Node, Sprite, SpriteFrame, UIOpacity, UITransform } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 轻量粒子：在自己这块矩形里撒一圈小光点，向上飘、边飘边亮再淡出，循环。
 * 不用 ParticleSystem2D —— 参数少、可控，也不会把引擎粒子模块的配置项拖进场景。
 */
@ccclass('Sparkles')
export class Sparkles extends Component {
    @property({ type: SpriteFrame, displayName: '光点贴图' }) dot: SpriteFrame = null;

    @property({ displayName: '数量' }) count = 12;

    @property({ displayName: '范围宽（px）' }) areaWidth = 600;

    @property({ displayName: '范围高（px）' }) areaHeight = 200;

    @property({ displayName: '单个寿命（秒）' }) life = 1.6;

    @property({ displayName: '最小尺寸（px）' }) sizeMin = 3;

    @property({ displayName: '最大尺寸（px）' }) sizeMax = 34;

    @property({ displayName: '上升速度（px/s）' }) rise = 60;

    @property({ displayName: '左右漂移（px/s）' }) drift = 26;

    @property({ displayName: '向下落', tooltip: '勾上就从范围顶边往下飘，不勾从底部往上飘' }) downward = false;

    @property({ displayName: '颜色' }) color = new Color(255, 246, 214, 255);

    private _items: { node: Node; ui: UITransform; op: UIOpacity; t: number; life: number; x: number; y: number; vx: number; vy: number }[] = [];

    protected onEnable (): void {
        this.build();
    }

    protected onDisable (): void {
        for (const it of this._items) it.node.destroy();
        this._items.length = 0;
    }

    private build (): void {
        if (!this.dot) return;
        for (let i = 0; i < this.count; i++) {
            const node = new Node('Dot');
            node.setParent(this.node);
            const ui = node.addComponent(UITransform);
            const sp = node.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = this.dot;
            sp.color = this.color;
            const op = node.addComponent(UIOpacity);
            const it = { node, ui, op, t: Math.random() * this.life, life: this.life, x: 0, y: 0, vx: 0, vy: 0 };
            this.respawn(it, true);
            this._items.push(it);
        }
    }

    private respawn (it: { ui: UITransform; t: number; life: number; x: number; y: number; vx: number; vy: number }, randomT: boolean): void {
        // 平方分布：多数是小点，偶尔蹦一颗大的，尺寸差距一眼看得出来
        const size = this.sizeMin + Math.pow(Math.random(), 2.2) * (this.sizeMax - this.sizeMin);
        it.ui.setContentSize(size, size);
        it.life = this.life * (0.7 + Math.random() * 0.6);
        it.t = randomT ? Math.random() * it.life : 0;
        it.x = (Math.random() - 0.5) * this.areaWidth;
        it.vx = (Math.random() - 0.5) * this.drift;
        if (this.downward) {
            it.y = this.areaHeight * 0.5 - Math.random() * this.areaHeight * 0.15;
            it.vy = -this.rise * (0.5 + Math.random() * 0.8);
        } else {
            it.y = -this.areaHeight * 0.5 + (Math.random() - 0.2) * this.areaHeight * 0.35;
            it.vy = this.rise * (0.5 + Math.random() * 0.8);
        }
    }

    protected update (dt: number): void {
        if (!this._items.length) return;
        for (const it of this._items) {
            it.t += dt;
            if (it.t >= it.life) this.respawn(it, false);
            const k = it.t / it.life;
            const t = it.t;
            it.node.setPosition(it.x + it.vx * t, it.y + it.vy * t, 0);
            it.op.opacity = Math.round(Math.sin(Math.PI * k) * 255);
        }
    }
}
