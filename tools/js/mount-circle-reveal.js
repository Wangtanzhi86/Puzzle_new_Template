/**
 * 给「圆形扩散揭晓」接线（**全 6 格**）：
 *   - EffectLayer 上挂 CircleReveal（全局一个实例，和 RepairSweep / RepairReveal / StickerApply 并列），
 *     revealEffect = bg-reveal.effect（和结束背景同一份材质）
 *   - 6 个槽位的 `PieceSlot.circleReveal` 都指过去
 *   - 同时**清空 6 格的 `PieceSlot.stickerApply`** —— `PieceSlot.repair()` 里「贴纸贴平」排在
 *     「圆形扩散」前面并且短路返回，两个口都填只有贴纸会演（`verify-scene.js` 的 checkReveal 也会报）。
 *     组件本身还挂在 EffectLayer 上，只是没有任何槽位再指它。
 *
 * 开关是 `FeatureFlags.circleReveal`：关掉就整条回退到「序列帧 + 放大」那套（不用改接线）。
 *
 *   node tools/exec.mjs scene tools/js/mount-circle-reveal.js
 *
 * 幂等：组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const effectLayer = canvas.getChildByName('EffectLayer');

const EFFECT_UUID = '45692ecc-d9dc-468b-9ee5-d35ef6475dca';

const effect = await new Promise((res, rej) =>
  cc.assetManager.loadAny(EFFECT_UUID, (e, a) => (e ? rej(new Error(EFFECT_UUID + ' -> ' + e.message)) : res(a))),
);

let reveal = effectLayer.getComponent('CircleReveal');
if (!reveal) reveal = effectLayer.addComponent('CircleReveal');
reveal.revealEffect = effect;

const wired = [];
const cleared = [];
for (const node of layer.children) {
  const slot = node.getComponent('PieceSlot');
  if (!slot) continue;
  slot.circleReveal = reveal;
  wired.push(node.name);
  if (slot.stickerApply) {
    slot.stickerApply = null;
    cleared.push(node.name);
  }
}

return {
  effect: reveal.revealEffect.name + ' | ' + reveal.revealEffect.uuid,
  revealTime: reveal.revealTime,
  feather: reveal.feather,
  wired,
  stickerCleared: cleared,
  untouched: layer.children.filter((n) => !n.getComponent('PieceSlot')).map((n) => n.name),
};
