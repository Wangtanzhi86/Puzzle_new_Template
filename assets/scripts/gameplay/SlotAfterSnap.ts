import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 槽位吸附之后的「整段表现」基类：挂在 Slot_XX 上，PieceSlot.repair() 发现它就直接让位。
 *
 * 两个时机：
 *  - 不勾「等本格揭晓演完再开始」：吸附当场把这一格的破损图 / 修复图收掉，再播下面的表现，
 *    播完才抛 PIECE_SHOWN（露面的那一拍）。
 *  - 勾上：先走这一格原本的揭晓，露完面再播，播完才抛 PIECE_SHOWN。
 *
 * 具体演什么由子类决定（落下 / 打开节点 / 胶带擦出 / 姿势交叉淡入）。
 */
@ccclass('SlotAfterSnap')
export class SlotAfterSnap extends Component {
    @property({ displayName: '等本格揭晓演完再开始', tooltip: '不勾 = 吸附当场收掉这一格的破损图 / 修复图并直接开演；勾上 = 先走这一格原有的揭晓，露面之后再开演' })
    afterShown = false;

    @property({ displayName: '延迟（秒）', tooltip: '收图 / 揭晓之后隔这么久再开演' })
    delay = 0;

    /** 子类覆盖。演完必须调 done()，否则 PIECE_SHOWN 不会抛、关卡计数与收尾都会卡住 */
    play(done: () => void): void {
        done();
    }
}
