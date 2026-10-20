/**
 * 预填槽位的「补演」接线（配套 assets/scripts/gameplay/PrefillFlight.ts）。
 *
 *   node tools/exec.mjs scene tools/js/mount-prefill-flight.js
 *
 * 在 EffectLayer 上挂 PrefillFlight（全局一个实例），起飞位置指向 PiecePoolLayer。
 * 开场 `GAME_START` 之后它会把 Slot_01 退回破损态，让碎片从池子飞进缺口再演金色烟花。
 *
 * 幂等：组件已存在就只补引用，不改已调好的时间参数。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const effectLayer = canvas.getChildByName('EffectLayer');
const pool = canvas.getChildByName('PiecePoolLayer');

let flight = effectLayer.getComponent('PrefillFlight');
const added = !flight;
if (!flight) flight = effectLayer.addComponent('PrefillFlight');
if (!flight.from) flight.from = pool;

return {
    added,
    host: effectLayer.name,
    from: flight.from ? flight.from.name : null,
    delay: flight.delay,
    flyTime: flight.flyTime,
    stagger: flight.stagger,
    fadeTime: flight.fadeTime,
    prefilled: canvas.getChildByPath('GameLayer/BrokenLayer').children
        .filter((n) => {
            const s = n.getComponent('PieceSlot');
            return s && s.prefilled;
        })
        .map((n) => n.name),
};
