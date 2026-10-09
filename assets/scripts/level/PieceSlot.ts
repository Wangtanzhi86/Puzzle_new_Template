import { _decorator, Component, Node, Rect, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { OverlayMode } from '../data/LevelTypes';
import { CircleReveal } from '../gameplay/CircleReveal';
import { RepairReveal } from '../gameplay/RepairReveal';
import { RepairedSlot } from './RepairedSlot';
import { TapeReveal } from './TapeReveal';

const { ccclass, property } = _decorator;

/**
 * 一个缺口 —— 分组节点 `Slot_XX` 上挂这一个组件。
 *
 * 换美术 = 在它下面摆两张图：修复前的（`Broken`，即 `brokenView` 指的那个节点）和修复后的
 * （`Repaired`，挂 `RepairedSlot`）。位置、缩放你在编辑器里怎么调都行，代码里不写死坐标。
 *
 * 缺口的位置和尺寸一律取「修复前那张图」节点的世界包围盒（图挂了 scale 也算数）——
 * 你在编辑器里怎么挪、怎么缩放那张图，吸附半径、吸附落点、拿起时的放大倍率都跟着走。
 * `Slot_XX` 自己的尺寸不参与玩法。
 */
@ccclass('PieceSlot')
export class PieceSlot extends Component {
    @property({ type: SpriteFrame, displayName: '修复前（破损图）' }) brokenSprite: SpriteFrame = null;
    @property({ type: SpriteFrame, displayName: '修复后（完整图）' }) repairedSprite: SpriteFrame = null;
    @property({ type: [SpriteFrame], displayName: '遮挡层备用图（顺序即 z 序）' })
    overlays: SpriteFrame[] = [];

    @property({ displayName: '碎片序号', tooltip: '碎片池按它排列，也决定这块碎片属于哪个缺口' })
    pieceId = 0;

    @property({ displayName: '吸附半径（px）', tooltip: '0 表示按下面的半径比自动算' })
    snapRadius = 0;

    @property({ displayName: '吸附半径比', tooltip: '相对缺口短边。只在上一项为 0 时生效' })
    snapRadiusRatio = 0.25;

    @property({ type: OverlayMode, displayName: '遮挡层显示时机' })
    overlayMode = OverlayMode.ON_COMPLETE;

    @property({ displayName: '层级', tooltip: '值越小越靠前，onLoad 时按它排兄弟序' })
    zOrder = 0;

    @property({ type: Sprite, displayName: '修复前 Sprite', tooltip: '缺口的位置、尺寸、吸附半径都以它的世界包围盒为准；必须是本节点的子节点 —— 修复时整个节点会被隐藏' })
    brokenView: Sprite = null;

    @property({ type: RepairedSlot, displayName: '修复后组件' }) repairedView: RepairedSlot = null;

    @property({ type: Node, displayName: '换掉：隐藏节点', tooltip: '填了它就在这一格修好之后把这个节点藏起来、把下面那个放出来（毛衣 → 好人就是这么换的），同时把这一格修复后的图收掉 —— 也就是这一格的实物不出场' })
    swapHide: Node = null;

    @property({ type: Node, displayName: '换掉：显示节点', tooltip: '配合上一项使用，两个都填了才生效；它自己那套序列帧照旧循环，不用改配置' })
    swapShow: Node = null;

    @property({ displayName: '换节点延迟（秒）', tooltip: '只在这格没走「修复揭晓」时才用：先露出实物挨自己的扫光，隔这么久再换。配成和扫光时长一样（默认 0.45）就是先扫光、扫完再换' })
    swapDelay = 0.45;

    @property({ displayName: '换节点渐显时长（秒）', tooltip: '换的那一下两个角色交叉淡入淡出（两边都要挂 UIOpacity）；填 0 就是硬切' })
    swapFadeTime = 0.25;

    @property({ type: SpriteFrame, displayName: '碎片池用图', tooltip: '只在池里（拿在手上）显示的图。留空则退回修复后的图' })
    poolSprite: SpriteFrame = null;

    @property({ type: TapeReveal, displayName: '胶带揭晓', tooltip: '填了它就在这一格修好时先藏住修复图，让胶带依次显现，全刷完再收起并显示修复图' })
    tapeReveal: TapeReveal = null;

    @property({ type: RepairReveal, displayName: '修复揭晓（序列帧）', tooltip: '填了它就在修复图露脸前先播一段序列帧再把它放大出来；本格配了「换掉」那两个节点时只播序列帧、不放大（实物不出场，播完直接换节点）；没填或关了开关就照旧直接显示' })
    revealAnim: RepairReveal = null;

    @property({ type: CircleReveal, displayName: '圆形扩散揭晓', tooltip: '来自「结束背景」那套换图手法：破损图留着垫在底下，修复图从缺口中心以圆形羽化扩出来盖掉它，扩完才收破损图。填了它这一格就整格走它 —— 上面那些揭晓都不会发生' })
    circleReveal: CircleReveal = null;

    private _repaired = false;
    private _index = -1;

    get repaired(): boolean {
        return this._repaired;
    }

    get radius(): number {
        if (this.snapRadius > 0) return this.snapRadius;
        return Math.min(this.width, this.height) * this.snapRadiusRatio;
    }

    /** 修复前那张图自己的世界矩形。Sprite 的尺寸模式得是 CUSTOM，画的框才是这个矩形。
     *  不用 `getBoundingBoxToWorld()`：实测它会把**活着的子节点**一并进来，图下面挂个项目影，
     *  缺口框就悄悄变大了。旋转不参与计算（槽位都是正着的）。 */
    private box(): Rect {
        const view = this.brokenView.node;
        const ut = view.getComponent(UITransform);
        const scale = view.worldScale;
        const at = view.worldPosition;
        const w = ut.width * scale.x;
        const h = ut.height * scale.y;
        return new Rect(at.x - w * ut.anchorX, at.y - h * ut.anchorY, w, h);
    }

    get width(): number {
        return this.box().width;
    }

    get height(): number {
        return this.box().height;
    }

    get worldCenter(): Vec3 {
        const box = this.box();
        return new Vec3(box.x + box.width / 2, box.y + box.height / 2, 0);
    }

    /** 碎片池里那块碎片该长什么样 —— 默认是修好之后的样子，`poolSprite` 可以换成另一张 */
    get pieceFrame(): SpriteFrame {
        if (this.poolSprite) return this.poolSprite;
        if (this.repairedSprite) return this.repairedSprite;
        return this.repairedView ? this.repairedView.frame : null;
    }

    protected onLoad(): void {
        this.node.setSiblingIndex(this.zOrder);
        if (this.brokenSprite) this.brokenView.spriteFrame = this.brokenSprite;
        if (this.swapShow) this.swapShow.active = false;
        if (this.repairedView) {
            if (this.repairedSprite || this.overlays.length) {
                this.repairedView.setArt(this.repairedSprite, this.overlays);
            }
            this.repairedView.hide();
        }
    }

    /** 返回 true 表示这次真的修好了（重复吸附同一缺口会被挡掉）。
     *  `slotIndex` 会跟着 `PIECE_SHOWN` 抛出去 —— 吸附和修复图露面可能不在同一时刻（见 `tapeReveal`）。 */
    repair(slotIndex: number): boolean {
        if (this._repaired) return false;
        this._repaired = true;
        this._index = slotIndex;
        // 圆形扩散揭晓：破损图留着垫在底下，等修复图扩出来盖掉它再收（circleShown）——
        // 这一格整格由它接管，下面的胶带 / 换节点 / 序列帧都不会发生
        if (this.circleReveal && this.circleReveal.handles(this)) {
            this.circleReveal.play(this, this.circleShown);
            return true;
        }
        this.brokenView.node.active = false;
        // 配了胶带揭晓：先藏住修复图，让胶带依次刷出来，全刷完由 showRepaired 放出来
        if (this.tapeReveal) {
            if (this.repairedView) this.repairedView.hide();
            this.tapeReveal.play(this.showRepaired, this._index);
            return true;
        }
        const swap = !!(this.swapHide && this.swapShow);
        // 配了替换节点（毛衣）：修复后的实物不出场 —— 序列帧播完直接换节点，露面的是换成好人的那个
        if (swap && this.revealAnim && this.revealAnim.play(this, this.swapAndShown, false)) return true;
        this.showRepaired();
        // 没开揭晓就退回老路：先露出实物挨这一格自己的扫光，过 swapDelay 再换节点并把它收掉
        if (swap) this.scheduleOnce(this.swapAfterSweep, this.swapDelay);
        return true;
    }

    revealOverlays(): void {
        if (this.repairedView) this.repairedView.showOverlays();
    }

    /** 该把修复图放出来了。普通槽位在 `repair()` 里同步走到，胶带那格等胶带全刷完才走到 ——
     *  所以配了修复揭晓的槽位是「自己的揭晓先走完，再播序列帧、再放大」。 */
    private showRepaired = (): void => {
        const view = this.repairedView;
        if (view && this.revealAnim && this.revealAnim.play(this, this.shown)) return;
        if (view) view.show(this.overlayMode === OverlayMode.IMMEDIATE);
        this.shown();
    };

    /** 修复图真正露出来的那一下 */
    private shown = (): void => {
        EventBus.emit(GameEvent.PIECE_SHOWN, this._index);
        // 配了胶带揭晓的那格就是窗户：它整段揭晓跑完（胶带 → 序列帧 → 放大）再抛一次，专门给音频当「结束事件」
        if (this.tapeReveal) EventBus.emit(GameEvent.WINDOW_REPAIRED, this._index);
    };

    /** 圆形扩散铺满了：这一格才算露面 —— 先把垫在底下的破损图收掉 */
    private circleShown = (): void => {
        this.brokenView.node.active = false;
        this.shown();
    };

    /** 揭晓那格：序列帧播完换节点 —— 换完才算这一格「露脸」（实物没出场，出现的是换成好人的那个） */
    private swapAndShown = (): void => {
        this.swapAfterSweep();
        this.shown();
    };

    /** 换节点那一下：藏掉原来那个（坏人）、放出替换的（好人），同时把这一格修复后的图收掉。
     *  渐显走 `UIOpacity`：好人从 0 淡到 255，坏人在同一段时间里淡到 0 再隐藏 ——
     *  好人排在这两个的后面（兄弟序），淡入时压在淡出的坏人上面，看起来是「变了个身」而不是「先空一下再冒出来」。 */
    private swapAfterSweep = (): void => {
        this.swapShow.active = true;
        if (this.swapFadeTime > 0) {
            const hide = this.swapHide.getComponent(UIOpacity);
            const show = this.swapShow.getComponent(UIOpacity);
            show.opacity = 0;
            tween(show).to(this.swapFadeTime, { opacity: 255 }).start();
            tween(hide)
                .to(this.swapFadeTime, { opacity: 0 })
                .call(() => { this.swapHide.active = false; })
                .start();
        } else {
            this.swapHide.active = false;
        }
        if (this.repairedView) this.repairedView.hide();
    };
}
