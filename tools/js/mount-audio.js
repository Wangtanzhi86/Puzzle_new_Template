/**
 * 给 Canvas 上的 AudioManager 填一份起步的「音频配置」：
 *   - BGM：激活事件 NONE（常驻），首次点击屏幕后一直循环
 *   - 修复成功：激活事件 LEVEL_COMPLETE
 *
 *   node tools/exec.mjs scene tools/js/mount-audio.js
 *
 * 幂等：已经有配置就原样保留，不覆盖你在 Inspector 里改过的值。
 * 剩下的音效（拿起 / 吸附 / 失败…）在 Inspector 里加条目、拖资源即可，不用改代码。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const mgr = canvas.getComponent('AudioManager');
if (!mgr) return { ok: false, error: 'Canvas 上没有 AudioManager' };

if (mgr.cues.length) return { ok: true, existed: true, cues: mgr.cues.length };

const load = (uuid) => new Promise((resolve, reject) => {
  cc.assetManager.loadAny(uuid, (err, asset) => (err ? reject(new Error(uuid + ' -> ' + err.message)) : resolve(asset)));
});

const Cue = cc.js.getClassByName('AudioCue');
const bgm = new Cue();
bgm.event = 'NONE';
bgm.clip = await load('7c7f2630-4921-471e-b75a-1a78cabf310e');   // audio/bgm.mp3
bgm.volume = 0.6;
bgm.stopEvent = 'NONE';

const complete = new Cue();
complete.event = 'LEVEL_COMPLETE';
complete.clip = await load('52f22fad-b951-4a1c-b989-37e94db1d69d');   // audio/修复成功.mp3
complete.volume = 1;
complete.stopEvent = 'NONE';

mgr.cues = [bgm, complete];
return { ok: true, existed: false, cues: mgr.cues.map((c) => c.event + ' / ' + c.clip.name + ' / ' + c.volume + ' / ' + c.stopEvent) };
