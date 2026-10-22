/**
 * 选关界面接线（配套 assets/scripts/ui/LevelSelect.ts）。
 *
 * 结构（重建 Canvas/Change 的全部子节点）：
 *
 *   Canvas/Change                    全屏 Widget + BlockInputEvents + LevelSelect
 *   ├── BG                           Sprite「背景图」，四边 Widget 撑满
 *   └── ScrollView                   上下留白 + 左右 24，纵向滚动
 *       └── view                     RECT Mask
 *           └── content              Layout = GRID（两列，宽度决定列数，高度自适应）
 *               ├── Level_01         按钮：Window(Mask) > Fill / Frame / Ribbon > Label
 *               └── ...
 *
 * 每个按钮三层（自下而上，与需求一致）：
 *   Window（RECT Mask，尺寸 = 框图的透明孔洞，集图只在孔里露）> Fill（第 N 集.jpg，等比 cover）
 *   Frame（框UI.png，铺满按钮）
 *   Ribbon（丝带UI.png，按钮底部居中）> Label（LEVEL 按位置编号，白字黑描边）
 *   未解锁的还多一层 Lock（黑色半透明，按钮 interactable = false），默认只亮第一关
 *
 * 片源 uuid 现取，不写死：
 *
 *   node tools/exec.mjs scene tools/js/mount-level-select.js "<argsJson>"
 *
 * args = { bg, frame, ribbon, hole: { x, y, w, h }, levels: [{ sf }] }；
 * hole 是框图中透明孔洞相对 SpriteFrame.rect 的比例（0..1，y 从上往下），
 * 换框图后要重新量（PIL 扫 alpha，见 docs/changes/2026-10-20-level-select-ui.md）；
 * sf 是 SpriteFrame 子资源 uuid（xxx@f9941），关卡顺序即数组顺序、编号即位置。
 * 每次跑都整棵重建，结果一样。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const change = canvas.getChildByName('Change');
const cls = (name) => cc.js.getClassByName(name);
const load = (uuid) => new Promise((res, rej) =>
  cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

const [bgSf, frameSf, ribbonSf] = await Promise.all([load(args.bg), load(args.frame), load(args.ribbon)]);
const hole = args.hole;
const whiteSf = canvas.getChildByName('UILayer').getChildByName('CtaLayer').getChildByName('CtaRoot')
  .getChildByName('End').getChildByName('bg').getComponent(cc.Sprite).spriteFrame;
const levelSfs = await Promise.all(args.levels.map((lv) => load(lv.sf)));

// ---------- 清空旧内容 ----------
for (const child of change.children.slice()) {
  child.removeFromParent();
  child.destroy();
}

// ---------- 尺寸 ----------
const CELL_W = 324;
const FRAME_RATIO = frameSf.rect.width / frameSf.rect.height;
const CELL_H = Math.round(CELL_W / FRAME_RATIO);
const RIBBON_W = Math.round(CELL_W * 0.86);
const RIBBON_H = Math.round(RIBBON_W * ribbonSf.rect.height / ribbonSf.rect.width);
const PAD = 24;
const GAP = 24;
const EDGE = 24;
const TOP = 90;
const BOTTOM = 90;

const stretch = (node, l, r, t, b) => {
  const w = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
  w.isAlignLeft = w.isAlignRight = w.isAlignTop = w.isAlignBottom = true;
  w.left = l; w.right = r; w.top = t; w.bottom = b;
  w.alignMode = cc.Widget.AlignMode.ALWAYS;
  return w;
};

// Change 自己：全屏 + 拦截穿透
let ct = change.getComponent(cc.UITransform);
if (!ct) ct = change.addComponent(cc.UITransform);
ct.setContentSize(720, 1280);
stretch(change, 0, 0, 0, 0);
if (!change.getComponent(cc.BlockInputEvents)) change.addComponent(cc.BlockInputEvents);

// ---------- 背景 ----------
const bg = new cc.Node('BG');
bg.setParent(change);
const bgt = bg.addComponent(cc.UITransform);
bgt.setContentSize(720, 1280);
const bgs = bg.addComponent(cc.Sprite);
bgs.sizeMode = cc.Sprite.SizeMode.CUSTOM;
bgs.spriteFrame = bgSf;
bgs.type = cc.Sprite.Type.SIMPLE;
stretch(bg, 0, 0, 0, 0);

// ---------- 滚动容器 ----------
const scroll = new cc.Node('ScrollView');
scroll.setParent(change);
scroll.addComponent(cc.UITransform).setContentSize(720 - EDGE * 2, 1280 - TOP - BOTTOM);
const sv = scroll.addComponent(cc.ScrollView);
sv.horizontal = false;
sv.vertical = true;
sv.inertia = true;
sv.elastic = true;
stretch(scroll, EDGE, EDGE, TOP, BOTTOM);

const view = new cc.Node('view');
view.setParent(scroll);
view.addComponent(cc.UITransform).setContentSize(720 - EDGE * 2, 1280 - TOP - BOTTOM);
const viewMask = view.addComponent(cc.Mask);
viewMask.type = cc.Mask.Type.RECT;
stretch(view, 0, 0, 0, 0);

const content = new cc.Node('content');
content.setParent(view);
const ctContent = content.addComponent(cc.UITransform);
ctContent.setAnchorPoint(0.5, 1);
ctContent.setContentSize(720 - EDGE * 2, 100);
// content 顶边必须跟着 view 走：锚点在顶，但 y 不能写死（写死的是 1280 稿的 viewH/2），
// 长屏 FIXED_WIDTH 把 view 拉高后 y 不变，首行就会往下坠。
// 用 ON_WINDOW_RESIZE 而不是 ALWAYS：只在画布策略变化时对齐一次，不跟 ScrollView 的滚动量打架。
const cw = content.addComponent(cc.Widget);
cw.isAlignTop = true;
cw.top = 0;
cw.isAlignBottom = false;
cw.isAlignVerticalCenter = false;
cw.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
const layout = content.addComponent(cc.Layout);
layout.type = cc.Layout.Type.GRID;
layout.startAxis = cc.Layout.AxisDirection.HORIZONTAL;
layout.resizeMode = cc.Layout.ResizeMode.CONTAINER;
layout.cellSize = new cc.Size(CELL_W, CELL_H);
layout.spacingX = GAP;
layout.spacingY = GAP;
layout.paddingTop = PAD;
layout.paddingBottom = PAD;
layout.constraint = cc.Layout.Constraint.NONE;
layout.affectedByScale = false;

sv.content = content;
sv.enabled = false; // 选关定版：不允许拖动

// ---------- 关卡按钮 ----------
const items = [];
let hw = 0;
let hh = 0;
args.levels.forEach((lv, i) => {
  const sf = levelSfs[i];
  const root = new cc.Node('Level_' + (i + 1 < 10 ? '0' : '') + (i + 1));
  root.setParent(content);
  const rt = root.addComponent(cc.UITransform);
  rt.setContentSize(CELL_W, CELL_H);
  const btn = root.addComponent(cc.Button);
  btn.transition = cc.Button.Transition.SCALE;
  btn.zoomScale = 0.96;
  btn.target = root;

  // 1) 显示范围：Mask 按框图的透明孔洞量出来（不是整格），集图只在孔里露
  hw = CELL_W * hole.w;
  hh = CELL_H * hole.h;
  const hx = (hole.x + hole.w / 2 - 0.5) * CELL_W;
  const hy = (0.5 - (hole.y + hole.h / 2)) * CELL_H;
  const win = new cc.Node('Window');
  win.setParent(root);
  win.addComponent(cc.UITransform).setContentSize(hw, hh);
  win.setPosition(hx, hy, 0);
  const mask = win.addComponent(cc.Mask);
  mask.type = cc.Mask.Type.RECT;

  const fill = new cc.Node('Fill');
  fill.setParent(win);
  const ft = fill.addComponent(cc.UITransform);
  const fs = fill.addComponent(cc.Sprite);
  fs.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  fs.spriteFrame = sf;
  fs.type = cc.Sprite.Type.SIMPLE;
  const os = sf.rect;
  const k = Math.max(CELL_W / os.width, CELL_H / os.height);
  ft.setContentSize(os.width * k, os.height * k);
  // 图仍按整格居中，补偿 Window 的孔洞偏移
  fill.setPosition(-hx, -hy, 0);

  // 2) 框
  const frame = new cc.Node('Frame');
  frame.setParent(root);
  frame.addComponent(cc.UITransform).setContentSize(CELL_W, CELL_H);
  const frs = frame.addComponent(cc.Sprite);
  frs.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  frs.spriteFrame = frameSf;
  frs.type = cc.Sprite.Type.SIMPLE;

  // 3) 丝带 + LEVEL 字样
  const ribbon = new cc.Node('Ribbon');
  ribbon.setParent(root);
  ribbon.addComponent(cc.UITransform).setContentSize(RIBBON_W, RIBBON_H);
  const rs = ribbon.addComponent(cc.Sprite);
  rs.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  rs.spriteFrame = ribbonSf;
  rs.type = cc.Sprite.Type.SIMPLE;
  ribbon.setPosition(0, -CELL_H / 2 + RIBBON_H * 0.45, 0);

  const text = new cc.Node('Label');
  text.setParent(ribbon);
  text.addComponent(cc.UITransform).setContentSize(RIBBON_W, RIBBON_H);
  const lb = text.addComponent(cc.Label);
  lb.string = 'LEVEL' + (i + 1);
  lb.useSystemFont = true;
  lb.fontSize = Math.round(RIBBON_H * 0.46);
  lb.lineHeight = Math.round(RIBBON_H * 0.5);
  lb.color = new cc.Color(0, 0, 0, 255);
  lb.isBold = true;
  lb.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
  lb.verticalAlign = cc.Label.VerticalAlign.CENTER;
  text.setPosition(0, 13, 0);

  // 4) 未解锁：盖一层黑色半透明，按钮不可点（默认只亮第一关）
  if (i > 0) {
    const lock = new cc.Node('Lock');
    lock.setParent(root);
    lock.addComponent(cc.UITransform).setContentSize(CELL_W, CELL_H);
    const ls = lock.addComponent(cc.Sprite);
    ls.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    ls.spriteFrame = whiteSf;
    ls.color = new cc.Color(0, 0, 0, 140);
    btn.interactable = false;
  }

  items.push(root);
});

// 编辑期就把格子摆好、content 高度撑开，别等运行期第一帧
layout.updateLayout();
const viewH = scroll.getComponent(cc.UITransform).height;
content.setPosition(0, viewH / 2, 0);

// ---------- 回填 LevelSelect ----------
let select = change.getComponent(cls('LevelSelect'));
if (!select) select = change.addComponent(cls('LevelSelect'));
select.items = items;
select.levelCount = items.length;

// ---------- 开局引导：手指在第一关上反复点 ----------
const srcFinger = canvas.getChildByName('UILayer').getChildByName('GuideLayer')
  .getChildByName('GuideRoot').getChildByName('GuideFinger');
const srcUi = srcFinger.getComponent(cc.UITransform);
const srcSprite = srcFinger.getComponent(cc.Sprite);
const guide = new cc.Node('Guide');
guide.setParent(change);
guide.addComponent(cc.UITransform).setContentSize(720, 1280);
stretch(guide, 0, 0, 0, 0);
const finger = new cc.Node('Finger');
finger.setParent(guide);
finger.addComponent(cc.UITransform).setContentSize(srcUi.width, srcUi.height);
finger.getComponent(cc.UITransform).setAnchorPoint(0.073, 0.970);
const fingerSprite = finger.addComponent(cc.Sprite);
fingerSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
fingerSprite.spriteFrame = srcSprite.spriteFrame;
finger.setScale(0.8, 0.8, 1);
finger.setPosition(80, 318, 0);
const guideComp = guide.addComponent(cls('LevelGuide'));
guideComp.target = items[0];
guideComp.finger = finger;
guideComp.scroll = scroll.getComponent(cc.ScrollView);

return {
  guide: { target: guideComp.target ? guideComp.target.name : null, finger: !!guideComp.finger, active: guide.active },
  levels: items.map((n) => n.name),
  total: items.length,
  cell: [CELL_W, CELL_H],
  ribbon: [RIBBON_W, RIBBON_H],
  scroll: { view: scroll.children.map((n) => n.name), content: content.children.length },
  label: items[0].getChildByName('Ribbon').getChildByName('Label').getComponent(cc.Label).string,
  window: [Math.round(hw), Math.round(hh)],
  locked: items.filter((n) => !!n.getChildByName('Lock')).length,
  changeChildren: change.children.map((n) => n.name),
};
