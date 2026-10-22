/**
 * 槽位重设计 + 金色烟花揭晓接线（配套 assets/scripts/gameplay/{SlotSwap,FireworkReveal}.ts）。
 *
 *   node tools/exec.mjs scene tools/js/mount-slot-swaps.js
 *
 * 做五件事：
 *  1. Slot_01 勾「开局已修好」；
 *  2. Slot_01/Repaired 下复制一个 Repaired_2（小三动作2，默认隐藏）；
 *  3. Slot_01 修好（预填）时不动；Slot_02 修好时 Repaired → Repaired_2 平滑换图；
 *  4. Slot_03 修好时 女主动作1 → 女主动作二 平滑换人；关卡建好时露出 女主紧张表情；
 *  5. EffectLayer 上挂 FireworkReveal + 建 GoldenBurst 粒子节点，四个槽位全部指过去，
 *     清掉旧的 LuggageDrop 与 snap/sticker/brush/circle 引用。
 *
 * 幂等：Repaired_2 / GoldenBurst 已存在就复用；SlotSwap 按「触发槽位 + 显示节点」认领。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const broken = canvas.getChildByPath('GameLayer/BrokenLayer');
const sceneBg = canvas.getChildByPath('GameLayer/Scene_BG');
const effectLayer = canvas.getChildByName('EffectLayer');

const SF_XIAOSAN2 = 'aec9705a-fcf1-4baa-9983-5d72fb582112@f9941';
const SF_SPARK = '2f76c8f2-48a7-46ab-b6e9-8ec6faf24333@f9941';
const EFFECT_BG = '45692ecc-d9dc-468b-9ee5-d35ef6475dca';
const EFFECT_ADD = '8c682025-24b0-4fb9-8179-9b45c212beb5';

const load = (uuid) => new Promise((res, rej) => cc.assetManager.loadAny({ uuid }, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));
const sfXiaosan2 = await load(SF_XIAOSAN2);
const sfSpark = await load(SF_SPARK);
const effBg = await load(EFFECT_BG);
const effAdd = await load(EFFECT_ADD);

const slotOf = (name) => broken.getChildByName(name).getComponent('PieceSlot');
const slot1 = slotOf('Slot_01');
const slot2 = slotOf('Slot_02');
const slot3 = slotOf('Slot_03');
slot1.preFilled = true;

const rep = slot1.node.getChildByName('Repaired');
let rep2 = slot1.node.getChildByName('Repaired_2');
if (!rep2) {
    const rut = rep.getComponent(cc.UITransform);
    rep2 = new cc.Node('Repaired_2');
    rep2.parent = rep.parent;
    rep2.layer = rep.layer;
    rep2.setPosition(rep.position.x, rep.position.y, rep.position.z);
    rep2.setScale(rep.scale.x, rep.scale.y, rep.scale.z);
    rep2.setRotation(rep.rotation);
    const ut = rep2.addComponent(cc.UITransform);
    ut.setContentSize(rut.contentSize.width, rut.contentSize.height);
    ut.setAnchorPoint(rut.anchorPoint.x, rut.anchorPoint.y);
    const sp = rep2.addComponent(cc.Sprite);
    sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    sp.spriteFrame = sfXiaosan2;
    rep2.addComponent('RepairedSlot');
    rep2.setSiblingIndex(rep.getSiblingIndex() + 1);
    rep2.active = false;
}

const sameNodes = (a, b) => a.length === b.length && a.every((n) => b.includes(n));
const ensureSwap = (host, watch, hideNodes, showNodes, delay, fadeTime, pop) => {
    const list = host.getComponents('SlotSwap');
    for (const c of list) {
        if (c.watch === watch && sameNodes(c.hideNodes, hideNodes) && sameNodes(c.showNodes, showNodes)) return c;
    }
    const c = host.addComponent('SlotSwap');
    c.watch = watch;
    c.hideNodes = hideNodes;
    c.showNodes = showNodes;
    c.delay = delay;
    c.fadeTime = fadeTime;
    c.pop = pop;
    return c;
};

const repSwap = ensureSwap(slot1.node, slot2, [rep], [rep2], 0.2, 0.35, true);
const action1 = sceneBg.getChildByName('女主动作1');
const action2 = sceneBg.getChildByName('女主动作二');
const nervous = action1.getChildByName('女主紧张表情');
const roleSwap = ensureSwap(sceneBg, slot3, [action1], [action2], 0, 0.35, false);
roleSwap.waitShown = true;
const prelude = ensureSwap(sceneBg, null, [], [nervous], 0.25, 0.3, true);

let burstNode = effectLayer.getChildByName('GoldenBurst');
if (!burstNode) {
    burstNode = new cc.Node('GoldenBurst');
    burstNode.parent = effectLayer;
    burstNode.layer = effectLayer.layer;
}
let burst = burstNode.getComponent('Particle2D');
if (!burst) burst = burstNode.addComponent('Particle2D');
burst.spriteFrame = sfSpark;
burst.additive = true;
burst.additiveEffect = effAdd;
burst.playOnLoad = false;
burst.startEvents = [];
burst.stopEvents = [];
burst.totalParticles = 72;
burst.emissionRate = 620;
burst.life = 0.7;
burst.lifeVar = 0.18;
burst.angle = 90;
burst.angleVar = 180;
burst.startSize = 36;
burst.startSizeVar = 10;
burst.endSize = 0;
burst.startColor = new cc.Color(255, 228, 150, 255);
burst.endColor = new cc.Color(255, 150, 40, 0);
burst.posVar = new cc.Vec2(6, 6);
burst.gravity = new cc.Vec2(0, -420);
burst.speed = 430;
burst.speedVar = 180;
burst.radialAccel = -40;
burst.positionType = 1;
burst.alignToVelocity = false;

let firework = effectLayer.getComponent('FireworkReveal');
if (!firework) firework = effectLayer.addComponent('FireworkReveal');
firework.revealEffect = effBg;
firework.burst = burst;

const slots = ['Slot_01', 'Slot_02', 'Slot_03', 'Slot_04'].map((n) => broken.getChildByName(n));
const cleaned = [];
for (const node of slots) {
    const slot = node.getComponent('PieceSlot');
    for (const c of node.getComponents(cc.Component).slice()) {
        if (cc.js.getClassName(c) === 'LuggageDrop') { node.removeComponent(c); cleaned.push(node.name); }
    }
    slot.snapReveal = null;
    slot.stickerApply = null;
    slot.brushReveal = null;
    slot.circleReveal = null;
    slot.fireworkReveal = firework;
}

return {
    prefilled: slot1.preFilled,
    repaired2: { frame: rep2.getComponent(cc.Sprite).spriteFrame.name, size: [rep2.getComponent(cc.UITransform).width, rep2.getComponent(cc.UITransform).height] },
    repSwap: { hide: repSwap.hideNodes.map((n) => n.name), show: repSwap.showNodes.map((n) => n.name) },
    roleSwap: { hide: roleSwap.hideNodes.map((n) => n.name), show: roleSwap.showNodes.map((n) => n.name) },
    prelude: { show: prelude.showNodes.map((n) => n.name) },
    burst: { particles: burst.totalParticles, sprite: burst.spriteFrame.name, additive: burst.additive },
    firework: { reveal: firework.revealEffect.name, lead: firework.burstLead, time: firework.burstTime },
    slots: slots.map((n) => n.name),
    cleaned,
};
