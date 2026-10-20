import { _decorator, Node, Tween, Vec3, tween, v3 } from 'cc';
import { SlotAfterSnap } from './SlotAfterSnap';

const { ccclass, property } = _decorator;

/**
 * 行李架修好之后：把「修复完行李架」整棵放出来，子节点（4 → 3 → 2 → 1）一件一件从上方落下。
 * 上一件落到一半，下一件就开始落；旧「行李架」在第一件开始下落当刻藏起来，四件全落完再 done()。
 *
 * 挂在 Slot_01 上。子节点的目标位置就是编辑器里摆的位置，代码不写死坐标。
 */
@ccclass('LuggageDrop')
export class LuggageDrop extends SlotAfterSnap {
    @property({ type: Node, displayName: '放出来的根节点', tooltip: '它的每个子节点按兄弟顺序依次落下' })
    root: Node = null;

    @property({ type: Node, displayName: '开始下落时藏起来的节点', tooltip: '修好前的「行李架」；第一件开始下落当刻隐藏' })
    hideNode: Node = null;

    @property({ displayName: '从上方多高处落下（px）', tooltip: '每件都从「目标位置 + 这个高度」开始掉' })
    dropFrom = 160;

    @property({ displayName: '每件下落时长（秒）' })
    fallTime = 0.35;

    @property({ displayName: '下一件开始时机（占上一件时长）', tooltip: '0.5 = 上一件下落动画播到一半时，下一件开始' })
    nextAt = 0.5;

    @property({ displayName: '落地弹一下', tooltip: '勾上 = bounceOut；不勾 = quadOut' })
    bounce = true;

    private _targets: Vec3[] = [];

    protected onLoad(): void {
        if (!this.root) return;
        for (const child of this.root.children) {
            this._targets.push(child.position.clone());
            child.active = false;
        }
    }

    play(done: () => void): void {
        if (!this.root) { done(); return; }
        if (this.hideNode) this.hideNode.active = false;
        this.root.active = true;

        const kids = this.root.children;
        let i = 0;
        const next = (): void => {
            if (i >= kids.length) {
                done();
                return;
            }
            const node = kids[i];
            const target = this._targets[i] || node.position.clone();
            i++;
            Tween.stopAllByTarget(node);
            node.active = true;
            node.setPosition(target.x, target.y + this.dropFrom, target.z);
            const last = i >= kids.length;
            tween(node)
                .to(this.fallTime, { position: v3(target.x, target.y, target.z) }, { easing: this.bounce ? 'bounceOut' : 'quadOut' })
                .call(() => { if (last) done(); })
                .start();
            // 不能直接 scheduleOnce(next, ...)：调度器按 (callback,target) 复用条目，
            // 在 next 里再排 next 会被刚触发的旧条目吞掉，只落两件。
            if (!last) this.scheduleOnce(() => next(), this.fallTime * this.nextAt);
        };
        next();
    }
}
