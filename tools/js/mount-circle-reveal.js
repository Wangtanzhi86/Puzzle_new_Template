/**
 * 给「圆形扩散揭晓」接线：
 *   - EffectLayer 上挂 CircleReveal（全局一个实例，和 RepairSweep / RepairReveal 并列），
 *     revealEffect = bg-reveal.effect（和结束背景同一份材质）
 *   - 两个普通槽位（Slot_01 / Slot_02）的 PieceSlot.circleReveal 指过去
 *
 * Slot_03（毛衣换节点）/ Slot_04（胶带揭晓）**不接** —— 圆形扩散是整格接管（`repair()` 的第一个
 * 分支），指过去会把它们各自那套顶掉。要让那两格也走圆形扩散（等于放弃胶带 / 毛衣），把它们的
 * `circleReveal` 也指过来即可。
 *
 * 开关是 `FeatureFlags.circleReveal`：关掉，这两个槽位立刻回退到「序列帧 + 放大」那套（不用改接线）。
 *
 *   node tools/exec.mjs scene tools/js/mount-circle-reveal.js
 *
 * 幂等：组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const effectLayer = canvas.getChildByName('EffectLayer');

const EFFECT_UUID = '45692ecc-d9dc-468b-9ee5-d35ef6475dca';
const SLOTS = ['Slot_01', 'Slot_02'];

const effect = await new Promise((res, rej) =>
  cc.assetManager.loadAny(EFFECT_UUID, (e, a) => (e ? rej(new Error(EFFECT_UUID + ' -> ' + e.message)) : res(a))),
);

let reveal = effectLayer.getComponent('CircleReveal');
if (!reveal) reveal = effectLayer.addComponent('CircleReveal');
reveal.revealEffect = effect;

const wired = [];
for (const name of SLOTS) {
  const slot = layer.getChildByName(name).getComponent('PieceSlot');
  slot.circleReveal = reveal;
  wired.push(name);
}

return {
  effect: reveal.revealEffect.name + ' | ' + reveal.revealEffect.uuid,
  revealTime: reveal.revealTime,
  feather: reveal.feather,
  wired,
  untouched: layer.children
    .filter((n) => n.getComponent('PieceSlot') && !wired.includes(n.name))
    .map((n) => n.name),
};
