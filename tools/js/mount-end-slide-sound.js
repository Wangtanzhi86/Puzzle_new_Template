const canvas = cc.director.getScene().getChildByName('Canvas');
const cls = (n) => cc.js.getClassByName(n);
const am = canvas.getComponent(cls('AudioManager'));
const carousel = canvas.getChildByName('UILayer').getChildByName('CtaLayer').getChildByName('CtaRoot').getChildByName('End').getChildByName('Carousel');
const comp = carousel.getComponent(cls('EndCarousel'));
if (comp.friction === undefined) comp.friction = 3.4;
if (comp.stopVel === undefined) comp.stopVel = 0.7;
if (comp.snapTime === undefined) comp.snapTime = 0.2;
am.carousel = comp;
const clip = await new Promise((res, rej) => cc.assetManager.loadAny('b518f260-b5c3-47d0-b8a7-14ea3dfc9967', (e, a) => e ? rej(e) : res(a)));
const CueClass = cls('AudioCue');
am.cues = am.cues.filter((c) => c.event !== 'CAROUSEL_STOP');
let cue = am.cues.find((c) => c.event === 'CAROUSEL_SLIDE');
if (!cue) {
  cue = new CueClass();
  cue.event = 'CAROUSEL_SLIDE';
  am.cues.push(cue);
}
cue.clip = clip;
cue.sequence = [];
cue.volume = 0.7;
cue.fadeIn = 0.04;
cue.fadeOut = 0.06;
cue.loop = true;
cue.loopGap = 0;
cue.stopEvent = 'NONE';
cue.stopSlot = -1;
return {
  cue: { event: cue.event, volume: cue.volume, loop: cue.loop, fadeIn: cue.fadeIn, fadeOut: cue.fadeOut, clip: cue.clip && cue.clip.name },
  cues: am.cues.map((c) => c.event),
  carousel: !!am.carousel,
  drag: { friction: comp.friction, stopVel: comp.stopVel, snapTime: comp.snapTime },
};