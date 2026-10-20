/**
 * 结束界面：标题 / 卡片带 / 商店按钮 / PLAY NOW 的排版 + 卡片圆角裁剪。
 *
 *   End
 *   ├── bg
 *   ├── Carousel                 720×600 @ y=70
 *   │   └── Card_01..Card_10     280×352：Glow_3/2/1（Graphics 圆角描边，由宽到窄叠光晕）+ Clip 裁圆角 > Image + Stroke_1 白框
 *   │       ├── Clip             挂 RoundedClip（Mask GRAPHICS_STENCIL，圆角裁掉方角）> Image
 *   │       └── Stroke_3/2/1     白色圆角描边（由粗到细）
 *   ├── 文字标题
 *   ├── Stores                   两个商店按钮（Google / App Store）
 *   ├── btn                       PLAY NOW
 *   ├── TitleSparkles / BtnSparkles
 *
 *   node tools/exec.mjs scene tools/js/mount-end-carousel.js '{"items":[...],"google":"...","apple":"..."}'
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const end = canvas.getChildByName('UILayer').getChildByName('CtaLayer').getChildByName('CtaRoot').getChildByName('End');
const cls = (name) => cc.js.getClassByName(name);
const load = (uuid) => new Promise((res, rej) =>
  cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

const roundSf = canvas.getChildByName('UILayer').getChildByName('CtaLayer').getChildByName('CtaRoot')
  .getChildByName('Fail').getChildByName('btn').getChildByName('Img').getComponent(cc.Sprite).spriteFrame;
const sfs = await Promise.all(args.items.map((u) => load(u)));
const googleSf = args.google ? await load(args.google) : null;
const appleSf = args.apple ? await load(args.apple) : null;

const CARD_W = 240;
const CARD_H = 400;
const RADIUS = 30;

const bgSprite = end.getChildByName('bg') && end.getChildByName('bg').getComponent(cc.Sprite);
if (bgSprite) bgSprite.color = new cc.Color(38, 29, 26, 255);

['Carousel', 'Stores', 'TitleSparkles', 'BtnSparkles'].forEach((n) => {
  const old = end.getChildByName(n);
  if (!old) return;
  old.removeFromParent();
  old.destroy();
});

const carousel = new cc.Node('Carousel');
carousel.setParent(end);
carousel.setSiblingIndex(1);
carousel.addComponent(cc.UITransform).setContentSize(720, 600);
carousel.setPosition(0, 70, 0);

const cards = sfs.map((sf, i) => {
  const card = new cc.Node('Card_' + String(i + 1).padStart(2, '0'));
  card.setParent(carousel);
  card.addComponent(cc.UITransform).setContentSize(CARD_W, CARD_H);

  const halo = (name, width, opacity, rings, spread, power) => {
    const g = new cc.Node(name);
    g.setParent(card);
    g.addComponent(cc.UITransform).setContentSize(CARD_W, CARD_H);
    g.addComponent(cc.Graphics);
    const rf = g.addComponent(cls('RoundedFrame'));
    rf.width = width;
    rf.radius = RADIUS;
    rf.glowRings = rings;
    rf.glowSpread = spread;
    rf.glowPower = power;
    g.addComponent(cc.UIOpacity).opacity = opacity;
  };
  halo('Glow_3', 3, 40, 6, 46, 0.9);
  halo('Glow_2', 3, 90, 4, 24, 1);
  halo('Glow_1', 4, 190, 3, 10, 1);

  const clip = new cc.Node('Clip');
  clip.setParent(card);
  clip.addComponent(cc.UITransform).setContentSize(CARD_W, CARD_H);
  clip.addComponent(cc.Graphics);
  clip.addComponent(cc.Mask).type = cc.Mask.Type.GRAPHICS_STENCIL;
  const rc = clip.addComponent(cls('RoundedClip'));
  rc.radius = RADIUS;
  rc.inset = 1;

  const img = new cc.Node('Image');
  img.setParent(clip);
  img.addComponent(cc.UITransform);
  const isp = img.addComponent(cc.Sprite);
  isp.sizeMode = cc.Sprite.SizeMode.TRIMMED;
  isp.spriteFrame = sf;
  // TRIMMED 会把节点尺寸改成图片原尺寸；再按「等比铺满」缩回卡片框（不再横向拉扁）
  const r = sf.rect;
  const k = Math.max(CARD_W / r.width, CARD_H / r.height);
  img.setScale(k, k, 1);
  img.setPosition(0, 0, 0);

  const stroke = (name, width, rgba) => {
    const f = new cc.Node(name);
    f.setParent(card);
    f.addComponent(cc.UITransform).setContentSize(CARD_W, CARD_H);
    f.addComponent(cc.Graphics);
    const rf = f.addComponent(cls('RoundedFrame'));
    rf.width = width;
    rf.radius = RADIUS;
  };
  stroke('Stroke_1', 2, [255, 255, 255, 255]);

  return card;
});

const sparkSf = args.spark ? await load(args.spark) : null;
const fxEffect = args.effect ? await load(args.effect) : null;

const burst = new cc.Node('CenterBurst');
burst.setParent(carousel);
burst.addComponent(cc.UITransform).setContentSize(240, 400);
const p2 = burst.addComponent(cls('Particle2D'));
p2.spriteFrame = sparkSf;
p2.additive = !!fxEffect;
p2.additiveEffect = fxEffect;
p2.playOnLoad = false;
p2.totalParticles = 150;
p2.emissionRate = 1600;
p2.life = 0.7;
p2.lifeVar = 0.35;
p2.angle = 90;
p2.angleVar = 360; // 2.x 语义：angle + angleVar/2 * rand(-1..1)，360 才是整圈
p2.speed = 520;
p2.speedVar = 240;
p2.startSize = 48;
p2.startSizeVar = 24;
p2.endSize = 0;
p2.startColor = new cc.Color(255, 246, 214, 255);
p2.endColor = new cc.Color(255, 246, 214, 0);
p2.posVar = new cc.Vec2(32, 44);
const burstComp = burst.addComponent(cls('CardBurst'));
burstComp.fx = p2;
burstComp.emitTime = 0.14;
burst.setSiblingIndex(0); // 卡片按 layout 从 1 开始排，这一层永远在最后面

const comp = carousel.addComponent(cls('EndCarousel'));
comp.items = cards;
comp.burst = burstComp;
comp.tapSlop = 14;
comp.tapToStore = true;
comp.bridge = canvas.getComponent(cls('MraidBridge'));

// ---------- 两个商店按钮 ----------
const stores = new cc.Node('Stores');
stores.setParent(end);
stores.setSiblingIndex(3);
stores.addComponent(cc.UITransform).setContentSize(560, 80);
stores.setPosition(0, -286, 0);

const bridge = canvas.getComponent(cls('MraidBridge'));
const badge = (name, sf, x, android) => {
  if (!sf) return null;
  const n = new cc.Node(name);
  n.setParent(stores);
  n.setPosition(x, 0, 0);
  n.addComponent(cc.UITransform).setContentSize(262, 74);
  const sp = n.addComponent(cc.Sprite);
  sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  sp.spriteFrame = sf;
  n.addComponent(cc.Button);
  const sb = n.addComponent(cls('StoreButton'));
  sb.bridge = bridge;
  sb.android = android;
  return n;
};
badge('Google', googleSf, -140, true);
badge('Apple', appleSf, 140, false);

// ---------- PLAY NOW 位置 ----------
const title = end.getChildByName('文字标题');
const btn = end.getChildByName('btn');
if (btn) btn.setPosition(0, -502, 0);

// ---------- 标题 / 按钮的粒子 ----------
const sparkles = (name, x, y, w, h, count) => {
  const n = new cc.Node(name);
  n.setParent(end);
  n.setPosition(x, y, 0);
  n.addComponent(cc.UITransform).setContentSize(w, h);
  const sp = n.addComponent(cls('Sparkles'));
  sp.dot = roundSf;
  sp.areaWidth = w;
  sp.areaHeight = h;
  sp.count = count;
  return n;
};
const titleSparkles = sparkles('TitleSparkles', title ? title.position.x : 0, title ? title.position.y : 484, 700, 300, 14);
titleSparkles.getComponent(cls('Sparkles')).downward = true;
sparkles('BtnSparkles', btn ? btn.position.x : 0, btn ? btn.position.y : -502, 720, 220, 16);

return {
  carousel: { pos: [carousel.position.x, carousel.position.y], size: [720, 600] },
  cards: cards.length,
  endChildren: end.children.map((c) => c.name),
  stores: stores.children.map((c) => c.name),
  btnPos: btn ? [btn.position.x, btn.position.y] : null,
  endActive: end.active,
};
