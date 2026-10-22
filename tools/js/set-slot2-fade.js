/**
 * 槽位 2（Slot_02）吸附后物品渐隐：只勾 hideOnRepair，不配换节点 ——
 * 破损图 / 修复图一起轻微放大淡出，淡完再抛 PIECE_SHOWN。
 *
 *   node tools/exec.mjs scene tools/js/set-slot2-fade.js
 *
 * 幂等：重复跑只把 hideOnRepair 置 true，时长保持 Inspector 里的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const slot = canvas.getChildByPath('GameLayer/BrokenLayer/Slot_02');
if (!slot) throw new Error('找不到 GameLayer/BrokenLayer/Slot_02');
const piece = slot.getComponent('PieceSlot');
if (!piece) throw new Error('Slot_02 上没有 PieceSlot');
piece.hideOnRepair = true;
return {
    slot: slot.name,
    hideOnRepair: piece.hideOnRepair,
    swapFadeTime: piece.swapFadeTime,
    swapDelay: piece.swapDelay,
    swapHide: piece.swapHide ? piece.swapHide.name : null,
    swapShow: piece.swapShow ? piece.swapShow.name : null,
};
