/**
 * 选关卡片：把 Window 上的 RECT 遮罩换成圆角遮罩（RoundedClip），并把 Lock 挪进 Window 里，让它跟 Fill 一个形状。
 *
 *   Level_XX
 *   ├── Window            RoundedClip（GRAPHICS_STENCIL，radius 20）
 *   │   ├── Fill          集图
 *   │   └── Lock          黑色半透明，尺寸 = 内框，跟着同一层遮罩走
 *   ├── Frame
 *   └── Ribbon
 *
 *   node tools/exec.mjs scene tools/js/mount-card-clip.js '{"radius":20}'
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const content = canvas.getChildByName('Change').getChildByName('ScrollView').getChildByName('view').getChildByName('content');
const RoundedClip = cc.js.getClassByName('RoundedClip');
const radius = (args && args.radius) || 20;
const report = [];

for (const card of content.children) {
  const win = card.getChildByName('Window');
  if (!win) continue;
  const ui = win.getComponent(cc.UITransform);

  const old = win.getComponent(cc.Mask);
  if (old) win.removeComponent(old);
  const rc = win.getComponent(RoundedClip) || win.addComponent(RoundedClip);
  rc.radius = radius;
  rc.inset = 0;
  rc.apply();

  const lock = card.getChildByName('Lock');
  if (lock) {
    lock.setParent(win);
    const lu = lock.getComponent(cc.UITransform);
    lu.setContentSize(ui.width, ui.height);
    lu.setAnchorPoint(0.5, 0.5);
    lock.setPosition((0.5 - ui.anchorX) * ui.width, (0.5 - ui.anchorY) * ui.height, 0);
    lock.setSiblingIndex(win.children.length - 1);
  }
  report.push(card.name + ' mask=' + (win.getComponent(cc.Mask) ? win.getComponent(cc.Mask).type : 'none') + ' radius=' + rc.radius + ' lock=' + !!lock);
}
return report;
