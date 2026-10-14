/**
 * 「画笔涂色揭晓」接线，配套 `assets/scripts/gameplay/BrushReveal.ts` 与
 * `assets/effects/brush-reveal.effect`。
 *
 *   - EffectLayer 上挂 BrushReveal（全局一个实例，和 RepairSweep / RepairReveal / CircleReveal 并列），
 *     brushEffect = brush-reveal.effect
 *   - 把六格的 `brushReveal` 指过去，并清掉它们各自的「贴纸贴平」与「圆形扩散」
 *     （三个都是「整格接管」、都要往同一张修复图上挂材质，只能填一个；留着只会让人以为它在生效）
 *
 * 开关是 `FeatureFlags.brushReveal`：关掉，六格立刻回退到接线里剩下的那套（不用改接线）。
 *
 *   node tools/exec.mjs scene tools/js/mount-brush-reveal.js
 *
 * ⚠️ 跑完想退回贴平就重跑 `mount-sticker-apply.js`（它会反过来清掉 brushReveal）。
 * 调参（rows / radius / feather / revealTime）只在 Inspector 里改 —— 这个脚本不碰它们，重跑不会复位。
 *
 * 幂等：组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const effectLayer = canvas.getChildByName('EffectLayer');
const brokenLayer = canvas.getChildByPath('GameLayer/BrokenLayer');

const EFFECT_UUID = 'b5570642-c5f9-4f6a-b4e1-85d58dd9b1bb';
const SLOTS = ['Slot_01', 'Slot_02', 'Slot_03', 'Slot_04', 'Slot_05', 'Slot_06'];

const effect = await new Promise((res, rej) =>
  cc.assetManager.loadAny(EFFECT_UUID, (e, a) => (e ? rej(new Error(EFFECT_UUID + ' -> ' + e.message)) : res(a))),
);

let brush = effectLayer.getComponent('BrushReveal');
if (!brush) brush = effectLayer.addComponent('BrushReveal');
brush.brushEffect = effect;

const wired = [];
const cleared = [];
for (const name of SLOTS) {
  const slot = brokenLayer.getChildByName(name).getComponent('PieceSlot');
  slot.brushReveal = brush;
  if (slot.stickerApply) {
    slot.stickerApply = null;
    cleared.push(name + ' 贴平');
  }
  if (slot.circleReveal) {
    slot.circleReveal = null;
    cleared.push(name + ' 圆形扩散');
  }
  wired.push(name);
}

return {
  effect: brush.brushEffect.name + ' | ' + brush.brushEffect.uuid,
  revealTime: brush.revealTime,
  rows: brush.rows,
  radius: brush.radius,
  feather: brush.feather,
  wired,
  cleared,
  stillSticker: brokenLayer.children
    .filter((n) => n.getComponent('PieceSlot') && n.getComponent('PieceSlot').stickerApply)
    .map((n) => n.name),
};
