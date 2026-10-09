/**
 * 给四格接线「修复揭晓」：
 *   - EffectLayer 上挂 RepairReveal（全局一个实例，四格共用），frames = 蝙蝠序列帧 7 张
 *   - 四个槽位的 PieceSlot.revealAnim 指过去
 *
 *   node tools/exec.mjs scene tools/js/mount-repair-reveal.js
 *
 * 幂等：组件已存在就复用，frames 重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const effectLayer = canvas.getChildByName('EffectLayer');

const FRAMES = [
  '2ed4ca0f-a058-4a47-9df0-d04c39964588@f9941',
  '41d8cf93-8344-47c5-b3c8-97636456992b@f9941',
  '05afaa76-e76c-4fd0-8f2f-89fa9492a823@f9941',
  '0b95ab04-fc10-492a-9e58-de2b47835172@f9941',
  '21552941-983f-423f-ad50-0c7ada719a46@f9941',
  'fcb2d8a5-b8dc-44f6-a446-9dca9f3a5c47@f9941',
  'd9366b0f-3902-40fd-95b0-748222d18fac@f9941',
];

const frames = [];
for (const uuid of FRAMES) {
  frames.push(
    await new Promise((resolve, reject) => {
      cc.assetManager.loadAny(uuid, (err, asset) => (err ? reject(new Error(uuid + ' -> ' + err.message)) : resolve(asset)));
    }),
  );
}

let reveal = effectLayer.getComponent('RepairReveal');
if (!reveal) reveal = effectLayer.addComponent('RepairReveal');
reveal.frames = frames;

const wired = [];
for (const node of layer.children) {
  const slot = node.getComponent('PieceSlot');
  if (!slot) continue;
  slot.revealAnim = reveal;
  wired.push(node.name);
}

return {
  frames: reveal.frames.map((f) => f.name),
  frameInterval: reveal.frameInterval,
  sizeRatio: reveal.sizeRatio,
  revealTime: reveal.revealTime,
  wired,
};
