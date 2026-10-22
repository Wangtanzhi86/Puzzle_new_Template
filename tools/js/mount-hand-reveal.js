const canvas = cc.director.getScene().getChildByName('Canvas');
const sceneBg = canvas.getChildByPath('GameLayer/Scene_BG');
const broken = canvas.getChildByPath('GameLayer/BrokenLayer');
const action2 = canvas.getChildByPath('GameLayer/女主动作二');
const hand = action2.getChildByName('男主手');
const slot4 = broken.getChildByName('Slot_04').getComponent('PieceSlot');

hand.active = false;

const swaps = sceneBg.getComponents('SlotSwap');
let swap = swaps.find((c) => c.watch === slot4 && c.showNodes.length === 1 && c.showNodes[0] === hand);
if (!swap) {
    swap = sceneBg.addComponent('SlotSwap');
    swap.watch = slot4;
    swap.hideNodes = [];
    swap.showNodes = [hand];
}
swap.delay = 0.2;
swap.fadeTime = 0.3;
swap.pop = true;

return {
    hand: { path: hand.getPathInHierarchy(), active: hand.active },
    watch: swap.watch.node.getPathInHierarchy(),
    pieceId: slot4.pieceId,
    show: swap.showNodes.map((n) => n.getPathInHierarchy()),
    hide: swap.hideNodes.map((n) => n.getPathInHierarchy()),
    delay: swap.delay, fade: swap.fadeTime, pop: swap.pop,
};