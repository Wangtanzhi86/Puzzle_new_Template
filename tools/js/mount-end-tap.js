const canvas = cc.director.getScene().getChildByName('Canvas');
const cls = (n) => cc.js.getClassByName(n);
const carousel = canvas.getChildByName('UILayer').getChildByName('CtaLayer').getChildByName('CtaRoot').getChildByName('End').getChildByName('Carousel');
const burst = carousel.getChildByName('CenterBurst');
const p2 = burst.getComponent(cls('Particle2D'));
p2.totalParticles = 150;
p2.emissionRate = 1600;
p2.life = 0.7;
p2.lifeVar = 0.35;
p2.speed = 520;
p2.speedVar = 240;
p2.startSize = 48;
p2.startSizeVar = 24;
p2.endSize = 0;
p2.angleVar = 360;
p2.posVar.set(32, 44);
const cb = burst.getComponent(cls('CardBurst'));
cb.emitTime = 0.14;
burst.setSiblingIndex(0);
const comp = carousel.getComponent(cls('EndCarousel'));
comp.bridge = canvas.getComponent(cls('MraidBridge'));
comp.tapSlop = 14;
comp.tapToStore = true;
for (const c of carousel.children) if (c !== burst) c.setSiblingIndex(carousel.children.length - 1);
return {
  burstIndex: burst.getSiblingIndex(),
  bridge: !!comp.bridge,
  tapSlop: comp.tapSlop,
  tapToStore: comp.tapToStore,
  particle: { total: p2.totalParticles, rate: p2.emissionRate, life: p2.life, speed: p2.speed, speedVar: p2.speedVar, angle: p2.angle, angleVar: p2.angleVar, size: p2.startSize, sizeVar: p2.startSizeVar, posVar: [p2.posVar.x, p2.posVar.y] },
  emitTime: cb.emitTime,
};