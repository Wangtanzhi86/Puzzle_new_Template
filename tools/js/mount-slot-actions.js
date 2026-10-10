/**
 * 两格收尾动作的接线：
 *   - Slot_02（马桶搋子）挂 FlushAction，water = Scene_BG/马桶隐藏节点/脏水
 *   - Slot_03（扫把）挂 BroomSweep，items = Scene_BG/扫把隐藏节点
 *   - 两个组件回填到 PieceSlot.flushAction / sweepAction
 *   - 清掉这两格半配的 swapHide（`swapAfterSweep()` 要 swapHide + swapShow 都填才生效，
 *     这里 swapShow 一直是空的 —— 那两个节点引用改由上面的组件自己承担，留着只会让
 *     verify-scene 的 checkSwap 一直报「没配齐」）
 *   - 淡出要用 UIOpacity：脏水、两格的修复图、扫把那组三个子物品，缺一个就是取到 null 直接抛
 *
 *   node tools/exec.mjs scene tools/js/mount-slot-actions.js
 *
 * 幂等：组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const water = canvas.getChildByPath('GameLayer/Scene_BG/马桶隐藏节点/脏水');
const sweepItems = canvas.getChildByPath('GameLayer/Scene_BG/扫把隐藏节点');

const slot2 = layer.getChildByName('Slot_02');
const slot3 = layer.getChildByName('Slot_03');
const slot2Repaired = slot2.getChildByName('Repaired');
const slot3Repaired = slot3.getChildByName('Repaired');

const faded = [];
for (const n of [water, slot2Repaired, slot3Repaired, ...sweepItems.children]) {
  if (!n.getComponent(cc.UIOpacity)) n.addComponent(cc.UIOpacity);
  faded.push(n.name);
}

let flush = slot2.getComponent('FlushAction');
if (!flush) flush = slot2.addComponent('FlushAction');
flush.water = water;

let sweep = slot3.getComponent('BroomSweep');
if (!sweep) sweep = slot3.addComponent('BroomSweep');
sweep.items = sweepItems;

const p2 = slot2.getComponent('PieceSlot');
p2.flushAction = flush;
p2.swapHide = null;

const p3 = slot3.getComponent('PieceSlot');
p3.sweepAction = sweep;
p3.swapHide = null;

return {
  flush: { slot: 'Slot_02', water: flush.water.name, moveTo: [flush.moveTo.x, flush.moveTo.y], rotateTo: flush.rotateTo },
  sweep: { slot: 'Slot_03', items: sweep.items.name, children: sweep.items.children.map((n) => n.name) },
  faded,
  swapHideCleared: [!p2.swapHide, !p3.swapHide],
};
