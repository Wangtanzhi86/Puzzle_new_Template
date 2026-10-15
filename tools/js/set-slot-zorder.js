/**
 * 按「碎片池顺序」（PieceSlot.pieceId）给每一格重排层级。
 *
 * 引擎里兄弟序越大越靠上（batcher-2d 的 walk 正向遍历 children，后画的盖在上面），
 * 而 PieceSlot.onLoad 是 `setSiblingIndex(this.zOrder)` —— 所以 zOrder 直接就是层级：
 * **值越大越在上面**。这里把它排成 0,1,2… 一路递增，池子越靠后的那块越压在上面，
 * 再把场景里的兄弟序也排成同一次序，让编辑器层级面板里看到的先后跟运行时一致。
 *
 *   node tools/exec.mjs scene tools/js/set-slot-zorder.js                      # 只看映射，不写
 *   node tools/exec.mjs scene tools/js/set-slot-zorder.js '{"apply":true}'     # 写
 *
 * 幂等：跑第二遍映射不变。
 */
const apply = !!(args && args.apply);

const canvas = cc.director.getScene().getChildByName('Canvas');
const brokenLayer = canvas.getChildByPath('GameLayer/BrokenLayer');

const slots = brokenLayer.children
  .map((node) => ({ node, slot: node.getComponent('PieceSlot') }))
  .filter((it) => it.slot);
slots.sort((a, b) => a.slot.pieceId - b.slot.pieceId);

const dupPieceIds = [];
const seen = new Set();
for (const { slot } of slots) {
  if (seen.has(slot.pieceId)) dupPieceIds.push(slot.pieceId);
  seen.add(slot.pieceId);
}

const plan = slots.map(({ node, slot }, i) => ({
  zOrder: i,
  was: slot.zOrder,
  pieceId: slot.pieceId,
  sibling: node.getSiblingIndex(),
  name: node.name,
}));

if (apply) {
  for (let i = 0; i < slots.length; i++) {
    slots[i].slot.zOrder = i;
    slots[i].node.setSiblingIndex(i);
  }
}

return {
  apply,
  total: slots.length,
  otherChildren: brokenLayer.children.length - slots.length,
  dupPieceIds,
  plan,
};
