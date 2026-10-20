/**
 * 把 Slot_03 的「修复窗户」接到 TapeWipe：胶带全部擦完后从透明淡入。
 * 幂等：已有 revealNode 不换；revealFade 没填过就写 0.3。
 *
 * 用法：node tools/exec.mjs scene tools/js/mount-tape-reveal.js
 */
const sc = cc.director.getScene();
const canvas = sc.getChildByName('Canvas');
function find(n, name) {
    if (n.name === name) return n;
    for (const c of n.children) { const hit = find(c, name); if (hit) return hit; }
    return null;
}
const slot = find(canvas, 'Slot_03');
if (!slot) throw new Error('找不到 Canvas/GameLayer/BrokenLayer/Slot_03');
const tape = slot.getComponent('TapeWipe');
if (!tape) throw new Error('Slot_03 上没有 TapeWipe');
const win = slot.getChildByName('修复窗户');
if (!win) throw new Error('Slot_03 下没有「修复窗户」');

if (!tape.revealNode) tape.revealNode = win;
if (!(tape.revealFade > 0)) tape.revealFade = 0.3;

let op = win.getComponent(cc.UIOpacity);
if (!op) op = win.addComponent(cc.UIOpacity);
op.opacity = 0;
win.active = false;

return JSON.stringify({
    tape: slot.name,
    revealNode: tape.revealNode && tape.revealNode.name,
    revealFade: tape.revealFade,
    windowActive: win.active,
    hasOpacity: !!win.getComponent(cc.UIOpacity),
});
