const canvas = cc.director.getScene().getChildByName('Canvas');
const cls = (n) => cc.js.getClassByName(n);
const end = canvas.getChildByName('UILayer').getChildByName('CtaLayer').getChildByName('CtaRoot').getChildByName('End');
const carousel = end.getChildByName('Carousel');
const logo = end.getChildByName('文字标题');
const btn = end.getChildByName('btn');
const effect = await new Promise((res, rej) => cc.assetManager.loadAny('1dba367b-01d4-4797-ba38-81822904d13a', (e, a) => e ? rej(e) : res(a)));
let sw = end.getComponent(cls('EndSweep'));
if (!sw) sw = end.addComponent(cls('EndSweep'));
sw.sweepEffect = effect;
sw.logo = logo;
sw.button = btn;
sw.carousel = carousel.getComponent(cls('EndCarousel'));
if (sw.time === undefined) sw.time = 0.7;
if (sw.band === undefined) sw.band = 0.22;
if (sw.flash === undefined) sw.flash = 0.14;
if (sw.logoDelay === undefined) sw.logoDelay = 0.1;
if (sw.buttonDelay === undefined) sw.buttonDelay = 0.7;
if (sw.cardDelay === undefined) sw.cardDelay = 1.45;
if (sw.repeatGap === undefined) sw.repeatGap = 2.2;
return {
  effect: !!sw.sweepEffect, logo: sw.logo && sw.logo.name, button: sw.button && sw.button.name,
  carousel: !!sw.carousel, delays: [sw.logoDelay, sw.buttonDelay, sw.cardDelay], repeatGap: sw.repeatGap,
};