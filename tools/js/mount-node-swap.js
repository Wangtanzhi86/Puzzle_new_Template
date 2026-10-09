/**
 * 给 Slot_03（毛衣）配上「换掉」那两个节点：这一格修好之后
 * （走了修复揭晓就是序列帧播完那一下，没走揭晓就是 swapDelay 到点）
 * 把 Canvas/GameLayer/坏人 藏掉、Canvas/GameLayer/好人 放出来，同时把修好的毛衣收掉。
 * 好人的节点自己挂 FrameLoop 循环它那套序列帧，被激活时 onEnable 从第 1 帧开始 —— 不用给谁换帧。
 *
 * 换的那一下是交叉淡入淡出：两个节点都要 UIOpacity，好人从 0 淡到 255、坏人同时淡到 0 再隐藏。
 * 好人排在坏人后面（兄弟序），淡入时压在淡出的坏人上面，看起来是「变了个身」。
 *
 *   node tools/exec.mjs scene tools/js/mount-node-swap.js
 *
 * 幂等：组件已有就复用，重复跑只是再赋一次同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const slot = canvas.getChildByPath('GameLayer/BrokenLayer/Slot_03').getComponent('PieceSlot');
slot.swapHide = canvas.getChildByPath('GameLayer/坏人');
slot.swapShow = canvas.getChildByPath('GameLayer/好人');
slot.swapFadeTime = 0.25;

for (const n of [slot.swapHide, slot.swapShow]) {
  if (!n.getComponent(cc.UIOpacity)) n.addComponent(cc.UIOpacity);
}

return {
  slot: slot.node.name,
  swapHide: slot.swapHide ? slot.swapHide.name : null,
  swapShow: slot.swapShow ? slot.swapShow.name : null,
  showActive: slot.swapShow ? slot.swapShow.active : null,
  hideActive: slot.swapHide ? slot.swapHide.active : null,
  swapDelay: slot.swapDelay,
  swapFadeTime: slot.swapFadeTime,
  hideOpacity: slot.swapHide.getComponent(cc.UIOpacity).opacity,
  showOpacity: slot.swapShow.getComponent(cc.UIOpacity).opacity,
  showSibling: slot.swapShow.getSiblingIndex(),
  hideSibling: slot.swapHide.getSiblingIndex(),
};
