/**
 * 「吸附瞬间时序」接线，配套 `assets/scripts/gameplay/SnapReveal.ts`（见 AGENTS.md §16）。
 *
 *   node tools/exec.mjs scene tools/js/mount-snap-reveal.js
 *
 * 1. `EffectLayer` 上挂 `SnapReveal`（全局一份，和 RepairReveal / CircleReveal / RepairSweep 并列），
 *    `revealEffect` = `bg-reveal.effect`（和结束背景 / 圆形扩散同一份）。
 * 2. **不替槽位做选择**：给哪几格走这条由人决定（它一填就把那一格原来那套揭晓整格顶掉）。
 *    脚本只把没指的槽位列出来，指完再跑一次就能在返回里看到 `wired`。
 *
 * 还有一道总开关在 `Canvas` 的 FeatureFlags 面板上（「吸附瞬间时序」），**默认关**：
 * 关着时 `SnapReveal.handles()` 返 false，槽位照旧走它自己那套（贴纸 / 画笔 / 圆扩散 / 序列帧）。
 *
 * 幂等：组件已有就复用，**调参项只在组件是新建的时候写初值** —— 那几个数要在 Inspector 里反复试，
 * 重跑一次接线不该把调好的值冲回默认。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const effectLayer = canvas.getChildByName('EffectLayer');

const EFFECT_UUID = '45692ecc-d9dc-468b-9ee5-d35ef6475dca';

const effect = await new Promise((res, rej) =>
  cc.assetManager.loadAny(EFFECT_UUID, (e, a) => (e ? rej(new Error(EFFECT_UUID + ' -> ' + e.message)) : res(a))),
);

const had = !!effectLayer.getComponent('SnapReveal');
const reveal = had ? effectLayer.getComponent('SnapReveal') : effectLayer.addComponent('SnapReveal');
reveal.revealEffect = effect;

if (!had) {
  // 原版 0.6 / 8 / 0.35 / 5 是 CopyPuzzle 的值，照抄先跑一遍看看手感；
  // 23 格嫌慢就把 revealTime 往下压（工具提示里建议先试 1.2）
  reveal.punchTime = 0.6;
  reveal.revealTime = 8;
  reveal.feather = 0.35;
  reveal.brightness = 5;
  reveal.waveOn = true;
}

const wired = [];
const free = [];
for (const node of layer.children) {
  const slot = node.getComponent('PieceSlot');
  if (!slot) continue;
  if (slot.snapReveal) wired.push(node.name);
  else free.push(node.name);
}

const flags = canvas.getComponent('FeatureFlags');
return {
  effect: reveal.revealEffect.name + ' | ' + reveal.revealEffect.uuid,
  existed: had,
  punchTime: reveal.punchTime,
  revealTime: reveal.revealTime,
  feather: reveal.feather,
  brightness: reveal.brightness,
  waveOn: reveal.waveOn,
  wired,
  free,
  snapRevealFlag: flags ? flags.snapReveal : null,
};
