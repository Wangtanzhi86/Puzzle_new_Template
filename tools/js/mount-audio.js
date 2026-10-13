/**
 * 给 Canvas 上的 AudioManager 铺一份标准的「音频配置」：
 *   常驻组（激活事件选 NONE，首次点击屏幕后一直循环）
 *     · qiuribgm    —— BGM
 *     · 火焰燃烧    —— 火节点隐藏（`FIRE_HIDE`）那刻停
 *     · 女人哭      —— 一轮播完渐出、空 3s 再渐入（`loopGap`），第 6 格露面（`PIECE_SHOWN` 且 `stopSlot = 6`）那刻停
 *   一次性
 *     · 贴纸 · 吸附成功 / 修理 · 修复效果亮出（循环，收掉停）/ 灭火 · 换成喷射图
 *     · 瓶子摇晃 · 灭火器开始上下摇晃   / 成功 · 结束界面下落
 *
 *   node tools/exec.mjs scene tools/js/mount-audio.js
 *
 * ⚠️ 重跑会把整张表复位成这份基线（Inspector 里调过的音量 / 渐入渐出会丢）。
 *
 * 三条不用事件的音效不用在这儿额外做什么：吸附成功走 `PIECE_SNAP_SUCCESS`，灭火那一枪与
 * 「修复效果」亮出分别由 `ExtinguishAction` 抛 `EXTINGUISH_SPRAY`、`HammerAction` 抛 `REPAIR_FX`
 * （收掉再抛 `REPAIR_FX_HIDE` 把那声循环停住），摇晃与火灭由 `ExtinguishAction` 抛
 * `EXTINGUISH_SHAKE` / `FIRE_HIDE`，配置表照旧绑事件名。
 *
 * 「成功」绑的是 `END_DROP`（结束界面 logo 开始下落）而不是 `LEVEL_COMPLETE`：
 * 后者紧跟着 `SceneBgSwap` 的 0.9s 扩散 + `END_SHOW`，而 `END_SHOW` 会把全部音停掉，
 * 挂在它上面的那声只响得到 0.9 秒。`END_DROP` 是 `AudioManager` 明确放行的例外（§8.4）。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const mgr = canvas.getComponent('AudioManager');
if (!mgr) return { ok: false, error: 'Canvas 上没有 AudioManager' };

const load = (uuid) => new Promise((resolve, reject) => {
  cc.assetManager.loadAny(uuid, (err, asset) => (err ? reject(new Error(uuid + ' -> ' + err.message)) : resolve(asset)));
});

const Cue = cc.js.getClassByName('AudioCue');
/** 一条 = 激活事件 / 音效 uuid / 音量 / 渐入 / 渐出 / 循环 / 循环间隔 / 结束事件 / 结束事件只认第几格 */
const LAYOUT = [
  ['NONE', '0d02035d-23a4-4721-b04b-c056ee0abac5', 0.6, 0.3, 0.3, false, 0, 'NONE', 0],         // audio/qiuribgm.mp3
  ['NONE', '19ee332a-d96d-410c-8522-a84464edaf81', 0.7, 0.3, 0.3, false, 0, 'FIRE_HIDE', 0],     // audio/火焰燃烧.mp3：一开局就在烧，火灭了停
  ['NONE', 'c97358cc-fb86-4091-b2e1-8893e1d2f419', 0.7, 0.3, 0.3, false, 3, 'PIECE_SHOWN', 6],   // audio/女人哭.MP3：一轮播完渐出、空 3s 再渐入，第 6 格露面那刻停
  ['PIECE_SNAP_SUCCESS', 'ccaf8210-0014-42d3-8abb-dc67147efefc', 1, 0, 0, false, 0, 'NONE', 0], // audio/贴纸.mp3
  ['REPAIR_FX', 'a98dc446-842a-4d36-97c0-ad80f2914c61', 1, 0, 0, true, 0, 'REPAIR_FX_HIDE', 0],  // audio/修理.mp3：跟着「修复效果」一直循环，收掉那一刻停
  ['EXTINGUISH_SPRAY', 'a8e3f6c2-e15d-42b0-b060-0e26f89bcf5b', 1, 0, 0, false, 0, 'NONE', 0],   // audio/灭火.mp3
  ['EXTINGUISH_SHAKE', 'd80d9b4b-a341-4d34-be6e-954c5f0fcbd6', 1, 0, 0, false, 0, 'NONE', 0],   // audio/瓶子摇晃.MP3
  ['END_DROP', '02f29bad-a794-4a4e-ad78-d0fe95b74905', 1, 0, 0, false, 0, 'NONE', 0],           // audio/成功.mp3
];

const cues = [];
for (const [event, uuid, volume, fadeIn, fadeOut, loop, loopGap, stopEvent, stopSlot] of LAYOUT) {
  const cue = new Cue();
  cue.event = event;
  cue.clip = await load(uuid);
  cue.volume = volume;
  cue.fadeIn = fadeIn;
  cue.fadeOut = fadeOut;
  cue.loop = loop;
  cue.loopGap = loopGap;
  cue.stopEvent = stopEvent;
  cue.stopSlot = stopSlot;
  cues.push(cue);
}
mgr.cues = cues;
return { ok: true, cues: mgr.cues.map((c) => c.event + ' / ' + c.clip.name + ' / ' + c.volume) };
