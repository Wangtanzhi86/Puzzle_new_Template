import { _decorator, Component, Node, Rect, Sprite, SpriteFrame, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { OverlayMode } from '../data/LevelTypes';
import { CircleReveal } from '../gameplay/CircleReveal';
import { RepairReveal } from '../gameplay/RepairReveal';
import { StickerApply } from '../gameplay/StickerApply';
import { PeelConfig } from '../gameplay/StickerPeel';
import { BroomSweep } from './BroomSweep';
import { FlushAction } from './FlushAction';
import { RepairedSlot } from './RepairedSlot';
import { SprayAction } from './SprayAction';

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

    @property({ type: Node, displayName: '随修复前一起隐藏的节点', tooltip: '修复时和「修复前那张图」一起藏起来（比如贴在图上的数字标签）。留空不影响任何表现' })
    hideWithBroken: Node = null;

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

    @property({ displayName: '本格单独配揭角', tooltip: '勾上之后这一格碎片的揭角（掀哪个角 / 掀多大 / 快慢 / 背面颜色）全按下面那份来；不勾就用碎片工厂上那份全局的。⚠️ 勾上时下面那份是「类的默认值」不是全局那份 —— 想从全局那组起步就重跑一次 tools/js/mount-slot-peel.js' })
    peelOverride = false;

    @property({ type: PeelConfig, displayName: '揭角参数（本格）', tooltip: '只在上面那个勾上时生效' })
    peelParams: PeelConfig = new PeelConfig();

    @property({ type: RepairReveal, displayName: '修复揭晓（序列帧）', tooltip: '填了它就在修复图露脸前先播一段序列帧再把它放大出来；本格配了「换掉」那两个节点时只播序列帧、不放大（实物不出场，播完直接换节点）；没填或关了开关就照旧直接显示' })
    revealAnim: RepairReveal = null;

    @property({ type: CircleReveal, displayName: '圆形扩散揭晓', tooltip: '来自「结束背景」那套换图手法：破损图留着垫在底下，修复图从缺口中心以圆形羽化扩出来盖掉它，扩完才收破损图。填了它这一格就整格走它 —— 上面那些揭晓都不会发生' })
    circleReveal: CircleReveal = null;

    @property({ type: StickerApply, displayName: '贴纸贴平揭晓', tooltip: '和碎片揭角反着演：修复图整张出现在缺口上、一角还翘着，再把折线推向对边按平。填了它这一格就整格走它 —— 和「圆形扩散揭晓」只能填一个，两个都填时走它' })
    stickerApply: StickerApply = null;

    @property({ type: FlushAction, displayName: '通马桶动作', tooltip: '填了它这一格修好后先挪到位、抽动、排水，整段演完才算这一格露面（PIECE_SHOWN 延后）' })
    flushAction: FlushAction = null;

    @property({ type: BroomSweep, displayName: '扫地动作', tooltip: '填了它这一格修好后依次扫掉「物品父节点」下的每个子物品，扫把最后渐隐，整段演完才算露面' })
    sweepAction: BroomSweep = null;

    @property({ type: SprayAction, displayName: '喷瓶动作', tooltip: '填了它这一格修好后先上下摇晃，再换成喷雾那张边浮动边把气体渐隐，最后把这一格修复图收掉，整段演完才算露面' })
    sprayAction: SprayAction = null;

    @property({ type: [PieceSlot], displayName: '前置槽位', tooltip: '这些槽位全部修好之后，本格才走「达标」那条 —— 展示下面的替换修复图；否则展示「修复后组件」那张，并抛一次 REPAIR_FAILED。留空 = 没有前置，永远达标' })
    requires: PieceSlot[] = [];

    @property({ type: RepairedSlot, displayName: '达标后的修复图', tooltip: '配合「前置槽位」用：前置都修好了就展示它，没修好展示「修复后组件」那张。它平时由 onLoad 收起（编辑器里要看得见就手动打开）' })
    altView: RepairedSlot = null;

    private _repaired = false;
    private _index = -1;
    /** 本次修复时算出来的「达标」结果，`showView` 每一步都读它 */
    private _met = false;

    get repaired(): boolean {
        return this._repaired;
    }

    get radius(): number {
        if (this.snapRadius > 0) return this.snapRadius;
        return Math.min(this.width, this.height) * this.snapRadiusRatio;
    }

    /** 一个视图节点自己的世界矩形。Sprite 的尺寸模式得是 CUSTOM，画的框才是这个矩形。
     *  不用 `getBoundingBoxToWorld()`：实测它会把**活着的子节点**一并进来，图下面挂个项目影，
     *  缺口框就悄悄变大了。旋转不参与计算（槽位都是正着的）。 */
    private worldBoxOf(view: Node): Rect {
        const ut = view.getComponent(UITransform);
        const scale = view.worldScale;
        const at = view.worldPosition;
        const w = ut.width * scale.x;
        const h = ut.height * scale.y;
        return new Rect(at.x - w * ut.anchorX, at.y - h * ut.anchorY, w, h);
    }

    private box(): Rect {
        return this.worldBoxOf(this.brokenView.node);
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

    /** 碎片拿在手上时缩放到的目标高度 —— 取「修复后」那张图，不是缺口框。
     *  池里那块碎片本来就是修复后的图（`pieceFrame` 优先 `repairedSprite` / `repairedView`），
     *  拿起来按它自己的尺寸放大，吸附那一刻才不会跳一下。取修复前那张的话，两张图尺寸不一致的
     *  槽位（`Slot_06`：白线 55×44 / 实物 52×73）拿在手上会突然缩到六成。
     *  没配 `repairedView` 就退回缺口框，总不至于算不出来。 */
    get carryHeight(): number {
        return this.repairedView ? this.worldBoxOf(this.repairedView.node).height : this.height;
    }

    /** 这一格这次修复该展示的那张「修复后」：达标（前置槽位都修好了）走替换图，没达标走原来那张。
     *  揭晓（序列帧 / 圆形扩散 / 扫光）都读它，所以没达标那一下扩散盖住的是「未达标」那张。 */
    get showView(): RepairedSlot {
        return this._met && this.altView ? this.altView : this.repairedView;
    }

    /** 前置槽位是不是都修好了。没配前置就是 true（那种槽位只看 `altView` 在不在） */
    private meetsRequires(): boolean {
        for (const s of this.requires) if (!s.repaired) return false;
        return true;
    }

    /** 碎片池里那块碎片该长什么样 —— 默认是修好之后的样子，`poolSprite` 可以换成另一张 */
    get pieceFrame(): SpriteFrame {
        if (this.poolSprite) return this.poolSprite;
        if (this.repairedSprite) return this.repairedSprite;
        return this.repairedView ? this.repairedView.frame : null;
    }

    /** 这一格自己那份揭角参数；没勾就是 null —— 调用方（碎片工厂 / 贴纸贴平）退回全局那份 */
    get peel(): PeelConfig {
        return this.peelOverride ? this.peelParams : null;
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
        if (this.altView) this.altView.hide();
    }

    /** 收掉「修复前」那套画面：破损图 + 配在 `hideWithBroken` 上的搭子（贴图上的数字之类）。
     *  收的时机有三处（贴纸贴平当场收 / 普通路当场收 / 圆形扩散扩完再收），都走这一句。 */
    private hideBroken(): void {
        this.brokenView.node.active = false;
        if (this.hideWithBroken) this.hideWithBroken.active = false;
    }

    /** 返回 true 表示这次真的修好了（重复吸附同一缺口会被挡掉）。
     *  `slotIndex` 会跟着 `PIECE_SHOWN` 抛出去 —— 吸附和修复图露面可能不在同一时刻
     *  （圆形扩散 / 序列帧 / 收尾动作都会把它推后）。 */
    repair(slotIndex: number): boolean {
        if (this._repaired) return false;
        this._repaired = true;
        this._index = slotIndex;
        // 这一格整段表现（揭晓 + 收尾动作）演完之前，空闲引导的计时器停住 —— 不然引导会盖在
        // 正在播的动画上。演完在 spotDone 里放行（多格同时在飞就累计）
        EventBus.emit(GameEvent.GUIDE_HOLD);
        // 两种状态：前置槽位都修好了才算达标。没达标就展示「未达标」那张修复图（`showView` 选的），
        // 并抛一次失败事件 —— 这一格照旧算修好（进度照加），怎么终局由听这条事件的人决定
        this._met = this.meetsRequires();
        if (this.altView && !this._met) EventBus.emit(GameEvent.REPAIR_FAILED, slotIndex);
        // 贴纸贴平：修复图整张出现（翘着一个角）再按平贴上去。破损图**吸附这一刻就收掉** ——
        // 修复图从第一帧起就铺满整个缺口，翘起来那个角露的是贴纸背面，底下不用垫图。
        // 和圆形扩散一样是整格接管，两个都填时走它（见那个 @property 的 tooltip）
        if (this.stickerApply && this.stickerApply.handles(this)) {
            this.hideBroken();
            this.stickerApply.play(this, this.shown);
            return true;
        }
        // 圆形扩散揭晓：破损图留着垫在底下，等修复图扩出来盖掉它再收（covered）——
        // 这一格整格由它接管，下面的胶带 / 换节点 / 序列帧都不会发生
        if (this.circleReveal && this.circleReveal.handles(this)) {
            this.circleReveal.play(this, this.covered);
            return true;
        }
        this.hideBroken();
        const swap = !!(this.swapHide && this.swapShow);
        // 配了替换节点（毛衣）：修复后的实物不出场 —— 序列帧播完直接换节点，露面的是换成好人的那个
        if (swap && this.revealAnim && this.revealAnim.play(this, this.swapAndShown, false)) return true;
        this.showRepaired();
        // 没开揭晓就退回老路：先露出实物挨这一格自己的扫光，过 swapDelay 再换节点并把它收掉
        if (swap) this.scheduleOnce(this.swapAfterSweep, this.swapDelay);
        return true;
    }

    revealOverlays(): void {
        const view = this.showView;
        if (view) view.showOverlays();
    }

    /** 该把修复图放出来了。普通槽位在 `repair()` 里同步走到，胶带那格等胶带全刷完才走到 ——
     *  所以配了修复揭晓的槽位是「自己的揭晓先走完，再播序列帧、再放大」。 */
    private showRepaired = (): void => {
        const view = this.showView;
        if (view && this.revealAnim && this.revealAnim.play(this, this.shown)) return;
        if (view) view.show(this.overlayMode === OverlayMode.IMMEDIATE);
        this.shown();
    };

    /** 修复图真正露出来的那一下。配了收尾动作的槽位（通马桶 / 扫地）先把它整段演完再抛 ——
     *  `SceneBgSwap`（完成背景 → `END_SHOW`）和总修复扫光都按 `PIECE_SHOWN` 计数，这一格要是
     *  最后一块修好的，动作还没演完完成背景就盖上来，整段表现被吞掉。 */
    private shown = (): void => {
        if (this.flushAction && this.flushAction.handles(this)) {
            this.flushAction.play(this, this.spotDone);
            return;
        }
        if (this.sweepAction && this.sweepAction.handles(this)) {
            this.sweepAction.play(this, this.spotDone);
            return;
        }
        if (this.sprayAction && this.sprayAction.handles(this)) {
            this.sprayAction.play(this, this.spotDone);
            return;
        }
        this.spotDone();
    };

    /** 收尾动作演完（或这一格根本没有动作）：这一格这才算露面 */
    private spotDone = (): void => {
        EventBus.emit(GameEvent.PIECE_SHOWN, this._index);
        EventBus.emit(GameEvent.GUIDE_RESUME);
    };

    /** 修复图铺满了（圆形扩散）：这一格才算露面 —— 先把垫在底下的破损图收掉 */
    private covered = (): void => {
        this.hideBroken();
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
        const view = this.showView;
        if (view) view.hide();
    };
}
