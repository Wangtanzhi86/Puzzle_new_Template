/**
 * 选关卡片第二轮：内框上移 10、锁层透明度降到 85、每张卡中间加一个锁图标。
 *
 *   Level_XX
 *   └── Window           y += 10；RoundedClip 遮罩
 *       ├── Fill
 *       ├── Lock         rgba(0,0,0,85)
 *       └── LockIcon     suo.png，居中、按内框高度的 55% 缩放
 *
 *   node tools/exec.mjs scene tools/js/mount-card-clip.js   # 先跑那次（遮罩 + Lock 归位）
 *   node tools/exec.mjs scene tools/js/mount-card-lock-icon.js
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const content = canvas.getChildByName('Change').getChildByName('ScrollView').getChildByName('view').getChildByName('content');
const SF_UUID = '48fef97f-d003-4214-9d07-84d7b4e26be3@f9941';
const sf = await new Promise((res, rej) => cc.assetManager.loadAny(SF_UUID, (e, a) => (e ? rej(new Error(SF_UUID + ' -> ' + e.message)) : res(a))));
const report = [];

for (const card of content.children) {
  const win = card.getChildByName('Window');
  if (!win) continue;
  const ui = win.getComponent(cc.UITransform);

  const wp = win.position;
  win.setPosition(wp.x, wp.y + 10, wp.z);

  const lock = win.getChildByName('Lock');
  if (lock) lock.getComponent(cc.Sprite).color = new cc.Color(0, 0, 0, 85);

  let icon = win.getChildByName('LockIcon');
  if (!icon) {
    icon = new cc.Node('LockIcon');
    win.addChild(icon);
    icon.addComponent(cc.UITransform);
    icon.addComponent(cc.Sprite);
  }
  const iu = icon.getComponent(cc.UITransform);
  const sp = icon.getComponent(cc.Sprite);
  sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  sp.spriteFrame = sf;
  iu.setContentSize(sf.rect.width, sf.rect.height);
  iu.setAnchorPoint(0.5, 0.5);
  icon.setPosition((0.5 - ui.anchorX) * ui.width, (0.5 - ui.anchorY) * ui.height, 0);
  const k = Math.min((ui.width * 0.55) / sf.rect.width, (ui.height * 0.55) / sf.rect.height);
  icon.setScale(k, k, 1);
  icon.setSiblingIndex(win.children.length - 1);

  report.push(card.name + ' y=' + win.position.y.toFixed(1) + ' lockA=' + (lock ? lock.getComponent(cc.Sprite).color.a : -1) + ' icon=' + sf.rect.width + 'x' + sf.rect.height + '@' + k.toFixed(2));
}
return report;
