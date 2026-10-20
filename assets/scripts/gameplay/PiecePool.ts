import { _decorator, Component, Enum, Layout, Node, ScrollView, Tween, UIOpacity, UITransform, Vec3, tween, v3 } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotData } from '../data/LevelTypes';
import { PieceFactory } from './PieceFactory';

const { ccclass, property } = _decorator;

export interface PieceEntry {
    piece: Node;
    slotIndex: number;
    /** 只在被拿起期间存在：顶住 Layout 的空位，放下或吸附后销毁 */
    spacer: Node | null;
}

/**
 * 把 Layout 排出来的内容沿它自己的主轴居中到父节点（`view`）的中线上。间距 / 边距填多少都不影响 ——
 * 是量子节点实际占的那一段量出来的，不是算出来的。
 *
 * 为什么挪一下 `content` 就够了：`view` 的局部原点就是裁剪窗的中心（锚点 0.5），而 Layout 的
 * CONTAINER 把 `content` 撑成恰好包住内容，所以内容的中点在 `content` 局部的 `mid` 处，
 * 把 `content` 的主轴坐标置成 `-mid` 就把它对到了窗口中心。
 *
 * 内容比窗口大时两头一起露在框外，由 `view` 上的 Mask 裁掉 —— 不走滚动。
 *
 * 对称边距下 `mid` 恰好是 0（Layout 自己就摆正了），这个函数存在的意义有两个：边距不对称时
 * 把它算回来，以及每次排完版把 `content` 自己被人挪偏的位置拉回来。
 *
 * ⚠️ 光有它还不够 —— `ScrollView` 有一条**它自己**的路会把 `content` 左贴边，见 `PiecePool.onLoad`。
 */
export function centerLayoutContent(content: Node): void {
    const layout = content.getComponent(Layout);
    if (!layout) return;
    const horizontal = layout.type === Layout.Type.HORIZONTAL;

    let min = Infinity;
    let max = -Infinity;
    const children = content.children;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child.activeInHierarchy) continue;
        const ut = child.getComponent(UITransform);
        if (!ut) continue;
        const size = (horizontal ? ut.width : ut.height) * Math.abs(horizontal ? child.scale.x : child.scale.y);
        const pos = horizontal ? child.position.x : child.position.y;
        const anchor = horizontal ? ut.anchorX : ut.anchorY;
        min = Math.min(min, pos - anchor * size);
        max = Math.max(max, pos + (1 - anchor) * size);
    }
    if (min > max) return;   // 一块都没有，别去动空池子的位置

    const mid = (min + max) / 2;
    const p = content.position;
    content.setPosition(horizontal ? -mid : p.x, horizontal ? p.y : -mid, p.z);
}

/** 池子的两种形态，Inspector 里下拉选。 */
export enum PoolMode {
    /** 一次只摆 `batchSize` 块，整行居中、装不下就两头裁掉，不能滑 —— 原来的行为 */
    BATCH = 0,
    /** 整关的碎片一次全摆出来，可以沿 Layout 主轴滑着看 */
    SCROLL = 1,
}

/**
 * 碎片池。碎片平时活在 content 的 Layout 里，被拿起时挪到 dragRoot，
 * 原位留一个同样大小的 Spacer 顶住 —— 不然 Layout 会立刻重排，
 * 剩下的碎片会当着玩家的面跳一下。
 */
@ccclass('PiecePool')
export class PiecePool extends Component {
    @property({ type: Node, displayName: '池内容节点（Layout 所在）' }) content: Node = null;
    @property({ type: Node, displayName: '拖拽层' }) dragRoot: Node = null;
    @property({ type: PieceFactory, displayName: '碎片工厂' }) factory: PieceFactory = null;
    @property({ type: ScrollView, displayName: '横向滚动视图' }) scrollView: ScrollView = null;

    @property({ type: Enum(PoolMode), displayName: '池子模式', tooltip: 'BATCH = 每屏只摆 batchSize 块、居中、不能滑；SCROLL = 整关一次全摆出来、可以滑（横屏竖栏时改用竖向）' })
    poolMode = PoolMode.BATCH;

    @property({ displayName: '每屏碎片数', tooltip: '池里一次只摆这么多块；这一批全部用掉才补下一批。填 0 表示整关一次全摆出来' })
    batchSize = 3;

    @property({ displayName: '弹回原位时长（秒）' })
    returnTime = 0.25;

    @property({ displayName: '自动补位', tooltip: '关掉后一块碎片被用掉时空位就留在那儿，后面的碎片不往前补、待在原地。这一屏用光、补下一屏时空位才收掉' })
    reflow = true;

    @property({ displayName: '补位滑动时长（秒）', tooltip: '一块碎片被用掉后，后面的碎片往前补位的时长；0 就是直接跳过去。关掉上面那个开关时不起作用' })
    reflowTime = 0.3;

    @property({ displayName: '换批淡入时长（秒）', tooltip: '下一批补上来时每块碎片的淡入时长；0 就是直接出现' })
    batchFadeTime = 0.25;

    @property({ displayName: '失败插入（推开邻居）', tooltip: '拖着走了一圈却没吸附、松手：按碎片当前横向位置插回最近的那个位置，右边那些碎片顺势推开让位。关掉 = 老行为，碎片横穿整个托盘飞回自己原来的空位' })
    insertOnFail = true;

    @property({ displayName: '插入滑动时长（秒）', tooltip: '插回去时，这块碎片和让位的碎片一起滑动的时长' })
    insertTime = 0.14;

    private _entries: PieceEntry[] = [];
    /** 已经用掉、位置却还留在池里的碎片（关掉「自动补位」时）。它们的 `spacer` 就是那个空位 */
    private _gaps: PieceEntry[] = [];
    private _data: SlotData[] = [];
    /** `_data` 里下一块该摆出来的碎片的下标。一批一批往前推，摆完就是收摊 */
    private _next = 0;

    protected onLoad(): void {
        if (!this.scrollView) return;
        if (this.scrollMode) {
            // 滑动模式：content 的主轴位置归 ScrollView 管；轴向往哪边走按 Layout 主轴现定（横屏那栏是竖排）
            this.applyScrollAxis();
            // `cancelInnerEvents` 默认开着 —— 位移超过 7px 它就给 content 派发模拟 TOUCH_CANCEL，
            // 往缺口方向拖碎片会被它当场掐断。滑不滑由 `DragController` 先做方向仲裁，这里让它别插手。
            this.scrollView.cancelInnerEvents = false;
            return;
        }
        // 关掉横轴滚动。这是「居中」能站住的前提，不是顺手加的：
        // `ScrollView` 动 `content` 的 x 只有一条路 —— `_calculateBoundary()` 末尾的
        // `_moveContentToTopLeft()`，内容比裁剪窗窄时它把 `content` **左贴边**（实测 583.893 的窗、
        // 347.62 的内容 → `content.x = -(583.893 - 347.62)/2 = -118.14`）。而那个位移要经
        // `_moveContent()` → `_flattenVectorByDirection()` 才落地，`horizontal` 关着时它会把 x 清成 0。
        // 另一条 `_adjustContentOutOfBoundary()` 不用管：它的位移经 `_clampDelta()`，同样条件下 x 也是 0。
        // 时机也赶得上 —— 只有 `onLoad` 排在 `ScrollView.start()` 前面，而 `start()` 里那句
        // `_calculateBoundary()` 正是开场把居中推掉的那一次。
        // 于是 `content` 的横轴位置只剩 `centerLayoutContent()` 一个来源，转屏 / 换批都不会被推走。
        // 代价是行比裁剪窗宽时不能划着看 —— 那正是「永远居中、两头被裁」要的。
        this.scrollView.horizontal = false;
    }

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.on(GameEvent.GAME_OVER, this.lockScroll, this);
        // 系统接管之后池子只出不进，玩家也不该再能碰它
        EventBus.on(GameEvent.AUTO_PLAY, this.lockScroll, this);
        EventBus.on(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
        EventBus.off(GameEvent.GAME_OVER, this.lockScroll, this);
        EventBus.off(GameEvent.AUTO_PLAY, this.lockScroll, this);
        EventBus.off(GameEvent.ORIENTATION_CHANGED, this.onOrientation, this);
    }

    get count(): number {
        return this._entries.length;
    }

    get entries(): PieceEntry[] {
        return this._entries;
    }

    get scrollMode(): boolean {
        return this.poolMode === PoolMode.SCROLL;
    }

    /** 滑动方向是不是横轴 —— 就看 Layout 主轴：横排的池子横向滑，横屏那根竖栏纵向滑。
     *  `DragController` 拿它判「这一下是在滚池子还是在拿碎片」。 */
    get scrollAlongX(): boolean {
        const layout = this.content ? this.content.getComponent(Layout) : null;
        return layout ? layout.type !== Layout.Type.VERTICAL : true;
    }

    /** 排完版把内容摆回起点：BATCH 居中，SCROLL 回到主轴的最左 / 最上。
     *  位置交给 ScrollView 自己算（它知道边界和轴向）；换轴时另一条轴归零 ——
     *  `_moveContent` 只按方向裁增量，不会把上一次滑动留下的坐标清掉。 */
    alignContent(): void {
        const layout = this.content.getComponent(Layout);
        if (!this.scrollMode) {
            centerLayoutContent(this.content);
            return;
        }
        const sv = this.scrollView;
        if (!sv) return;
        // 先把滑动轴摆正：转屏时 `LandscapeLayout` 会先改 Layout 主轴、同步叫到这里，
        // 而横轴还停在转屏前那一档 —— 不拨正，`scrollToLeft` 的位移会被 `_flattenVectorByDirection` 清掉
        this.applyScrollAxis();
        const vertical = layout ? layout.type === Layout.Type.VERTICAL : false;
        const p = this.content.position;
        if (vertical) this.content.setPosition(0, p.y, p.z);
        else this.content.setPosition(p.x, 0, p.z);
        if (vertical) sv.scrollToTop(0);
        else sv.scrollToLeft(0);
    }

    /** 按 Layout 的主轴把 ScrollView 的滑动方向调到同一条轴上。横屏那栏是竖排，只认横轴会斜着滚。 */
    private applyScrollAxis(): void {
        if (!this.scrollMode || !this.scrollView) return;
        const layout = this.content ? this.content.getComponent(Layout) : null;
        const vertical = layout ? layout.type === Layout.Type.VERTICAL : false;
        this.scrollView.horizontal = !vertical;
        this.scrollView.vertical = vertical;
    }

    /** 转屏那一下 Layout 的主轴刚被 `LandscapeLayout` 改掉，等这一帧排完版再定轴、回到起点。 */
    private onOrientation(): void {
        this.scheduleOnce(() => {
            this.applyScrollAxis();
            this.alignContent();
        }, 0);
    }

    private onLevelBuilt(data: SlotData[]): void {
        this.clear();
        this._data = data;
        this._next = 0;
        this.buildBatch(false);
        // 抛出去的是 `_entries` 本身：碎片被用掉时它自己会 splice，引导那边不用重新订阅
        EventBus.emit(GameEvent.POOL_BUILT, this._entries);
    }

    /** 摆一屏碎片。开场摆第一屏（不淡入），用光之后由 `consumeAll` / `buildMore` 补下一屏（淡入）。
     *  摆不满一屏（剩下的不到 `batchSize`）就摆多少算多少。 */
    private buildBatch(animate: boolean): void {
        // 滑动模式没有「一屏」的概念：一开始就把整关摆出来，装得下装不下都交给 ScrollView
        const size = this.scrollMode ? this._data.length : this.batchSize > 0 ? this.batchSize : this._data.length;
        let placed = 0;
        // 预填的槽位不进池子，跳过它继续往后面取，保证这一屏该摆几块就是几块
        while (this._next < this._data.length && placed < size) {
            const i = this._next++;
            if (this._data[i].slot.prefilled) continue;
            placed++;
            const piece = this.factory.create(this._data[i].slot, this.content);
            this._entries.push({ piece, slotIndex: i, spacer: null });
            if (animate && this.batchFadeTime > 0) {
                const op = piece.getComponent(UIOpacity);
                // 上一批的淡入可能还没跑完（「一次飞几批」时一批用掉得比 `batchFadeTime` 还快，
                // 而新一批拿到的正是刚还回去的那些节点）—— 不掐掉它，两条 tween 会一起写 opacity，
                // 新的一块会直接亮着出现
                Tween.stopAllByTarget(op);
                op.opacity = 0;
                tween(op).to(this.batchFadeTime, { opacity: 255 }, { easing: 'quadOut' }).start();
            }
        }
        // 排完再落位 —— 每次 `updateLayout` 之后都要来一下，间距/宽窄变了行宽就变了
        this.content.getComponent(Layout).updateLayout(true);
        this.alignContent();
    }

    entryOf(piece: Node): PieceEntry {
        for (let i = 0; i < this._entries.length; i++) {
            if (this._entries[i].piece === piece) return this._entries[i];
        }
        return null;
    }

    /** 拿在手上时要放大到「修复后那张图」那么大，不然吸附的一瞬间会「啪」地变一下尺寸。
     *  两边都换成世界尺度：槽位那边是 `carryHeight`（修复图自己的世界高，含它自己的缩放），
     *  碎片这边把本地高度乘上 worldScale（碎片自己在 create / settle 里都置 1，所以 worldScale
     *  就是祖先链的缩放）。比值乘回碎片的本地尺寸，屏幕上的大小才正好等于修复后的图。
     *  别用 `getBoundingBoxToWorld()` 量碎片 —— 亮边那个子节点活着的时候会被并进来。 */
    carryScaleOf(entry: PieceEntry): number {
        const slot = this._data[entry.slotIndex].slot;
        const piece = entry.piece;
        return slot.carryHeight / (piece.getComponent(UITransform).height * piece.worldScale.y);
    }

    takeOut(entry: PieceEntry): void {
        // 正在补位滑动的碎片被拿起来时要先停下，否则那条 tween 会一直把位置拽回池里
        Tween.stopAllByTarget(entry.piece);
        const size = entry.piece.getComponent(UITransform);
        const spacer = new Node('Spacer');
        spacer.addComponent(UITransform).setContentSize(size.width, size.height);
        spacer.setParent(this.content);
        spacer.setSiblingIndex(entry.piece.getSiblingIndex());
        entry.piece.setParent(this.dragRoot);
        entry.spacer = spacer;
    }

    /** 放回原位。immediate 用于转屏这类不该有动画的场合 */
    sendHome(entry: PieceEntry, immediate: boolean): void {
        const target: Vec3 = entry.spacer.getWorldPosition();
        if (immediate) {
            this.settle(entry, target);
            return;
        }
        tween(entry.piece)
            .to(this.returnTime, { worldPosition: target, scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .call(() => this.settle(entry, target))
            .start();
    }

    /** 松手没吸附：按碎片**当前的横向位置**插回最近的那个位置，右边的碎片顺势推开让位。
     *
     *  「最近的那个位置」不是按碎片原先的槽位算，而是按屏幕上它停在哪儿算 —— 玩家的心理预期是
     *  「我把它丢在这儿，它就留在这儿」。横轴比较的是各空位（spacer）的世界 x，因为拿起来的碎片
     *  已经不在 `content` 里，Layout 不排它；它自己由这条 tween 落到新位置。
     *
     *  和 `consumeAll` 一样：先记旧世界位置再排版再 tween 回去。`updateLayout(true)` 是瞬移，
     *  而 `content` 那次重新居中也在同一次调用里落定，本地位移和屏幕位移对不上，所以只能用世界位置。
     */
    insertNearest(entry: PieceEntry): void {
        const spacer = entry.spacer;
        const layout = this.content.getComponent(Layout);
        if (!spacer || !layout) {
            // 没有空位可插（理论上不该发生）：退回老行为
            this.sendHome(entry, false);
            return;
        }

        // 目标下标 = 横轴上比碎片中心更靠左的子节点数。`content` 里此刻是「其余碎片的节点」
        // 和「被拿走的那些碎片的 spacer」，两者都占着一个位置，所以一起数。
        const px = entry.piece.worldPosition.x;
        let index = 0;
        const children = this.content.children;
        for (let i = 0; i < children.length; i++) {
            const c = children[i];
            if (c === spacer) continue;
            if (c.worldPosition.x < px) index++;
        }

        // 让位前的世界位置：等会儿排版把它们瞬移了，再照着这些位置拉回来滑过去
        const movers: Array<{ node: Node; from: Vec3 }> = [];
        for (let i = 0; i < this._entries.length; i++) {
            const e = this._entries[i];
            if (e === entry || e.piece.parent !== this.content) continue;
            movers.push({ node: e.piece, from: e.piece.worldPosition.clone() });
        }

        spacer.setSiblingIndex(index);
        layout.updateLayout(true);
        // 落位排在读目标位置前面：下面读的是现读的世界坐标。滑动模式下不挪 content —— 那会把玩家滑到的位置拽回去
        if (!this.scrollMode) centerLayoutContent(this.content);

        const target: Vec3 = spacer.getWorldPosition();
        const time = this.insertTime;

        if (time <= 0) {
            // 0 = 直接跳过去（没有动画时别留一条 0 时长 tween 去跟别人抢同一帧）
            for (let i = 0; i < movers.length; i++) movers[i].node.setWorldPosition(movers[i].from);
            this.settle(entry, target);
            return;
        }

        for (let i = 0; i < movers.length; i++) {
            const node = movers[i].node;
            const to: Vec3 = node.worldPosition.clone();
            Tween.stopAllByTarget(node);
            node.setWorldPosition(movers[i].from);
            tween(node).to(time, { worldPosition: to }, { easing: 'quadOut' }).start();
        }

        Tween.stopAllByTarget(entry.piece);
        tween(entry.piece)
            .to(time, { worldPosition: target, scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .call(() => this.settle(entry, target))
            .start();
    }

    /** 单片那条路（玩家自己吸附成功）。实现在 `consumeAll` 里。 */
    consume(entry: PieceEntry): void {
        this.consumeAll([entry]);
    }

    /** 用掉一批碎片（自动打关整屏一起放）—— 单片和整屏共用这一份实现。
     *
     *  用掉的碎片就没了 —— 缺口自己会把修好的图显示出来。
     *  `updateLayout(true)` 那一下是瞬移，而且 content 尺寸变化引起的 ScrollView 边界重算
     *  也在同一次调用里同步落定（`SIZE_CHANGED` → `_calculateBoundary`），所以先记下旧的世界位置，
     *  排完之后再把碎片放回去、让他们照着 tween 滑过去。用世界位置而不是本地位置：
     *  这一下 content 自己也会挪（重新居中），本地位移和屏幕上的位移对不上。
     *
     *  关掉「自动补位」时走另一条路：**把顶位节点留在原地**。它在 Layout 眼里就是刚被用掉那块，
     *  子节点一个没少，排不出任何变化 —— 剩下的碎片待在原地不动，用掉的位置空在那儿。
     *  （不是「把补位时长调成 0」：那样位置还是会重排，只是瞬移。）
     *
     *  ⚠️ **一批必须一次调完，别拆成 N 次 `consume`**：下面那个补位循环起手就
     *  `Tween.stopAllByTarget(node)`，而它拉的是「还在 `_entries` 里的碎片」——
     *  半空中的碎片也在里面（`takeOut` 只换节点父级，entry 还留着）。拆开调的话，
     *  后一块的飞行 tween 会被前一块引起的补位掐掉，它就永远落不了地，链条卡死。
     *  一起调还顺带只排一次版、只滑一次位。 */
    consumeAll(entries: PieceEntry[]): void {
        const rest = this._entries.filter((e) => entries.indexOf(e) < 0);
        const from = this.reflow ? rest.map((e) => e.piece.worldPosition.clone()) : [];

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (this.reflow) this.dropSpacer(entry);
            else this._gaps.push(entry);
            this.factory.recycle(entry.piece);
        }
        for (let i = 0; i < entries.length; i++) {
            const k = this._entries.indexOf(entries[i]);
            if (k >= 0) this._entries.splice(k, 1);
        }

        const layout = this.content.getComponent(Layout);
        if (layout) {
            layout.updateLayout(true);
            // 居中要排在读 `to` 前面：下面补位 tween 的目标是现读的世界坐标，先挪了才读得准。
            // 滑动模式下不挪 content —— 那会把玩家滑到的位置拽回去
            if (!this.scrollMode) centerLayoutContent(this.content);

            for (let k = 0; k < from.length; k++) {
                const node = rest[k].piece;
                const to = node.worldPosition.clone();
                Tween.stopAllByTarget(node);
                node.setWorldPosition(from[k]);
                tween(node).to(this.reflowTime, { worldPosition: to }, { easing: 'backOut' }).start();
            }
        }

        // 这一屏用光了：补上下一屏
        if (this._entries.length === 0) this.buildMore();
    }

    /** 摆出下一屏。池子平时一次只摆一屏（多摆的两头会露到裁剪窗外被裁掉），
     *  自动打关要「一次飞几批」时由 `AutoPlayer` 连着叫几次把它一次摆够。
     *
     *  重抛一次 `POOL_BUILT` 是因为横屏那栏的宽度是照池子内容量的（`LandscapeLayout.onPoolBuilt`），
     *  换了一批就可能换了最宽的那块。 */
    buildMore(): void {
        if (this._next >= this._data.length) return;
        // 上一屏的空位该收了，不然新一屏会排在它们右边、滚出可视区
        this.clearGaps();
        this.buildBatch(true);
        EventBus.emit(GameEvent.POOL_BUILT, this._entries);
    }

    returnAll(): void {
        for (let i = 0; i < this._entries.length; i++) {
            if (this._entries[i].spacer) this.sendHome(this._entries[i], true);
        }
    }

    lockScroll(): void {
        if (this.scrollView) this.scrollView.enabled = false;
    }

    unlockScroll(): void {
        if (this.scrollView) this.scrollView.enabled = true;
    }

    private settle(entry: PieceEntry, target: Vec3): void {
        const index = entry.spacer.getSiblingIndex();
        this.dropSpacer(entry);
        entry.piece.setParent(this.content);
        entry.piece.setSiblingIndex(index);
        entry.piece.setWorldPosition(target);
        entry.piece.setScale(1, 1, 1);
    }

    private dropSpacer(entry: PieceEntry): void {
        if (!entry.spacer) return;
        entry.spacer.removeFromParent();
        entry.spacer.destroy();
        entry.spacer = null;
    }

    private clearGaps(): void {
        for (let i = 0; i < this._gaps.length; i++) this.dropSpacer(this._gaps[i]);
        this._gaps.length = 0;
    }

    private clear(): void {
        this.clearGaps();
        for (let i = 0; i < this._entries.length; i++) {
            this.dropSpacer(this._entries[i]);
            this.factory.recycle(this._entries[i].piece);
        }
        this._entries.length = 0;
    }
}
