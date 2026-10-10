/**
 * 给 Slot_04（人物）配「两种状态」：
 *   - 前置槽位 = Slot_01（水管）+ Slot_02（马桶搋子）。这两个没先修好就修 Slot_04 → 展示
 *     `Repaired`（失败的人）并抛 `REPAIR_FAILED`；都修好了 → 展示 `Repaired-001`（成功的人）。
 *   - 碎片池用图显式钉成 `Repaired` 那张（失败的人）：池里的碎片跟着「未达标」那副样子走，
 *     `Repaired-001` 只在这一格达标时出场。
 *
 *   node tools/exec.mjs scene tools/js/mount-slot-alt.js
 *
 * 幂等：重复跑只是再赋一次同样的值。其余槽位一个字不碰。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const slot = layer.getChildByName('Slot_04').getComponent('PieceSlot');

slot.requires = [layer.getChildByName('Slot_01').getComponent('PieceSlot'), layer.getChildByName('Slot_02').getComponent('PieceSlot')];
slot.altView = layer.getChildByPath('Slot_04/Repaired-001').getComponent('RepairedSlot');
slot.poolSprite = layer.getChildByPath('Slot_04/Repaired').getComponent(cc.Sprite).spriteFrame;

return {
  slot: slot.node.name,
  requires: slot.requires.map((s) => s.node.name),
  altView: slot.altView ? slot.altView.node.name : null,
  altFrame: slot.altView && slot.altView.frame ? slot.altView.frame.name : null,
  poolSprite: slot.poolSprite ? slot.poolSprite.name : null,
  repairedSprite: slot.repairedSprite ? slot.repairedSprite.name : null,
  pieceFrame: slot.pieceFrame ? slot.pieceFrame.name : null,
  brokenActive: slot.brokenView.node.active,
  repairedActive: slot.repairedView.node.active,
  altActive: slot.altView.node.active,
};
