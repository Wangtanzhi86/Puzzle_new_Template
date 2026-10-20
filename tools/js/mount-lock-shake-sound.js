const canvas = cc.director.getScene().getChildByName('Canvas');
const cls = (n) => cc.js.getClassByName(n);
const am = canvas.getComponent(cls('AudioManager'));
am.select = canvas.getChildByName('Change').getComponent(cls('LevelSelect'));
const clip = await new Promise((res, rej) => cc.assetManager.loadAny('6bd6acf9-f3f9-497a-8af1-9f399d99cc29', (e, a) => e ? rej(e) : res(a)));
const CueClass = cls('AudioCue');
let cue = am.cues.find((c) => c.event === 'LOCK_SHAKE');
if (!cue) {
  cue = new CueClass();
  cue.event = 'LOCK_SHAKE';
  am.cues.push(cue);
}
cue.clip = clip;
cue.sequence = [];
cue.volume = 0.8;
cue.fadeIn = 0;
cue.fadeOut = 0;
cue.loop = false;
cue.loopGap = 0;
cue.stopEvent = 'NONE';
cue.stopSlot = -1;
return { cue: { event: cue.event, clip: cue.clip && cue.clip.name, volume: cue.volume }, cues: am.cues.map((c) => c.event), select: !!am.select };