/**
 * 给 Canvas 上的 AudioManager 配好「音频配置」这张表：
 *
 *   1. 空灵背景     激活事件 NONE（常驻）—— 一直无缝循环，当 BGM
 *   2. 女主哭泣     激活事件 NONE（常驻）+ 循环间隔 —— 哭一段、静几秒、再哭
 *   3. 音阶 1-6     激活事件 PIECE_SNAP_SUCCESS + 顺序音效列表 —— 每修好一块换下一个音
 *   4. 风铃         激活事件 LEVEL_COMPLETE —— 全部修完那一下（见 CLAUDE.md §17「胜利风铃」）
 *   5. 按压音效     激活事件 BUTTON_DOWN + `buttons` —— 三颗 CTA 按下去那一刻
 *
 * 顺带把 `AudioManager.buttons` 指到三颗 CTA 节点上（`BUTTON_DOWN` 那条听的就是它们的 `TOUCH_START`）。
 *
 *   node tools/exec.mjs scene tools/js/mount-audio.js
 *
 * 幂等：逐条按「激活事件 / 音效」认已有的条目，认到的**一个字不碰**（Inspector 里调过的值不会被冲掉），
 * 只补缺的那几条。原来那条 `PIECE_SNAP_SUCCESS / 贴纸.mp3` 会被就地改造成第 3 条（音阶列表）。
 */

const UUID = {
    空灵背景: '2b893362-b26f-4d48-a4ae-82cc5029029e',
    女主哭泣: 'ede486ed-b79c-496a-9774-5a024ca76050',
    音阶: [
        'd4f52dac-8c30-4aaf-a40c-020ac6f980e1',
        'a4c922c1-824a-47cb-b605-94a65b60c630',
        '28e4926e-39f1-4159-8234-b05ec7f984af',
        '53ddb29f-78fb-484f-bc32-6c7c53857b5e',
        'b8bd213f-4119-4aeb-8b4b-c28fedf26a4f',
        '01b7fbcb-3ce6-4005-9897-1cc667491f91',
    ],
    风铃: 'add1578d-4621-4284-b1c8-9c170a783ba6',
    按压音效: '42a13197-5c85-411b-a32d-cbedfd57e917',
};

const canvas = cc.director.getScene().getChildByName('Canvas');
const mgr = canvas.getComponent('AudioManager');
if (!mgr) return { ok: false, error: 'Canvas 上没有 AudioManager' };

const load = (uuid) => new Promise((resolve, reject) => {
    cc.assetManager.loadAny(uuid, (err, asset) => (err ? reject(new Error(uuid + ' -> ' + err.message)) : resolve(asset)));
});

const Cue = cc.js.getClassByName('AudioCue');
const cues = mgr.cues.slice();
const taken = new Set();

/** 认一条已有的：按激活事件（+ 音效）匹配，认到就不在场景里重配它 */
function claim(pred) {
    for (let i = 0; i < cues.length; i++) {
        if (taken.has(i) || !pred(cues[i])) continue;
        taken.add(i);
        return cues[i];
    }
    return null;
}

const sameClip = (cue, uuid) => !!cue.clip && cue.clip._uuid === uuid;
const notes = [];

// 1. 空灵背景：常驻 BGM。已经有就原样留着（音量 / 渐入渐出按你在 Inspector 里调的来）
let cue = claim((c) => c.event === 'NONE' && sameClip(c, UUID.空灵背景));
if (cue) notes.push('空灵背景 / 已有，未改动');
else {
    cue = new Cue();
    cue.event = 'NONE';
    cue.clip = await load(UUID.空灵背景);
    cue.volume = 0.6;
    cue.fadeIn = 0.3;
    cue.fadeOut = 0.3;
    cues.push(cue);
    notes.push('空灵背景 / 新建');
}

// 2. 女主哭泣：常驻 + 遍与遍之间留间隔。渐入渐出各 1 秒，静 3 秒再哭
cue = claim((c) => c.event === 'NONE' && sameClip(c, UUID.女主哭泣));
if (cue) notes.push('女主哭泣 / 已有，未改动');
else {
    cue = new Cue();
    cue.event = 'NONE';
    cue.clip = await load(UUID.女主哭泣);
    cue.volume = 0.8;
    cue.fadeIn = 1;
    cue.fadeOut = 1;
    cue.loopGap = 3;
    cues.push(cue);
    notes.push('女主哭泣 / 新建（渐入 1s、渐出 1s、间隔 3s）');
}

// 3. 音阶 1-6：每修好一块换下一个音（原来是 贴纸.mp3，就地改造成顺序列表）
cue = claim((c) => c.event === 'PIECE_SNAP_SUCCESS');
if (!cue) {
    cue = new Cue();
    cue.event = 'PIECE_SNAP_SUCCESS';
    cues.push(cue);
}
cue.clip = null;
cue.volume = 1;
cue.fadeIn = 0;
cue.fadeOut = 0;
cue.sequence = await Promise.all(UUID.音阶.map(load));
notes.push('音阶 1-6 / ' + (cue.sequence.length) + ' 条');

// 4. 风铃：全部修完（LEVEL_COMPLETE）。它跟跳商店同拍，`AudioManager` 里给这条开了
//    「不随关场停全部停」的口子，见 AudioManager.POST_OVER
cue = claim((c) => c.event === 'LEVEL_COMPLETE');
if (cue) notes.push('风铃 / 已有，未改动');
else {
    cue = new Cue();
    cue.event = 'LEVEL_COMPLETE';
    cue.clip = await load(UUID.风铃);
    cue.volume = 1;
    cues.push(cue);
    notes.push('风铃 / 新建');
}

// 5. 按压音效：按下按钮那一瞬。走 TOUCH_START 而不是 CTA_CLICK —— CLICK 是松手才发，
//    而 `openStore()` 排在它前面，等它响时商店已经在开了
cue = claim((c) => c.event === 'BUTTON_DOWN');
if (!cue) {
    cue = new Cue();
    cue.event = 'BUTTON_DOWN';
    cues.push(cue);
}
cue.clip = await load(UUID.按压音效);
cue.sequence = [];
cue.volume = 1;
cue.fadeIn = 0;
cue.fadeOut = 0;
notes.push('按压音效 / button_down');

mgr.cues = cues;
mgr.buttons = [
    canvas.getChildByName('GameCta'),
    canvas.getChildByPath('UILayer/CtaLayer/CtaRoot/End/btn'),
    canvas.getChildByPath('UILayer/CtaLayer/CtaRoot/Fail/btn'),
].filter(Boolean);

return {
    ok: true,
    buttons: mgr.buttons.map((b) => b.name),
    cues: mgr.cues.map((c) => [
        c.event,
        c.sequence.length ? '音阶列表×' + c.sequence.length : (c.clip ? c.clip.name : '！！没音效'),
        c.volume,
        '渐入渐出 ' + c.fadeIn + 's→' + c.fadeOut + 's',
        '间隔 ' + c.loopGap + 's',
    ].join(' | ')),
    notes,
};
