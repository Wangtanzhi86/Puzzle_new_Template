/**
 * 给四格接线「修复揭晓」：
 *   - EffectLayer 上挂 RepairReveal（全局一个实例，四格共用）
 *   - 四个槽位的 PieceSlot.revealAnim 指过去
 *
 * ⚠️ `frames`（序列帧）**不在这里配**：旧的那套蝙蝠序列帧资源已经删了，场景里 `frames` 现在是空数组，
 * 组件装上了也不会播（`RepairReveal.play` 拿空表直接收摊）。美术出了新的序列帧之后在 Inspector 里
 * 往 `RepairReveal.frames` 拖，或者在这个脚本里补一段 load（别再写死 uuid —— 每次重新导入都会变）。
 *
 *   node tools/exec.mjs scene tools/js/mount-repair-reveal.js
 *
 * 幂等：组件已存在就复用。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const effectLayer = canvas.getChildByName('EffectLayer');

let reveal = effectLayer.getComponent('RepairReveal');
if (!reveal) reveal = effectLayer.addComponent('RepairReveal');

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
