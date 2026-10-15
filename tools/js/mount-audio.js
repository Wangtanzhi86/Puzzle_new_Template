/**
 * 给 Canvas 上的 AudioManager 配好「音频配置」这张表：
 *
 *   1. 背景垫乐    激活事件 NONE（常驻）—— 一直循环，当 BGM
 *   2. 拿起碎片    激活事件 PIECE_PICK —— 贴纸.mp3（揭角那一下）
 *   3. 放置碎片    激活事件 PIECE_SNAP_SUCCESS —— 放置音.mp3。**不再用音阶 1-6 的顺序列表**
 *   4. 自动打关    激活事件 AUTO_PLAY + 结束事件 GAME_OVER +「循环播放」—— 整段接管期间一直循环，
 *                  起播渐入、停下渐出（见 AudioManager 的 `AUTO_SILENT`：那一段里 2 / 3 两条不响）
 *   5. 魔法光粒    激活事件「最后一格露面」+ 魔法光粒.mp3 —— 完成背景那支画笔开演那一下
 *   6. 按压音效    激活事件 BUTTON_DOWN + `buttons` —— 三颗 CTA 按下去那一刻
 *
 * 顺带把 `AudioManager.buttons` 指到三颗 CTA 节点上（`BUTTON_DOWN` 那条听的就是它们的 `TOUCH_START`）。
 *
 *   node tools/exec.mjs scene tools/js/mount-audio.js
 *
 * 幂等：逐条按「激活事件」认已有的条目，认到的尽量不动（音量 / 渐入渐出这类你在 Inspector 里调过的值
 * 不会被冲掉）；只有「这条必须绑哪个音效 / 开不开循环」是这里说了算。
 * 前一版那条 `PIECE_SNAP_SUCCESS / 音阶 1-6` 会被就地改造成第 3 条（音效换成放置音、清掉顺序列表）。
 */

const UUID = {
    背景垫乐: '412e5f7e-d645-4869-8f93-50e6f300f5cf',
    贴纸: 'ccaf8210-0014-42d3-8abb-dc67147efefc',
    放置音: '6bd6acf9-f3f9-497a-8af1-9f399d99cc29',
    自动打关: '414d9662-6b17-4ebc-9fc3-291900c6d874',
    魔法光粒: 'b58ef6cb-435b-4f6b-aa4d-ce763b322e41',
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

/** 认一条已有的：按激活事件匹配，认到就不在场景里重配它 */
function claim(event) {
    for (let i = 0; i < cues.length; i++) {
        if (taken.has(i) || cues[i].event !== event) continue;
        taken.add(i);
        return cues[i];
    }
    return null;
}

/** 认一条、没有就新建。返回的 `existing` 决定要不要动它 —— 已有的一条只在「音效必须换成哪个」上重配 */
function cueFor(event) {
    let cue = claim(event);
    const existing = !!cue;
    if (!cue) {
        cue = new Cue();
        cue.event = event;
        cues.push(cue);
    }
    return { cue, existing };
}

const notes = [];

// 1. 背景垫乐：常驻 BGM。已经有就原样留着（音量 / 渐入渐出按你在 Inspector 里调的来）
{
    const { cue, existing } = cueFor('NONE');
    if (existing) notes.push('背景垫乐 / 已有，未改动');
    else {
        cue.clip = await load(UUID.背景垫乐);
        cue.volume = 0.6;
        cue.fadeIn = 0.3;
        cue.fadeOut = 0.3;
        notes.push('背景垫乐 / 新建');
    }
}

// 2. 拿起碎片：揭角那一下（贴纸）
{
    const { cue, existing } = cueFor('PIECE_PICK');
    if (existing) notes.push('拿起碎片 / 已有，未改动');
    else {
        cue.clip = await load(UUID.贴纸);
        cue.volume = 1;
        notes.push('拿起碎片 / 新建（贴纸）');
    }
}

// 3. 放置碎片：**一条放到底**，不再是每修一块换一个音的音阶列表
{
    const { cue } = cueFor('PIECE_SNAP_SUCCESS');
    const hadSeq = cue.sequence.length;
    cue.clip = await load(UUID.放置音);
    cue.sequence = [];
    notes.push('放置碎片 / 放置音' + (hadSeq ? '（清掉原音阶列表 ×' + hadSeq + '）' : ''));
}

// 4. 自动打关：接管期间整段循环。`GAME_OVER` 停 —— 最后一块落地就是终局跳商店那一拍
{
    const { cue } = cueFor('AUTO_PLAY');
    cue.clip = await load(UUID.自动打关);
    cue.sequence = [];
    cue.stopEvent = 'GAME_OVER';
    cue.loop = true;
    if (cue.fadeIn <= 0) cue.fadeIn = 0.3;
    if (cue.fadeOut <= 0) cue.fadeOut = 0.5;
    notes.push('自动打关 / 自动打关（循环放，GAME_OVER 停）');
}

// 5. 魔法光粒：完成背景那支画笔开演那一下（= 最后一格 `PIECE_SHOWN`，`AudioManager` 自己数出来的）
{
    const { cue, existing } = cueFor('LAST_SHOWN');
    if (existing) notes.push('魔法光粒 / 已有，未改动');
    else {
        cue.clip = await load(UUID.魔法光粒);
        cue.volume = 1;
        cue.fadeOut = 0.4;
        notes.push('魔法光粒 / 新建');
    }
}

// 6. 按压音效：按下按钮那一瞬。走 TOUCH_START 而不是 CTA_CLICK —— CLICK 是松手才发，
//    而 `openStore()` 排在它前面，等它响时商店已经在开了
{
    const { cue } = cueFor('BUTTON_DOWN');
    cue.clip = await load(UUID.按压音效);
    cue.sequence = [];
    notes.push('按压音效 / button_down');
}

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
        c.sequence.length ? '顺序列表×' + c.sequence.length : (c.clip ? c.clip.name : '！！没音效'),
        c.volume,
        '渐入渐出 ' + c.fadeIn + 's→' + c.fadeOut + 's',
        '间隔 ' + c.loopGap + 's',
        c.loop ? '循环' : '',
        c.stopEvent !== 'NONE' ? '停于 ' + c.stopEvent : '',
    ].filter(Boolean).join(' | ')),
    notes,
};
