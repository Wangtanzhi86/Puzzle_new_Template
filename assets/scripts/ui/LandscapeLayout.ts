import { _decorator, Component, Layout, Node, ScrollView, UITransform, Vec3, Widget, view } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';

const { ccclass, property } = _decorator;

/** 竖屏那套原值，`onLoad` 先存下来，转回竖屏时原样还回去。 */
interface PortraitState {
    gamePos: Vec3; gameScale: Vec3;
    progPos: Vec3; progScale: Vec3;
    poolPos: Vec3; poolW: number; poolH: number;
    bgPos: Vec3; bgScale: Vec3; bgEuler: Vec3;
    svPos: Vec3; svW: number; svH: number; svWidget: boolean;
    viewPos: Vec3; viewW: number; viewH: number;
    contentPos: Vec3; contentW: number; contentH: number;
    ctaPos: Vec3; ctaWidget: boolean;
    type: number; spacingY: number;
    padL: number; padR: number; padT: number; padB: number;
    horizontal: boolean; vertical: boolean;
}

/**
 * 横屏两栏：拼图区 + 进度条等比放大后居中偏左，碎片池竖过来当右边那栏。
 *
 * 竖屏那套是「设计稿居中、三处一条边都不贴」，靠 Widget 撑，代码不碰它 —— 转回竖屏走 `restorePortrait()`
 * 把 `onLoad` 存的原值还回去，来回转屏不会越转越偏。横屏这套**只能写代码**：Widget 没有「横竖屏两套配置」
 * 这种表达方式，`Layout` 的排列方向和 `ScrollView` 的轴向更是只有代码能改。这是 §7.1「重排全交给 Widget」的
 * 唯一例外。
 *
 * 只改位置 / 旋转 / 缩放 / 尺寸，玩法逻辑一行不碰：缺口框、吸附半径、拿起倍率全部按世界坐标现算
 * （`PieceSlot.box()` / `PiecePool.carryScaleOf`），拼图区放大对吸附是透明的。碎片在池里仍是
 * 素材原始像素那么大（`PieceFactory` 那条上限也在），不跟着放大，拿起来才长到缺口尺寸 ——
 * 那本来就是 `carryScaleOf` 干的事。
 *
 * 还负责把碎片池 `Layout` 的交叉轴压平（`_isAlign`）：引擎只写主轴，另一条轴沿用子节点上一次的坐标，
 * 不压的话一转屏，竖屏那一行的 x 就被当成竖列的列坐标，四块连成一条斜线。这个勾**不能存场景**（它的
 * setter 不是 `@property`，赋值不会让编辑器认为场景改过、`save-scene` 返回 false），所以写在代码里。
 */
@ccclass('LandscapeLayout')
export class LandscapeLayout extends Component {
    @property({ type: Node, displayName: '拼图区（GameLayer）' }) gameLayer: Node = null;
    @property({ type: Node, displayName: '进度层' }) progressLayer: Node = null;
    @property({ type: Node, displayName: '碎片池层' }) poolLayer: Node = null;
    @property({ type: Node, displayName: '碎片池底图' }) poolBg: Node = null;
    @property({ type: ScrollView, displayName: '碎片池滚动视图' }) scrollView: ScrollView = null;
    @property({ type: Node, displayName: '游戏中的常驻按钮（GameCta）', tooltip: '横屏挪到左边空位的中点；竖屏归它的底部 Widget 管' }) cta: Node = null;

    @property({ displayName: '横屏放大倍率', tooltip: '拼图区与进度条一起等比放大；1.4 基本吃满屏幕高度' })
    scale = 1.4;

    @property({ displayName: '拼图区与进度条的间距（px）' })
    columnGap = 40;

    @property({ displayName: '两栏之间的间距（px）' })
    railGap = 100;

    @property({ displayName: '竖栏最大高度（px）', tooltip: '碎片装不下就改成上下滚动；压到 880 是为了不伸进右上角关闭按钮那个 200×200 的安全区' })
    maxRailHeight = 880;

    @property({ displayName: '横屏底图旋转（度）', tooltip: '碎片池底图是照横向条带画的，竖栏里要转过来' })
    poolBgRotate = 90;

    @property({ displayName: '横屏底图缩放系数', tooltip: '1 = 刚好等比盖住竖栏（不拉伸）；调大就往两边多伸出去一些' })
    poolBgScale = 1;

    private _portrait: PortraitState = null;
    private _landscape = false;

    protected onLoad(): void {
        const sv = this.scrollView;
        const layout = sv.content.getComponent(Layout);
        // 交叉轴必须压平：引擎的 Layout 只写主轴（HORIZONTAL 写 x、VERTICAL 写 y），另一条轴沿用子节点
        // 上一次的坐标（`layout.ts` 的 `fnPositionY` / `fnPositionX`，不勾对齐就是 `child.position`）。
        // 不压的话一转屏，竖屏那一行的 x 会被当成竖列的列坐标、四块连成一条斜线，切回来同理。
        // `_isAlign` 是一个字段、两种方向共读，但两个 setter 各自带类型守卫（不匹配就直接 return），
        // 所以只在「当前方向对应那一个」在生效时写。
        layout.alignHorizontal = true;
        const poolUt = this.poolLayer.getComponent(UITransform);
        const svUt = sv.node.getComponent(UITransform);
        this._portrait = {
            gamePos: this.gameLayer.position.clone(), gameScale: this.gameLayer.scale.clone(),
            progPos: this.progressLayer.position.clone(), progScale: this.progressLayer.scale.clone(),
            poolPos: this.poolLayer.position.clone(), poolW: poolUt.width, poolH: poolUt.height,
            bgPos: this.poolBg.position.clone(), bgScale: this.poolBg.scale.clone(), bgEuler: this.poolBg.eulerAngles.clone(),
            svPos: sv.node.position.clone(), svW: svUt.width, svH: svUt.height,
            svWidget: sv.node.getComponent(Widget).enabled,
            viewPos: sv.view.node.position.clone(), viewW: sv.view.width, viewH: sv.view.height,
            contentPos: sv.content.position.clone(),
            ctaPos: this.cta.position.clone(), ctaWidget: this.cta.getComponent(Widget).enabled,
            contentW: sv.content.getComponent(UITransform).width, contentH: sv.content.getComponent(UITransform).height,
            type: layout.type, spacingY: layout.spacingY,
            padL: layout.paddingLeft, padR: layout.paddingRight, padT: layout.paddingTop, padB: layout.paddingBottom,
            horizontal: sv.horizontal, vertical: sv.vertical,
        };
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        EventBus.on(GameEvent.POOL_BUILT, this.onPoolBuilt, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
        EventBus.off(GameEvent.POOL_BUILT, this.onPoolBuilt, this);
    }

    private onOrientation(portrait: boolean): void {
        if (portrait) {
            if (!this._landscape) return;   // 开局那次竖屏广播什么都不用做，别去动竖屏那套已经验过的状态
            this.restorePortrait();
            this._landscape = false;
        } else {
            this.toLandscape();
            this._landscape = true;
        }
    }

    /** 栏的尺寸得等碎片都长出来了才量得准，所以池子建好后再量一次（开局即横屏时第一次量到的是空池子）。 */
    private onPoolBuilt(): void {
        if (this._landscape) this.toLandscape();
    }

    private toLandscape(): void {
        const p = this._portrait;
        const sv = this.scrollView;
        const layout = sv.content.getComponent(Layout);

        // 碎片池：底部横向条带 → 右侧竖栏
        layout.type = Layout.Type.VERTICAL;
        layout.alignVertical = true;   // 这一向下把 x 压平（见 onLoad 那段）
        // 竖栏的间距沿用横排那个 —— 它是手配的（`content` 的 Layout 上那个 `spacingX`），所以**现读**，
        // 不从快照取。横排那个 `spacingX` 一个字不动（VERTICAL 不看它），
        // 转回竖屏时天然还是对的，`restorePortrait` 不用管。
        layout.spacingY = layout.spacingX;
        layout.paddingLeft = p.padL;
        layout.paddingRight = p.padR;
        layout.paddingTop = p.padL;      // 竖栏上下也留边，取左右那个值
        layout.paddingBottom = p.padL;
        sv.horizontal = false;
        sv.vertical = true;
        sv.node.getComponent(Widget).enabled = false;   // 竖屏那套边距是照 720×300 的条带配的，栏的尺寸下面自己算
        layout.updateLayout(true);

        // 栏高就是内容自己算出来的高（VERTICAL + CONTAINER：全部碎片高之和 + 间距 + 上下边距）。
        // 栏宽得自己来 —— `Layout._doLayout` 的 VERTICAL 分支只写 height，宽度留着不动；
        // 取最宽那块 + 左右边距，碎片按锚点居中排在栏里，不会被 Mask 裁掉。
        let widest = 0;
        sv.content.children.forEach((c) => {
            if (!c.activeInHierarchy) return;
            const cu = c.getComponent(UITransform);
            widest = Math.max(widest, cu.width * Math.abs(c.scale.x));
        });
        const contentUt = sv.content.getComponent(UITransform);
        const railW = widest + p.padL + p.padR;
        contentUt.setContentSize(railW, contentUt.height);
        const railH = Math.min(contentUt.height, this.maxRailHeight);
        sv.view.setContentSize(railW, railH);
        sv.node.getComponent(UITransform).setContentSize(railW, railH);
        this.poolLayer.getComponent(UITransform).setContentSize(railW, railH);

        // 裁剪框要跟竖栏严丝合缝：ScrollView 与 view 在竖屏各带了一点偏移（对齐底边用的），
        // 归零之后 `view` 上的 RECT Mask 正好就是栏的范围，碎片不会被多切掉一条
        //（`sv.view` 是 UITransform 不是节点，位置得走 `.node`）
        sv.view.node.setPosition(0, 0, 0);
        sv.node.setPosition(0, 0, 0);

        // 碎片池底图是照横向条带画的，竖栏里转 90° 再等比放大到盖住它。
        // 转 90° 后本地 x 轴指向世界 y，所以世界宽 = 本地高 × k、世界高 = 本地宽 × k
        //（池层自己 scale 恒为 1，本地尺寸就是世界尺寸）。
        const bgUt = this.poolBg.getComponent(UITransform);
        const bgK = Math.max(railW / bgUt.height, railH / bgUt.width) * this.poolBgScale;
        this.poolBg.setRotationFromEuler(0, 0, this.poolBgRotate);
        this.poolBg.setScale(bgK, bgK, 1);

        // 两栏整体居中：画布节点锚在中心，所以本地坐标 0 就是屏幕中心；栏在右、拼图列在左，横向按总宽对称分
        const gameUt = this.gameLayer.getComponent(UITransform);
        const progUt = this.progressLayer.getComponent(UITransform);
        const s = this.scale;
        const colW = Math.max(gameUt.width, progUt.width) * s;
        const colH = (gameUt.height + progUt.height) * s + this.columnGap;
        const totalW = colW + this.railGap + railW;
        const colX = (colW - totalW) / 2;

        this.gameLayer.setScale(s, s, 1);
        this.gameLayer.setPosition(colX, (colH - gameUt.height * s) / 2, 0);
        this.progressLayer.setScale(s, s, 1);
        this.progressLayer.setPosition(colX, (progUt.height * s - colH) / 2, 0);
        this.poolLayer.setPosition((totalW - railW) / 2, 0, 0);

        // 常驻按钮：挪到左边那块空位的中点。空位是「画布左沿 → 拼图列左沿（-totalW/2）」，
        // 半宽从 visibleSize 现读 —— 画布节点自己的 UITransform 要等下一次 Widget 重排才更新，
        // 此刻读到的还是竖屏那一版。竖屏那个底部 Widget 得先关掉，不然它会把 x 拽回 0。
        this.cta.getComponent(Widget).enabled = false;
        this.cta.setPosition(-(view.getVisibleSize().width * 0.5 + totalW * 0.5) * 0.5, 0, 0);

        // 内容比视区高时引擎会把内容贴底，这时要滚到顶；横向一律拽回中点 —— `PiecePool.scrollToStart` 那句
        // scrollToLeft 是给横向条带写的，在竖栏里会把内容推偏（在池子建好后跑的那一次会纠正回来）
        if (contentUt.height > railH) sv.scrollToTop();
        sv.content.setPosition(0, sv.content.position.y, 0);
    }

    private restorePortrait(): void {
        const p = this._portrait;
        const sv = this.scrollView;
        const svWidget = sv.node.getComponent(Widget);

        this.gameLayer.setPosition(p.gamePos.x, p.gamePos.y, p.gamePos.z);
        this.gameLayer.setScale(p.gameScale.x, p.gameScale.y, p.gameScale.z);
        this.progressLayer.setPosition(p.progPos.x, p.progPos.y, p.progPos.z);
        this.progressLayer.setScale(p.progScale.x, p.progScale.y, p.progScale.z);
        this.poolLayer.setPosition(p.poolPos.x, p.poolPos.y, p.poolPos.z);
        this.poolLayer.getComponent(UITransform).setContentSize(p.poolW, p.poolH);
        this.poolBg.setPosition(p.bgPos.x, p.bgPos.y, p.bgPos.z);
        this.poolBg.setRotationFromEuler(p.bgEuler.x, p.bgEuler.y, p.bgEuler.z);
        this.poolBg.setScale(p.bgScale.x, p.bgScale.y, p.bgScale.z);

        sv.horizontal = p.horizontal;
        sv.vertical = p.vertical;
        sv.view.setContentSize(p.viewW, p.viewH);
        sv.view.node.setPosition(p.viewPos.x, p.viewPos.y, p.viewPos.z);
        sv.node.getComponent(UITransform).setContentSize(p.svW, p.svH);
        sv.node.setPosition(p.svPos.x, p.svPos.y, p.svPos.z);
        svWidget.enabled = p.svWidget;

        const layout = sv.content.getComponent(Layout);
        layout.type = p.type;
        layout.alignHorizontal = true;   // 回到横排，把 y 压平（见 onLoad 那段）
        layout.spacingY = p.spacingY;
        layout.paddingLeft = p.padL;
        layout.paddingRight = p.padR;
        layout.paddingTop = p.padT;
        layout.paddingBottom = p.padB;
        // 内容另一条边的尺寸也还回去 —— Layout 每个方向只写一条边（HORIZONTAL 只写宽、VERTICAL 只写高），
        // 剩下那条会一直停在横屏算出来的值上（竖栏的高 720）
        sv.content.setPosition(p.contentPos.x, p.contentPos.y, p.contentPos.z);
        sv.content.getComponent(UITransform).setContentSize(p.contentW, p.contentH);
        layout.updateLayout(true);
        svWidget.updateAlignment();
        sv.scrollToLeft();

        // 常驻按钮交回底部 Widget（`enabled = true` 会把它标脏，下一次重排自己算回竖屏位置）
        this.cta.setPosition(p.ctaPos.x, p.ctaPos.y, p.ctaPos.z);
        const ctaWidget = this.cta.getComponent(Widget);
        ctaWidget.enabled = p.ctaWidget;
        if (ctaWidget.enabled) ctaWidget.updateAlignment();
    }
}
