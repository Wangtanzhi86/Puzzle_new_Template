/**
 * 开场接线（配套 assets/scripts/ui/GameIntro.ts）。
 *
 *   - 建 `Canvas/IntroLayer`（全屏 + BlockInputEvents + GameIntro），两块纯色挡板 `Left` / `Right`；
 *   - 挡板滑出前不再亮「第 N 关」、也没有「点击屏幕开始」；
 *   - 开头视频节点由 `tools/js/mount-intro-video.js` 接线，选关界面由 `tools/js/mount-level-select.js` 接线。
 *
 *   node tools/exec.mjs scene tools/js/mount-level-flow.js
 *
 * 幂等：节点 / 组件已存在就原样复用。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const cls = (name) => cc.js.getClassByName(name);
const ensure = (parent, name) => parent.getChildByName(name) || new cc.Node(name).setParent(parent);

const full = (node) => {
  const w = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
  w.isAlignLeft = w.isAlignRight = w.isAlignTop = w.isAlignBottom = true;
  w.left = w.right = w.top = w.bottom = 0;
  w.alignMode = cc.Widget.AlignMode.ALWAYS;
  return node;
};

const block = (node) => node.getComponent(cc.BlockInputEvents) || node.addComponent(cc.BlockInputEvents);

const WHITE = (() => {
  const t = new cc.Texture2D();
  t.reset({ width: 2, height: 2, format: cc.Texture2D.PixelFormat.RGBA8888 });
  const frame = new cc.SpriteFrame();
  frame.texture = t;
  return frame;
})();
const LIGHT = new cc.Color(238, 240, 244, 255);

// ---------- 进关全屏动画 ----------
let introNode = canvas.getChildByName('IntroLayer');
if (!introNode) {
  introNode = new cc.Node('IntroLayer');
  introNode.setParent(canvas);
  introNode.setSiblingIndex(canvas.getChildByName('Change').getSiblingIndex());
}
full(introNode);
introNode.active = true;
block(introNode);
const intro = introNode.getComponent(cls('GameIntro')) || introNode.addComponent(cls('GameIntro'));

const shield = (name) => {
  const n = ensure(introNode, name);
  const t = n.getComponent(cc.UITransform) || n.addComponent(cc.UITransform);
  t.setContentSize(1700, 1700);
  const s = n.getComponent(cc.Sprite) || n.addComponent(cc.Sprite);
  s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  s.spriteFrame = WHITE;
  s.color = LIGHT;
  n.setPosition(0, 0, 0);
  return n;
};
const left = shield('Left');
const right = shield('Right');

const capNode = introNode.getChildByName('Caption');
if (capNode) { capNode.removeFromParent(); capNode.destroy(); }

intro.left = left;
intro.right = right;

return {
  intro: { left: left.name, right: right.name, video: !!intro.video },
  order: canvas.children.map((n) => n.name),
};
