import { _decorator, assetManager, Component, Node, Sprite, UITransform } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, property, executeInEditMode } = _decorator;

/**
 * 拼图框按底图比例自适应：换一张比例不同的底图，框（连同它的 RECT Mask 和完成背景）自己跟着变。
 * 挂在 `Canvas/GameLayer` 上。
 *
 * 为什么需要它：`Scene_BG` 的 Sprite 是 `CUSTOM` 尺寸模式 —— **贴图有多少像素跟节点的世界尺寸无关**，
 * 只有长宽比变了才会变形。而 `GameLayer` / `Scene_BG` / `完成背景` 三处尺寸是硬钉死的（§7.1 那个
 * 「一条边都不贴」的记号），换一张比例的图本来要手改三个数 + 改 `tools/js/mount-adapt.js` 里那个常量。
 *
 * 规则：把贴图的原始长宽比装进 `maxWidth × maxHeight` 的盒子（contain，不变形），三处写成同一个尺寸
 * —— 它们在各自的父节点里都是 (0,0)，同尺寸即同心。
 *
 * **只写尺寸，一个字节都不动位置**：位置是作者在场景里摆的。`GameLayer` 只在画布上居中、另两处是它的
 * 子链，不动位置就永远碰不到下面的进度条和碎片池；而盒子取的就是当前空间的上限，所以框只会变矮或变窄。
 *
 * ⚠️ 换图之后 **6 个 `Slot_XX` 还得手工重摆一次** —— 槽位是照美术构图摆的，比例一变构图就变了，
 * 那是美术信息，算不出来。这个组件只保证框不变形。
 *
 * ⚠️ `@executeInEditMode` **必须写在 `@ccclass` 下面**（装饰器自下而上生效）：写反了类缓存取不到、
 * 标志位静默不写，编辑期什么都不会发生，只在 DEV 下打一行错。本项目这一条是唯一一例，别挪。
 */
@ccclass('PuzzleAreaFit')
@executeInEditMode(true)
export class PuzzleAreaFit extends Component {
    @property({ type: Sprite, displayName: '比例来源（Scene_BG 的 Sprite）', tooltip: '按这张贴图的原始长宽比反算拼图框。它所在的节点也会被写成同一个尺寸' })
    source: Sprite = null;

    @property({ type: Node, displayName: '完成背景', tooltip: '必须和拼图框同尺寸 —— 圆形扩散是照它的框盖过去的，差一点四角就盖不满' })
    doneBg: Node = null;

    @property({ displayName: '框最大宽（px）', tooltip: '图比这个盒子瘦就按宽顶满、高度自己缩' })
    maxWidth = 671.45;

    @property({ displayName: '框最大高（px）', tooltip: '图比这个盒子胖就按高顶满、宽度自己缩。别超过 919（画布顶 640 − 本节点 y 180.435），否则顶边出画布' })
    maxHeight = 840;

    protected onLoad(): void {
        this.refit();
    }

    /**
     * 编辑期跟着换图走。编辑器的场景视图**不是每帧都 tick**，是事件驱动 —— 在 Inspector 里换一张图会
     * 把场景标脏，下一次 tick 就轮到这条，框当场跟着变。
     *
     * `update` 运行期也照样每帧被调到，只是在这儿立刻返回（运行期那次靠 `onLoad`）。
     */
    protected update(): void {
        if (!EDITOR) return;
        this.refit();
    }

    /** 按当前贴图重算一次。接线脚本换完图也调它 —— 不必等编辑器下一帧。 */
    refit(): void {
        const frame = this.source && this.source.spriteFrame;
        // ⚠️ 资产没拖进来时编辑器**不是给 null**，而是塞一个 2×2 的占位 SpriteFrame
        // （uuid 还是原来那个、资产不在 `assetManager` 里、名字为空）。拿它算比例会把框压成正方形
        // —— 实测过一次，671.45×840 当场变成 671.45×671.45。所以只认真加载过的资产。
        if (!frame || !frame.name || !assetManager.assets.has(frame.uuid)) return;
        const tex = frame.originalSize;
        if (!tex.width || !tex.height) return;

        const k = Math.min(this.maxWidth / tex.width, this.maxHeight / tex.height);
        const w = tex.width * k;
        const h = tex.height * k;
        this.writeSize(this.node, w, h);
        this.writeSize(this.source.node, w, h);
        this.writeSize(this.doneBg, w, h);
    }

    /** 只在不一样时才写 —— 每帧无条件写会一直把场景标脏。 */
    private writeSize(node: Node, w: number, h: number): void {
        if (!node) return;
        const ut = node.getComponent(UITransform);
        if (ut.width !== w || ut.height !== h) ut.setContentSize(w, h);
    }
}
