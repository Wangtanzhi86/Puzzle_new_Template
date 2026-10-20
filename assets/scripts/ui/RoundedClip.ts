import { _decorator, Color, Component, Graphics, Mask, UITransform } from 'cc';

const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('RoundedClip')
@executeInEditMode(true)
export class RoundedClip extends Component {
    @property({ displayName: '圆角半径（px）' }) radius = 26;
    @property({ displayName: '内缩（px）', tooltip: '正数把裁剪框往里收，盖住图片的方角' }) inset = 2;

    onLoad() { this.apply(); }

    onEnable() { this.apply(); }

    apply() {
        const ui = this.node.getComponent(UITransform);
        if (!ui) return;
        const g = this.node.getComponent(Graphics) || this.node.addComponent(Graphics);
        const m = this.node.getComponent(Mask) || this.node.addComponent(Mask);
        m.type = Mask.Type.GRAPHICS_STENCIL;
        const w = ui.width - this.inset * 2;
        const h = ui.height - this.inset * 2;
        g.fillColor = Color.WHITE;
        g.clear();
        g.roundRect(-w * ui.anchorX, -h * ui.anchorY, w, h, Math.min(this.radius, Math.min(w, h) / 2));
        g.fill();
    }
}
