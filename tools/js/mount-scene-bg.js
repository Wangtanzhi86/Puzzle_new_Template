/**
 * 给拼图区背景接线：`Canvas/GameLayer/Scene_BG` 下建一个同尺寸的 `完成背景` 子节点，
 * 四边 Widget 贴住 Scene_BG；Scene_BG 自己挂 `SceneBgSwap`，把子节点的 Sprite 和
 * `assets/effects/bg-reveal.effect` 接上去。全部修完、最后一格也露脸之后，这个子节点从中心
 * 以圆形羽化扩出来盖住底图，扩完自己的贴图挪到 Scene_BG 上、自己被收掉。
 *
 * ⚠️ `完成背景` 的贴图（旧的是 UI及背景/完成背景.png）**已随旧素材删除**，场景里现在是空的 ——
 * 把新图拖到 `GameLayer/Scene_BG/完成背景` 的 Sprite 上即可，`SceneBgSwap.finish()` 读的就是它，
 * 图只配一处。别再往这个脚本里写死 uuid（每次重新导入都会变）。
 *
 *   node tools/exec.mjs scene tools/js/mount-scene-bg.js
 *
 * 幂等：节点 / 组件已存在就复用，重复跑只是再赋一次同样的值。
 * 子节点在场景里保持 active —— 编辑模式不跑 onLoad，得看得见才好摆位；开演时组件会把它收掉。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const bg = canvas.getChildByPath('GameLayer/Scene_BG');

const EFFECT_UUID = '45692ecc-d9dc-468b-9ee5-d35ef6475dca';
const load = (uuid) => new Promise((res, rej) => cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));
const effect = await load(EFFECT_UUID);

// 1. 扩散节点：同尺寸、同锚点、贴在 Scene_BG 上
let node = bg.getChildByName('完成背景');
if (!node) {
  node = new cc.Node('完成背景');
  node.setParent(bg);
}
node.setSiblingIndex(0);
node.setPosition(0, 0, 0);

const bgUT = bg.getComponent(cc.UITransform);
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

// 2. 接线
let comp = bg.getComponent('SceneBgSwap');
if (!comp) comp = bg.addComponent('SceneBgSwap');
comp.revealEffect = effect;
comp.revealView = sprite;

return {
  node: node.name,
  nodeSize: [ut.contentSize.width, ut.contentSize.height],
  active: node.active,
  frame: sprite.spriteFrame ? sprite.spriteFrame.name + ' | ' + sprite.spriteFrame.uuid : '<空>',
  sizeMode: sprite.sizeMode,
  widget: { t: widget.isAlignTop, b: widget.isAlignBottom, l: widget.isAlignLeft, r: widget.isAlignRight, top: widget.top, mode: widget.alignMode },
  revealEffect: comp.revealEffect ? comp.revealEffect.name + ' | ' + comp.revealEffect.uuid : null,
  revealView: comp.revealView ? comp.revealView.node.name : null,
  revealTime: comp.revealTime,
  feather: comp.feather,
  sceneBgFrame: bg.getComponent(cc.Sprite).spriteFrame.name,
  sceneBgChildren: bg.children.map((c) => c.name),
};
