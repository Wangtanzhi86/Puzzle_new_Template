/**
 * 香槟（Slot_02）修复后，让「小三1动作」播一遍小三动作序列帧，停在末帧。
 *
 * 原来第一个 SlotSwap 是「隐藏小三1动作、显示小三动作2」；现在小三动作2 已经不在场景树里，
 * 改成只负责亮出「女主紧张表情」，小三自己的变化交给 SlotSequence。
 *
 *   node tools/exec.mjs scene tools/js/mount-small-three-sequence.js
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const sceneBg = canvas.getChildByPath('GameLayer/Scene_BG');
const broken = canvas.getChildByPath('GameLayer/BrokenLayer');
const action1 = canvas.getChildByPath('GameLayer/女主动作1');
const tension = action1.getChildByName('女主紧张表情');
const smallThree = canvas.getChildByPath('GameLayer/小三1动作');
const slot2 = broken.getChildByName('Slot_02').getComponent('PieceSlot');

const load = (uuid) => new Promise((res, rej) =>
    cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

const frames = [];
for (let i = 1; i <= 17; i++) {
    const file = 'matte_' + String(i).padStart(5, '0') + '.png';
    const uuid = await Editor.Message.request('asset-db', 'query-uuid', 'db://assets/recourses/小三动作序列帧/' + file);
    if (!uuid) throw new Error('找不到 ' + file);
    frames.push(await load(uuid + '@f9941'));
}

const sprite = smallThree.getComponent(cc.Sprite);
sprite.spriteFrame = frames[0];

const swaps = sceneBg.getComponents('SlotSwap');
const swap = swaps.find((c) => c.watch === slot2);
if (!swap) throw new Error('Scene_BG 上找不到 watch=Slot_02 的 SlotSwap');
swap.hideNodes = [];
swap.showNodes = [tension];
swap.delay = 0.25;
swap.fadeTime = 0.3;
swap.pop = true;

let seq = smallThree.getComponent('SlotSequence');
if (!seq) seq = smallThree.addComponent('SlotSequence');
seq.watch = slot2;
seq.frames = frames;
seq.frameInterval = 0.06;
seq.delay = 0;

return {
    slot2: slot2.pieceId,
    swap: {
        watch: swap.watch.node.getPathInHierarchy(),
        hide: swap.hideNodes.map((n) => n.getPathInHierarchy()),
        show: swap.showNodes.map((n) => n.getPathInHierarchy()),
        delay: swap.delay, fade: swap.fadeTime,
    },
    seq: {
        node: smallThree.getPathInHierarchy(),
        watch: seq.watch.node.getPathInHierarchy(),
        frames: seq.frames.length,
        first: seq.frames[0].name,
        last: seq.frames[seq.frames.length - 1].name,
        frameInterval: seq.frameInterval,
        delay: seq.delay,
    },
    initialFrame: sprite.spriteFrame.name,
    tensionActive: tension.active,
};
