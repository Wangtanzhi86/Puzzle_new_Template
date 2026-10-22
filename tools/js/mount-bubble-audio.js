/**
 * 三个剧情气泡的音效接线（气泡1 / 气泡2 / 气泡3）。
 * 在 Canvas/AudioManager 的「音频配置」里补三条 cue：
 *   激活事件 = BUBBLE_SHOW，激活事件的槽位 = 1 / 2 / 3，音效 = 同名 mp3。
 * 已有同槽位的 BUBBLE_SHOW 条目就跳过，不覆盖 Inspector 里改过的音量。
 *
 *   node tools/exec.mjs scene tools/js/mount-bubble-audio.js
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const audio = canvas.getComponent('AudioManager');
const AudioCueClass = cc.js.getClassByName('AudioCue') || audio.cues[0].constructor;
const specs = [
  { index: 1, uuid: '3249bbba-19c3-42f3-9764-3b2f28d0a60a', name: '气泡1' },
  { index: 2, uuid: '4b341db6-bae2-4e04-974b-8e94b904427d', name: '气泡2' },
  { index: 3, uuid: '9b310155-54f1-4898-87e1-9d88c348a915', name: '气泡3' },
];
const loadClip = (uuid) => new Promise((res, rej) =>
  cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))),
);
const added = [];
for (const spec of specs) {
  if (audio.cues.some((c) => c.event === 'BUBBLE_SHOW' && c.startSlot === spec.index)) continue;
  const clip = await loadClip(spec.uuid);
  const cue = new AudioCueClass();
  cue.event = 'BUBBLE_SHOW';
  cue.clip = clip;
  cue.startSlot = spec.index;
  cue.volume = 1;
  audio.cues.push(cue);
  added.push({ index: spec.index, clip: clip.name });
}
return { added, total: audio.cues.length };