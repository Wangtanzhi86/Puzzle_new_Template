import { _decorator, Node, Sprite, Tween, tween, UIOpacity } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../core/GameEvent';
import { SlotAfterSnap } from './SlotAfterSnap';

const { ccclass, property } = _decorator;

/**
 * 胶带修好之后：放出「胶带」根节点，子节点按兄弟顺序一条一条擦出来。
 * 第一条从左到右、第二条从右到左、第三条再从左到右（默认隔一条反向）。
 *
 * 擦出用 Sprite 的 FILLED + HORIZONTAL：fillStart = 0 从左边长，fillStart = 1
 * 配负的 fillRange 从右边往回长（同 GroundWater 那条竖向的写法）。
 *
 * 全部擦完后胶带保持显示；配了 `revealNode` 时把该节点从透明淡入（Slot_03 用来接「修复窗户」）。
 *
 * 每条子节点开始擦出时抛一次 `TAPE_STRIP` —— 音频配置里那条「撕胶带」就是听它。
 *
 * 挂在 Slot_03 上。
 */
@ccclass('TapeWipe')
export class TapeWipe extends SlotAfterSnap {
    @property({ type: Node, displayName: '胶带根节点', tooltip: '它的每个子节点按兄弟顺序依次擦出' })
    root: Node = null;

    @property({ displayName: '每条擦出时长（秒）' })
    wipeTime = 0.5;

    @property({ displayName: '擦完停顿（秒）' })
    gap = 0.08;

    @property({ displayName: '隔一条反向', tooltip: '勾上 = 第 1 条左到右、第 2 条右到左、第 3 条左到右；不勾 = 全部左到右' })
    alternate = true;

    @property({ type: Node, displayName: '擦完淡入的节点', tooltip: '胶带全部擦完后，把这个节点从透明平滑淡入（会补 UIOpacity）；胶带保持显示；留空就不做淡入' })
    revealNode: Node = null;

    @property({ displayName: '淡入时长（秒）', tooltip: '「擦完淡入的节点」从 0 到不透明的时长；填 0 = 当刻显示' })
    revealFade = 0.3;

    private _sprites: (Sprite | null)[] = [];

    protected onLoad(): void {
        if (!this.root) return;
        for (const child of this.root.children) {
            const sprite = child.getComponent(Sprite);
            if (sprite) {
                if (sprite.spriteFrame) sprite.spriteFrame.packable = false;
                sprite.type = Sprite.Type.FILLED;
                sprite.fillType = Sprite.FillType.HORIZONTAL;
                sprite.fillRange = 0;
            }
            this._sprites.push(sprite);
            child.active = false;
        }
    }

    play(done: () => void): void {
        if (!this.root) { done(); return; }
        this.root.active = true;

        const kids = this.root.children;
        let i = 0;
        const next = (): void => {
            if (i >= kids.length) {
                this.fadeInTarget();
                done();
                return;
            }
            const node = kids[i];
            const sprite = this._sprites[i];
            const back = this.alternate && i % 2 === 1;
            i++;
            if (!sprite) { this.scheduleOnce(next, this.gap); return; }
            EventBus.emit(GameEvent.TAPE_STRIP);
            Tween.stopAllByTarget(sprite);
            node.active = true;
            sprite.fillStart = back ? 1 : 0;
            sprite.fillRange = 0;
            tween(sprite)
                .to(this.wipeTime, { fillRange: back ? -1 : 1 }, { easing: 'quadOut' })
                .call(() => this.scheduleOnce(next, this.gap))
                .start();
        };
        next();
    }

    /** 胶带全擦完后：胶带保持显示，把目标节点淡入（初始可以是不激活的，这里负责激活并补 UIOpacity） */
    private fadeInTarget(): void {
        if (!this.revealNode) return;
        let opacity = this.revealNode.getComponent(UIOpacity);
        if (!opacity) opacity = this.revealNode.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        this.revealNode.active = true;
        if (this.revealFade > 0) {
            tween(opacity).to(this.revealFade, { opacity: 255 }, { easing: 'quadOut' }).start();
            return;
        }
        opacity.opacity = 255;
    }
}
