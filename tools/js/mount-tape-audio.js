/**
 * 给 Canvas/AudioManager 追加「贴胶带」那一条音效：
 * 激活事件 TAPE_STRIP、音效 撕胶带.mp3、音量 1、不渐入渐出。
 *
 * TAPE_STRIP 由 gameplay/TapeWipe.ts 在每条胶带开始擦出的那一瞬抛出，
 * 所以胶带根节点下有几条子节点，就响几次（当前 3 条）。
 *
 *   node tools/exec.mjs scene tools/js/mount-tape-audio.js
 *
 * 幂等：已经有 TAPE_STRIP 条目就原样保留（只补它没拖音效的情况），
 * 其余条目一个字不碰。
 */

const UUID = 'b2b578ae-d3e4-46f8-ba38-61c249ac4382'; // 撕胶带.mp3

const canvas = cc.director.getScene().getChildByName('Canvas');
const mgr = canvas && canvas.getComponent('AudioManager');
if (!mgr) return { ok: false, error: 'Canvas 上没有 AudioManager' };

const load = (uuid) => new Promise((resolve, reject) => {
    cc.assetManager.loadAny(uuid, (err, asset) => (err ? reject(new Error(uuid + ' -> ' + err.message)) : resolve(asset)));
});

const cues = mgr.cues.slice();
let cue = cues.find((c) => c.event === 'TAPE_STRIP');
let note;
if (cue) {
    if (cue.clip) {
        note = '贴胶带 / 已有，未改动';
    } else {
        cue.clip = await load(UUID);
        note = '贴胶带 / 已有但没音效，补上 撕胶带';
    }
} else {
    const Cue = cc.js.getClassByName('AudioCue');
    cue = new Cue();
    cue.event = 'TAPE_STRIP';
    cue.clip = await load(UUID);
    cue.volume = 1;
    cue.fadeIn = 0;
    cue.fadeOut = 0;
    cues.push(cue);
    note = '贴胶带 / 新建';
}

mgr.cues = cues;
return {
    ok: true,
    note,
    cues: mgr.cues.map((c) => [
        c.event,
        c.sequence.length ? '顺序列表×' + c.sequence.length : (c.clip ? c.clip.name : '！！没音效'),
        c.volume,
        '渐入渐出 ' + c.fadeIn + 's→' + c.fadeOut + 's',
    ].join(' | ')),
};