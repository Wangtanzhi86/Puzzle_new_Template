/**
 * 按 CopyPuzzle 的「吸附效果 + 显示效果」配置场景：
 *
 *   node tools/exec.mjs scene tools/js/apply-copy-snap.js
 *
 * 做四件事（幂等，可反复跑）：
 * 1. `EffectLayer` 上挂 `SnapReveal`（没有才新建），`revealEffect` = `bg-reveal.effect`。
 * 2. 参数写成 CopyPuzzle 的原始值：punchTime 0.6 / revealTime 8 / feather 0.35 / brightness 5 / waveOn true。
 *    这几个数是 `PuzzleItem._playSnapAnimation` + `_startFader` 里写死的，不是猜的。
 * 3. 23 个 `PieceSlot` 的「吸附瞬间揭晓」全部指到这个组件（CopyPuzzle 每块碎片都走这一套）。
 * 4. 打开 Canvas 上的「吸附瞬间时序」开关。
 *
 * 想回退：把开关关掉即可，槽位上的引用留着不影响（`handles()` 返 false 就落回原来那套揭晓）。
 * 想只让某几格走：把别的槽位的「吸附瞬间揭晓」清空。
 */
const sceneNode = cc.director.getScene();
const canvasNode = sceneNode.getChildByName('Canvas');
const effectLayerNode = canvasNode.getChildByName('EffectLayer');

const EFFECT_UUID = '45692ecc-d9dc-468b-9ee5-d35ef6475dca';
const effectAsset = await new Promise((res, rej) =>
  cc.assetManager.loadAny(EFFECT_UUID, (e, a) => (e ? rej(new Error(EFFECT_UUID + ' -> ' + e.message)) : res(a))),
);

const existed = !!effectLayerNode.getComponent('SnapReveal');
const snapRevealComp = existed ? effectLayerNode.getComponent('SnapReveal') : effectLayerNode.addComponent('SnapReveal');

// CopyPuzzle 原值，每次都写一遍 —— 这个脚本的定位就是「配置成 CopyPuzzle 的样子」。
snapRevealComp.revealEffect = effectAsset;
snapRevealComp.punchTime = 0.6;
snapRevealComp.revealTime = 8;
snapRevealComp.feather = 0.35;
snapRevealComp.brightness = 5;
snapRevealComp.waveOn = true;

// 吸附判据也对齐 CopyPuzzle：按轴矩形，比例 0.4（PuzzleItem.snapRadius = 0.4）
const snapSystem = canvasNode.getComponentInChildren('SnapSystem');
if (snapSystem) {
  snapSystem.snapMode = 1;
  snapSystem.snapRatio = 0.4;
}

const slots = [];
(function walk(n) {
  for (const c of n.children) {
    const slot = c.getComponent('PieceSlot');
    if (slot) {
      slot.snapReveal = snapRevealComp;
      slots.push(c.name);
    }
    walk(c);
  }
})(canvasNode);

const flags = canvasNode.getComponent('FeatureFlags');
if (flags) flags.snapReveal = true;

const pool = canvasNode.getComponentInChildren('PiecePool');
if (pool) pool.insertOnFail = true;

return {
  component: existed ? 'reused' : 'created',
  revealEffect: snapRevealComp.revealEffect ? snapRevealComp.revealEffect.name : null,
  punchTime: snapRevealComp.punchTime,
  revealTime: snapRevealComp.revealTime,
  feather: snapRevealComp.feather,
  brightness: snapRevealComp.brightness,
  waveOn: snapRevealComp.waveOn,
  snapMode: snapSystem ? snapSystem.snapMode : null,
  snapRatio: snapSystem ? snapSystem.snapRatio : null,
  flagsSnapReveal: flags ? flags.snapReveal : null,
  insertOnFail: pool ? pool.insertOnFail : null,
  slotCount: slots.length,
  slots,
};
