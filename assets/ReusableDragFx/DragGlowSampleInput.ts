import { _decorator, Component, EventTouch, game, Game, Node, UITransform, Vec3 } from 'cc';
import { DragVisualEvents } from './DragVisualEvents';
const { ccclass, property, disallowMultiple } = _decorator;

/** Standalone demonstration input. Remove this component when using an existing drag controller. */
@ccclass('DragGlowSampleInput')
@disallowMultiple
export class DragGlowSampleInput extends Component {
    @property({ type: UITransform, displayName: '示例物品尺寸组件（必需）' })
    public itemTransform: UITransform | null = null;
    private rootTransform: UITransform | null = null;
    private touchId = -1;
    private readonly offset = new Vec3();
    private readonly point = new Vec3();
    private readonly origin = new Vec3();
    private bound = false;
    protected onEnable(): void {
        this.rootTransform = this.getComponent(UITransform);
        if (!this.rootTransform || !(this.itemTransform instanceof UITransform)
            || !this.itemTransform.isValid || this.itemTransform.node.parent !== this.node) {
            console.error('[DragGlowSampleInput] ' + this.node.name + ': 本节点 UITransform 或直接子节点 itemTransform 绑定缺失/错误，停止示例拖动。');
            return;
        }
        const item = this.itemTransform.node;
        item.on(Node.EventType.TOUCH_START, this.startDrag, this);
        item.on(Node.EventType.TOUCH_MOVE, this.moveDrag, this);
        item.on(Node.EventType.TOUCH_END, this.endDrag, this);
        item.on(Node.EventType.TOUCH_CANCEL, this.endDrag, this);
        game.on(Game.EVENT_HIDE, this.clearDrag, this);
        this.bound = true;
    }
    private startDrag(event: EventTouch): void {
        if (this.touchId !== -1 || !event.touch) return;
        this.touchId = event.touch.getID();
        const pos = event.getUILocation();
        this.point.set(pos.x, pos.y, 0);
        this.rootTransform!.convertToNodeSpaceAR(this.point, this.origin);
        Vec3.subtract(this.offset, this.itemTransform!.node.position, this.origin);
        this.itemTransform!.node.emit(DragVisualEvents.BEGIN);
    }
    private moveDrag(event: EventTouch): void {
        if (this.touchId === -1 || event.touch?.getID() !== this.touchId) return;
        const pos = event.getUILocation();
        this.point.set(pos.x, pos.y, 0);
        this.rootTransform!.convertToNodeSpaceAR(this.point, this.origin);
        Vec3.add(this.point, this.origin, this.offset);
        this.itemTransform!.node.setPosition(this.point);
    }
    private endDrag(event: EventTouch): void {
        if (this.touchId === -1 || event.touch?.getID() !== this.touchId) return;
        this.touchId = -1;
        this.itemTransform!.node.emit(DragVisualEvents.END);
    }
    private clearDrag(): void {
        this.touchId = -1;
        if (this.itemTransform?.isValid) this.itemTransform.node.emit(DragVisualEvents.CLEAR);
    }
    protected onDisable(): void {
        this.clearDrag();
        if (!this.bound) return;
        const item = this.itemTransform!.node;
        item.off(Node.EventType.TOUCH_START, this.startDrag, this);
        item.off(Node.EventType.TOUCH_MOVE, this.moveDrag, this);
        item.off(Node.EventType.TOUCH_END, this.endDrag, this);
        item.off(Node.EventType.TOUCH_CANCEL, this.endDrag, this);
        game.off(Game.EVENT_HIDE, this.clearDrag, this);
        this.bound = false;
    }
}
