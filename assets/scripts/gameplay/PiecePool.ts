import { _decorator, Component, Layout, Node, ScrollView, Tween, UITransform, Vec3, tween, v3 } from 'cc';
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

    @property({ displayName: '弹回原位时长（秒）' })
    returnTime = 0.25;

    @property({ displayName: '补位滑动时长（秒）', tooltip: '一块碎片被用掉后，后面的碎片往前补位的时长；0 就是直接跳过去' })
    reflowTime = 0.3;

    private _entries: PieceEntry[] = [];
    private _data: SlotData[] = [];

    protected onEnable(): void {
        EventBus.on(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
    }

    protected onDisable(): void {
        EventBus.off(GameEvent.LEVEL_BUILT, this.onLevelBuilt, this);
    }

    get count(): number {
        return this._entries.length;
    }

    get entries(): PieceEntry[] {
        return this._entries;
    }

    private onLevelBuilt(data: SlotData[]): void {
        this.clear();
        this._data = data;
        for (let i = 0; i < data.length; i++) {
            const piece = this.factory.create(data[i].slot.pieceFrame, this.content);
            this._entries.push({ piece, slotIndex: i, spacer: null });
        }
        this.scrollToStart();
        // 抛出去的是 `_entries` 本身：碎片被用掉时它自己会 splice，引导那边不用重新订阅
        EventBus.emit(GameEvent.POOL_BUILT, this._entries);
    }

    /** 一行碎片比视区宽时引擎会把内容贴右（`_adjustContentOutOfBoundary`），一进来先看到的是行尾，
     *  第一块被挡在框外。这里显式跳到最左：从第一块看起，后面的碎片被用掉后自然补上来。 */
    private scrollToStart(): void {
        if (this.scrollView) this.scrollView.scrollToLeft();
    }

    entryOf(piece: Node): PieceEntry {
        for (let i = 0; i < this._entries.length; i++) {
            if (this._entries[i].piece === piece) return this._entries[i];
        }
        return null;
    }

    /** 拿在手上时要放大到缺口那么大，不然放上去会「啪」地变一下尺寸。
     *  两边都换成世界尺度：缺口那边含它自己的缩放，碎片这边把本地高度乘上 worldScale
     *  （碎片自己在 create / settle 里都置 1，所以 worldScale 就是祖先链的缩放）。
     *  比值乘回碎片的本地尺寸，屏幕上的大小才正好等于缺口。
     *  别用 `getBoundingBoxToWorld()` 量碎片 —— 亮边那个子节点活着的时候会被并进来。 */
    carryScaleOf(entry: PieceEntry): number {
        const slot = this._data[entry.slotIndex].slot;
        const piece = entry.piece;
        return slot.height / (piece.getComponent(UITransform).height * piece.worldScale.y);
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

    /** 吸附成功后这块碎片就没了 —— 缺口自己会把修好的图显示出来。
     *  `updateLayout(true)` 那一下是瞬移，而且 content 尺寸变化引起的 ScrollView 边界重算
     *  也在同一次调用里同步落定（`SIZE_CHANGED` → `_calculateBoundary`），所以先记下旧的世界位置，
     *  排完之后再把碎片放回去、让他们照着 tween 滑过去。用世界位置而不是本地位置：
     *  这一下 content 自己也会挪（左贴边），本地位移和屏幕上的位移对不上。 */
    consume(entry: PieceEntry): void {
        const rest = this._entries.filter((e) => e !== entry);
        const from = rest.map((e) => e.piece.worldPosition.clone());

        this.dropSpacer(entry);
        this.factory.recycle(entry.piece);
        const i = this._entries.indexOf(entry);
        if (i >= 0) this._entries.splice(i, 1);

        const layout = this.content.getComponent(Layout);
        if (!layout) return;
        layout.updateLayout(true);

        for (let k = 0; k < rest.length; k++) {
            const node = rest[k].piece;
            const to = node.worldPosition.clone();
            Tween.stopAllByTarget(node);
            node.setWorldPosition(from[k]);
            tween(node).to(this.reflowTime, { worldPosition: to }, { easing: 'backOut' }).start();
        }
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

    private clear(): void {
        for (let i = 0; i < this._entries.length; i++) {
            this.dropSpacer(this._entries[i]);
            this.factory.recycle(this._entries[i].piece);
        }
        this._entries.length = 0;
    }
}
