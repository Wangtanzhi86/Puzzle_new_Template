/**
 * 给 Slot_04（胶带那格）接线：
 *   - `PieceSlot.poolSprite` = 胶带.png（这格没有破损图、修复图也不是它，池里拿在手上的那张单独配）
 *   - 槽位上挂 `TapeReveal`，tapes = 胶带1/2/3，hideOnDone = 稻草人
 *   - 三条胶带的 Sprite 改成 FILLED + HORIZONTAL（fillRange 0→1 就是从左到右刷出来）
 *   - 四个槽位的 pieceId 拉开成 1/2/3/4（原来 02/03/04 都是 2，靠 Array.sort 稳定兜着）
 *
 *   node tools/exec.mjs scene tools/js/mount-tape-reveal.js
 *
 * 幂等：组件已存在就复用，Sprite 属性重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const slotNode = layer.getChildByName('Slot_04');
const slot = slotNode.getComponent('PieceSlot');

// 1. 池里那块碎片用 胶带.png
const POOL_UUID = 'da39e1fa-3232-40b9-a63f-560de24b705a@f9941';
const poolFrame = await new Promise((resolve, reject) => {
  cc.assetManager.loadAny(POOL_UUID, (err, asset) => (err ? reject(new Error(POOL_UUID + ' -> ' + err.message)) : resolve(asset)));
});
slot.poolSprite = poolFrame;

// 2. 胶带揭晓组件
let reveal = slotNode.getComponent('TapeReveal');
if (!reveal) reveal = slotNode.addComponent('TapeReveal');

const tapes = [];
for (const name of ['胶带1', '胶带2', '胶带3']) {
  const sp = slotNode.getChildByName(name).getComponent(cc.Sprite);
  sp.type = cc.Sprite.Type.FILLED;
  sp.fillType = cc.Sprite.FillType.HORIZONTAL;
  sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  sp.fillStart = 0;
  sp.fillEnd = 1;
  // 存盘留 1：编辑模式不跑 onLoad，场景面板里得看得见才好摆位；开演时 TapeReveal 会归 0
  sp.fillRange = 1;
  tapes.push(sp);
}
reveal.tapes = tapes;
reveal.hideOnDone = [canvas.getChildByPath('GameLayer/稻草人')];
slot.tapeReveal = reveal;

// 3. pieceId 不要留并列
for (const node of layer.children) {
  const s = node.getComponent('PieceSlot');
  if (s) s.pieceId = node.name.slice(-2) | 0;
}

return {
  slot: slotNode.name,
  poolSprite: slot.poolSprite ? slot.poolSprite.name : null,
  pieceFrame: slot.pieceFrame ? slot.pieceFrame.name : null,
  tapeReveal: !!slot.tapeReveal,
  tapes: reveal.tapes.map((t) => t.node.name + ' type=' + t.type + ' fillType=' + t.fillType + ' fillRange=' + t.fillRange),
  hideOnDone: reveal.hideOnDone.map((n) => n.name),
  pieceIds: layer.children.map((n) => n.name + '=' + n.getComponent('PieceSlot').pieceId),
};
