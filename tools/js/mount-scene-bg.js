/**
 * 给拼图区背景接线：`Canvas/GameLayer/Scene_BG` 下建一个同尺寸的 `完成背景` 子节点，
 * 再建一个 `魔法仙尘` 粒子节点；`Scene_BG` 自己挂 `SceneBgSwap`，把三者接起来。
 *
 * **现在的模式是「完成图直接亮出来」**（`instant = true`）：最后一块**吸附成功当刻**
 * （`LEVEL_COMPLETE`）把 `完成背景` 那张贴图挪到 `Scene_BG` 上，并**当刻抛 `END_SHOW`** 弹结束界面 ——
 * 不建材质、不起 tween、不撒仙尘，也不等最后一格露面。画笔涂色那个分支还在代码里
 * （`instant = false` 就退回它）：一支圆头画笔从左上角斜着来回刷到右下角（和单块修复同一份
 * `brush-reveal.effect`），`魔法仙尘` 那个 `ParticleSystem2D` 跟着笔头撒，**不提前**、等最后一格露面才落笔。
 * 两条路的收尾状态一样（贴图在 `Scene_BG` 上、两个子节点都睡着）。
 *
 *   node tools/exec.mjs scene tools/js/mount-scene-bg.js
 *
 * 幂等：节点 / 组件已存在就复用，重复跑只是再赋一次同样的值。
 * 粒子那十几个参数只在**第一次建节点**时写 —— 之后在 Inspector 里怎么调都不会被这个脚本冲掉。
 * `revealTime` 同理：只在「原来配的不是画笔材质」那一次写回 1.2（0.9 是上一版圆形扩散的时长）。
 *
 * ⚠️ `完成背景` 的贴图（`成图`）与粒子的贴图都别往这个脚本里写死 uuid：前者在 Inspector 里拖，
 * 后者留空、由 `SceneBgSwap` 在运行期用代码画的白点兜底（美术出了仙尘图直接拖到那个粒子节点上）。
 */

const canvas = cc.director.getScene().getChildByName('Canvas');
const bg = canvas.getChildByPath('GameLayer/Scene_BG');

const BRUSH_UUID = 'b5570642-c5f9-4f6a-b4e1-85d58dd9b1bb';
const load = (uuid) => new Promise((res, rej) => cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));
const brush = await load(BRUSH_UUID);

const bgUT = bg.getComponent(cc.UITransform);

// 1. 涂色节点：同尺寸、同锚点、贴在 Scene_BG 上
let node = bg.getChildByName('完成背景');
if (!node) {
  node = new cc.Node('完成背景');
  node.setParent(bg);
}
node.setSiblingIndex(0);
node.setPosition(0, 0, 0);

const ut = node.getComponent(cc.UITransform) || node.addComponent(cc.UITransform);
ut.setContentSize(bgUT.width, bgUT.height);
const widget = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
widget.top = widget.bottom = widget.left = widget.right = 0;
// 跟场景里其余 9 个 Widget 一致（ALWAYS 是 1、ON_WINDOW_RESIZE 是 2，别按枚举顺序猜）
widget.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;

// 尺寸模式必须是 CUSTOM：四边 Widget 撑出来的框不跟着贴图的长宽变
const sprite = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;

// 2. 仙尘：Scene_BG 的另一个子节点（排在涂色节点后面，画在它上面）。
//    位置运行期由 SceneBgSwap 每帧挪到笔头上，这儿只摆个原点。
let dustNode = bg.getChildByName('魔法仙尘');
const freshDust = !dustNode;
if (!dustNode) {
  dustNode = new cc.Node('魔法仙尘');
  dustNode.setParent(bg);
}
dustNode.setPosition(0, 0, 0);
const dustUT = dustNode.getComponent(cc.UITransform) || dustNode.addComponent(cc.UITransform);
dustUT.setContentSize(40, 40);
const dust = dustNode.getComponent(cc.ParticleSystem2D) || dustNode.addComponent(cc.ParticleSystem2D);

if (freshDust) {
  const V2 = cc.Vec2;
  const C = cc.Color;
  dust.playOnLoad = false;            // 起停由 SceneBgSwap 管（resetSystem / stopSystem）
  dust.positionType = cc.ParticleSystem2D.PositionType.FREE;  // 留在原地 = 拖尾，不跟着笔头走
  dust.totalParticles = 400;
  dust.duration = cc.ParticleSystem2D.DURATION_INFINITY;
  dust.emissionRate = 300;            // 「粒子多一点」：一秒 300 颗
  dust.life = 0.55;
  dust.lifeVar = 0.25;
  dust.startSize = 24;
  dust.startSizeVar = 12;
  dust.endSize = 4;
  dust.endSizeVar = 0;
  dust.angle = 90;
  dust.angleVar = 180;                // 四散
  dust.speed = 30;
  dust.speedVar = 26;
  dust.posVar = new V2(4, 4);
  dust.gravity = new V2(0, 0);
  dust.startColor = new C(255, 250, 220, 255);   // 「亮一点」：近白暖色，加色混合在代码里再加一层
  dust.startColorVar = new C(20, 20, 20, 0);
  dust.endColor = new C(255, 235, 170, 0);       // 淡出到透明
  dust.endColorVar = new C(0, 0, 0, 0);
}

// 3. 接线
let comp = bg.getComponent('SceneBgSwap');
if (!comp) comp = bg.addComponent('SceneBgSwap');
const freshComp = comp.brushEffect !== brush;
comp.instant = true;   // 现在的模式：最后一块落位当刻亮完成图，结束界面等最后一格修复演完（见文件头）
comp.brushEffect = brush;
comp.revealView = sprite;
comp.dust = dust;
// 上一版圆形扩散是 0.9 时长 / 0.35 羽化，都留在场景里了：第一次接画笔时一起改掉
// （羽化 0.35 是圆形扩散的手感，按在画笔上笔迹会糊）
if (freshComp) {
  comp.revealTime = 1.2;
  comp.feather = 0.25;
}

return {
  node: node.name,
  nodeSize: [ut.contentSize.width, ut.contentSize.height],
  active: node.active,
  frame: sprite.spriteFrame ? sprite.spriteFrame.name + ' | ' + sprite.spriteFrame.uuid : '<空>',
  sizeMode: sprite.sizeMode,
  widget: { t: widget.isAlignTop, b: widget.isAlignBottom, l: widget.isAlignLeft, r: widget.isAlignRight, top: widget.top, mode: widget.alignMode },
  brushEffect: comp.brushEffect ? comp.brushEffect.name + ' | ' + comp.brushEffect.uuid : null,
  instant: comp.instant,
  revealView: comp.revealView ? comp.revealView.node.name : null,
  dust: comp.dust ? comp.dust.node.name : null,
  dustCfg: [dust.playOnLoad, dust.positionType, dust.totalParticles, dust.emissionRate, dust.life, dust.startSize, dust.angleVar],
  revealTime: comp.revealTime,
  rows: comp.rows,
  radius: comp.radius,
  feather: comp.feather,
  sceneBgFrame: bg.getComponent(cc.Sprite).spriteFrame.name,
  sceneBgChildren: bg.children.map((c) => c.name),
  freshDust,
  freshComp,
};
