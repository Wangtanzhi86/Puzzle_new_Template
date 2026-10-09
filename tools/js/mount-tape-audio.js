/**
 * 给 Canvas 上的 AudioManager 追加一条「撕胶带」配置：激活事件 TAPE_REVEAL、音效 撕胶带.mp3。
 *
 *   node tools/exec.mjs scene tools/js/mount-tape-audio.js
 *
 * 幂等：已经有一条 TAPE_REVEAL 就原样保留，不覆盖你在 Inspector 里改过的值。
 * 其余条目（BGM / 修复成功…）一个字都不碰。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const mgr = canvas.getComponent('AudioManager');
if (!mgr) return { ok: false, error: 'Canvas 上没有 AudioManager' };

if (mgr.cues.some((c) => c.event === 'TAPE_REVEAL')) return { ok: true, existed: true };

const clip = await new Promise((resolve, reject) => {
  cc.assetManager.loadAny('b2b578ae-d3e4-46f8-ba38-61c249ac4382', (err, asset) => (err ? reject(new Error(err.message)) : resolve(asset)));
});

const Cue = cc.js.getClassByName('AudioCue');
const cue = new Cue();
cue.event = 'TAPE_REVEAL';
cue.clip = clip;
cue.volume = 1;
cue.stopEvent = 'NONE';

mgr.cues = mgr.cues.concat([cue]);
return { ok: true, existed: false, cues: mgr.cues.map((c) => c.event + ' / ' + (c.clip ? c.clip.name : 'null') + ' / ' + c.volume) };
