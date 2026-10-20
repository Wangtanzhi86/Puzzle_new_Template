const canvas = cc.director.getScene().getChildByName('Canvas');
const carousel = canvas.getChildByName('UILayer').getChildByName('CtaLayer').getChildByName('CtaRoot').getChildByName('End').getChildByName('Carousel');
const out = [];
for (const card of carousel.children) {
  const clip = card.getChildByName('Clip');
  if (!clip) continue;
  const img = clip.getChildByName('Image');
  const sp = img.getComponent(cc.Sprite);
  const sf = sp.spriteFrame;
  const cw = clip.getComponent(cc.UITransform).width;
  const ch = clip.getComponent(cc.UITransform).height;
  sp.sizeMode = cc.Sprite.SizeMode.TRIMMED;
  const r = sf.rect;
  const k = Math.max(cw / r.width, ch / r.height);
  img.setScale(k, k, 1);
  img.setPosition(0, 0, 0);
  const ui = img.getComponent(cc.UITransform);
  out.push(card.name + ' ' + sf.name + ' rect ' + r.width.toFixed(0) + 'x' + r.height.toFixed(0) + ' -> ' + (ui.width * k).toFixed(0) + 'x' + (ui.height * k).toFixed(0) + ' k=' + k.toFixed(3));
}
return out;