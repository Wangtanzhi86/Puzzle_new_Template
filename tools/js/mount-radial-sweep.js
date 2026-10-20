/**
 * 给「开局描边转出」接线（配套 assets/scripts/gameplay/RadialSweep.ts）。
 *
 *   node tools/exec.mjs scene tools/js/mount-radial-sweep.js
 *
 * 在 EffectLayer 上挂全局一个实例，sweepEffect = effects/radial-sweep.effect。
 * 槽位不用逐个指过来 —— 组件自己听 LEVEL_BUILT 拿槽位表。
 *
 * 幂等：组件已存在就只补材质引用，不改已调好的时长 / 错开 / 羽化。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const effectLayer = canvas.getChildByName('EffectLayer');

const EFFECT_UUID = '4d013507-1d00-4390-a2f4-b38637400013';
const effect = await new Promise((res, rej) =>
  cc.assetManager.loadAny(EFFECT_UUID, (e, a) => (e ? rej(new Error(EFFECT_UUID + ' -> ' + e.message)) : res(a))),
);

let sweep = effectLayer.getComponent('RadialSweep');
const added = !sweep;
if (!sweep) sweep = effectLayer.addComponent('RadialSweep');
if (!sweep.sweepEffect) sweep.sweepEffect = effect;

return {
    added,
    host: effectLayer.name,
    effect: sweep.sweepEffect.name + ' | ' + sweep.sweepEffect.uuid,
    sweepTime: sweep.sweepTime,
    stagger: sweep.stagger,
    delay: sweep.delay,
    feather: sweep.feather,
};