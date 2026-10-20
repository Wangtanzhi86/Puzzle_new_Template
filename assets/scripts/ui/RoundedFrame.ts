import { _decorator, Color, Component, Graphics, Node, UITransform } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, property, executeInEditMode } = _decorator;

/**
 * 在节点自己那一圈画圆角白边（运行期画，不靠编辑器里存的路径 —— Graphics 的路径指令不会进场景）。
 *
 * 自发光靠「一圈圈向外变宽、变淡的描边」叠出来：每圈用**独立子节点 + 独立 Graphics**，
 * 因为同一个 Graphics 的路径会累积，换线宽重描会把前面几圈一起按新样式重画。
 * 编辑器里（EDITOR）只画最里面那道实边，免得预览态凭空多出一堆节点。
 */
@ccclass('RoundedFrame')
@executeInEditMode(true)
export class RoundedFrame extends Component {
    @property({ displayName: '线宽（px）' }) width = 2;
    @property({ displayName: '圆角半径（px）' }) radius = 30;
    @property({ displayName: '发光层数', tooltip: '0 = 只画实边；>0 向外叠若干层变淡的宽描边' }) glowRings = 0;
    @property({ displayName: '发光扩散（px）' }) glowSpread = 26;
    @property({ displayName: '发光强度（0~1）' }) glowPower = 1;

    private _rings: Node[] = [];

    onLoad() { this.draw(); }

    onEnable() { this.draw(); }

    draw() {
        const ui = this.node.getComponent(UITransform);
        if (!ui) return;
        const g = this.node.getComponent(Graphics) || this.node.addComponent(Graphics);
        const x = -ui.width / 2;
        const y = -ui.height / 2;

        g.clear();
        g.lineWidth = this.width;
        g.strokeColor = Color.WHITE;
        g.roundRect(x, y, ui.width, ui.height, this.radius);
        g.stroke();

        if (EDITOR) return;

        const n = Math.max(0, this.glowRings);
        while (this._rings.length < n) {
            const node = new Node('GlowRing');
            node.setParent(this.node);
            node.addComponent(UITransform);
            node.addComponent(Graphics);
            this._rings.push(node);
        }
        for (let i = 0; i < this._rings.length; i++) {
            const node = this._rings[i];
            node.active = i < n;
            if (!node.active) continue;
            const t = (i + 1) / n;
            const ringUi = node.getComponent(UITransform);
            ringUi.setContentSize(ui.width, ui.height);
            const rg = node.getComponent(Graphics);
            rg.clear();
            rg.lineWidth = this.width + this.glowSpread * t * t;
            const a = Math.max(0, Math.min(255, Math.round(255 * this.glowPower * (1 - t) * (1 - t) * 1.6)));
            rg.strokeColor = new Color(255, 255, 255, a);
            rg.roundRect(x, y, ui.width, ui.height, this.radius);
            rg.stroke();
        }
    }
}
