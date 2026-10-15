/**
 * 给拼图框接线：`Canvas/GameLayer` 挂 `PuzzleAreaFit`，把「比例来源」（`Scene_BG` 的 Sprite）和
 * 「完成背景」两个口配上，再当场按当前贴图的比例算一遍三处尺寸。
 *
 * 平时不用跑它 —— 组件带 `@executeInEditMode`，换图重新导入之后编辑器里框会自己跟着变。
 * 这个脚本是接线 + 兜底：新场景接一次，或者哪天自动那一路不灵了，换完图跑一次也一样，
 * 一个字都不用改。
 *
 *   node tools/exec.mjs scene tools/js/mount-puzzle-area-fit.js
 *
 * 幂等：组件已存在就原样保留 Inspector 里的值（含 `maxWidth` / `maxHeight`），只补空着的引用。
 * 引用一律取场景里已有的节点，不写死贴图 uuid（每次重新导入都会变）。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const gl = canvas.getChildByName('GameLayer');
const bg = canvas.getChildByPath('GameLayer/Scene_BG');
const cls = cc.js.getClassByName('PuzzleAreaFit');
if (!cls) return { ok: false, error: 'PuzzleAreaFit 类没加载（改完 .ts 要先跑 editor tools/js/refresh.js）' };

const had = !!gl.getComponent(cls);
const fit = had ? gl.getComponent(cls) : gl.addComponent(cls);
if (!fit.source) fit.source = bg.getComponent(cc.Sprite);
if (!fit.doneBg) fit.doneBg = bg.getChildByName('完成背景');

// 自动那一路要等编辑器下一帧，这里当场算一遍，脚本返回时场景就已经是新尺寸了
fit.refit();

const sizeOf = (n) => { const u = n.getComponent(cc.UITransform); return [u.width, u.height]; };
const frame = fit.source && fit.source.spriteFrame;
return {
  ok: true,
  existed: had,
  source: fit.source ? fit.source.node.name : null,
  doneBg: fit.doneBg ? fit.doneBg.name : null,
  maxWidth: fit.maxWidth,
  maxHeight: fit.maxHeight,
  tex: frame ? [frame.originalSize.width, frame.originalSize.height] : '<空：贴图还没拖进来，尺寸保持原样>',
  gameLayer: sizeOf(gl),
  sceneBg: sizeOf(bg),
  doneBgSize: fit.doneBg ? sizeOf(fit.doneBg) : null,
  gameLayerPos: [gl.position.x, gl.position.y],
};
