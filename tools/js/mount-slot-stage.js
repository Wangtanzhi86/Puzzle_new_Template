/**
 * 给 Slot_01..04 挂「吸附之后」的整段表现（SlotAfterSnap 四个子类），并接好节点。
 *
 *   node tools/exec.mjs scene tools/js/mount-slot-stage.js
 *
 * 幂等：已经有同名组件就复用，只重写节点引用。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const get = (p) => {
  const n = canvas.getChildByPath(p);
  if (!n) throw new Error('缺少节点: ' + p);
  return n;
};
const mount = (slotName, cls, apply) => {
  const node = get('GameLayer/BrokenLayer/' + slotName);
  let comp = node.getComponent(cls);
  if (!comp) comp = node.addComponent(cls);
  apply(comp);
  return { slot: slotName, comp: cls };
};
const sceneBg = 'GameLayer/Scene_BG/';

// 旧架子回到 Scene_BG 直下；以前套的「行李架遮罩」拆掉（不再用遮罩挖洞）。
const bgNode = get('GameLayer/Scene_BG');
const oldWrap = bgNode.getChildByName('行李架遮罩');
let rack = bgNode.getChildByName('行李架');
if (oldWrap) {
  const inner = oldWrap.getChildByName('行李架');
  if (inner) {
    const idx = oldWrap.getSiblingIndex();
    inner.setParent(bgNode, true);
    inner.setSiblingIndex(idx);
    rack = inner;
  }
  oldWrap.removeFromParent();
  oldWrap.destroy();
}
if (!rack) throw new Error('缺少节点: 行李架');
const stray = rack.getComponent(cc.Mask);
if (stray) rack.removeComponent(stray);

const done = [
  mount('Slot_01', 'LuggageDrop', (c) => {
    c.root = get(sceneBg + '修复完行李架');
    c.hideNode = rack;
  }),
  mount('Slot_02', 'RevealNodes', (c) => {
    c.nodes = [get('GameLayer/BrokenLayer/Slot_02/石膏胳膊'), get(sceneBg + '男主表情')];
  }),
  mount('Slot_03', 'TapeWipe', (c) => {
    c.root = get(sceneBg + '胶带');
    get(sceneBg + '胶带').active = false;
  }),
  mount('Slot_04', 'PoseCrossFade', (c) => {
    c.hideNode = get(sceneBg + '女主');
    c.showNode = get(sceneBg + '女主姿势变化');
    c.afterShown = true;
  }),
];
return done;
