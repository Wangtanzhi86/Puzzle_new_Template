/**
 * 槽位4（锤子）的「敲击」收尾动作 + 修车流程（前置槽位 / 四格组揭晓）接线，配套
 * `assets/scripts/level/HammerAction.ts` 与 `assets/scripts/level/GroupReveal.ts`：
 *
 *   - Slot_04 挂 HammerAction：fx（Scene_BG/修复效果）/ smoke / puffs / hammers 四个口填上，
 *     调参写进去（编辑器里改过就会被这里复位，§16），回填 `PieceSlot.hammerAction`
 *   - 三团小烟雾补 UIOpacity（渐显渐隐要用，缺了就是取到 null 直接抛 —— 抛在这条路上
 *     等于这一格的 PIECE_SHOWN 永远不抛）
 *   - Slot_04.requires = [Slot_02]：没灭火就敲锤子 → `PieceSlot.repair()` 抛 REPAIR_FAILED
 *   - Scene_BG 挂 GroupReveal：slots = Slot_01..Slot_04、nodes = 车修复 + 爷爷微笑，
 *     扩散材质从场景里现成的 EffectLayer/CircleReveal 读过来（.effect 的 uuid 稳定，不走 args）
 *
 * ⚠️「修复效果」下有两个同名 `锤子`，`getChildByName` 只给第一个 —— 一律按子节点序过滤。
 * ⚠️ 两个锤子的摆动角度按**各自在编辑器里的角度**加（HammerAction 在 onLoad 各读一份基准），
 *    所以这里不写角度，只写「抬起多少度」。
 *
 *   node tools/exec.mjs scene tools/js/mount-hammer-group.js
 *
 * 幂等：组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const slot04 = canvas.getChildByPath('GameLayer/BrokenLayer/Slot_04');
const broken = canvas.getChildByPath('GameLayer/BrokenLayer');
const sceneBg = canvas.getChildByPath('GameLayer/Scene_BG');
const fx = sceneBg.getChildByName('修复效果');

const named = (root, name) => root.children.filter((n) => n.name === name);
const prefixed = (root, prefix) => root.children.filter((n) => n.name.indexOf(prefix) === 0);

const comp = slot04.getComponent('HammerAction') || slot04.addComponent('HammerAction');
comp.fx = fx;
comp.smoke = fx.getChildByName('大烟雾');
comp.puffs = prefixed(fx, '小烟雾');
comp.hammers = named(fx, '锤子');

comp.smokeFrom = 0.6;
comp.smokeTime = 0.6;
comp.smokeWobble = 0.35;
comp.puffUp = 0.25;
comp.puffDown = 0.35;
comp.puffStagger = 0.18;
comp.puffGap = 0.2;
comp.liftAngle = 22;
comp.liftTime = 0.18;
comp.hitTime = 0.09;
comp.strikeCount = 2;
comp.handoff = 0.1;

const opacity = [];
for (const puff of comp.puffs) {
  if (!puff.getComponent(cc.UIOpacity)) puff.addComponent(cc.UIOpacity);
  opacity.push(puff.name);
}

const slot = slot04.getComponent('PieceSlot');
slot.hammerAction = comp;
slot.requires = [canvas.getChildByPath('GameLayer/BrokenLayer/Slot_02').getComponent('PieceSlot')];

const group = sceneBg.getComponent('GroupReveal') || sceneBg.addComponent('GroupReveal');
group.slots = ['Slot_01', 'Slot_02', 'Slot_03', 'Slot_04']
  .map((n) => broken.getChildByName(n).getComponent('PieceSlot'));
group.nodes = [sceneBg.getChildByName('车修复'), sceneBg.getChildByName('爷爷微笑')];
group.revealEffect = canvas.getChildByPath('EffectLayer').getComponent('CircleReveal').revealEffect;
group.revealTime = 0.7;
group.feather = 0.35;

return {
  slot: slot04.name,
  comps: slot04.components.map((c) => cc.js.getClassName(c)),
  fx: { active: fx.active, children: fx.children.map((n) => n.name) },
  puffs: comp.puffs.map((p) => p.name),
  hammers: comp.hammers.map((n) => n.name + ' @' + n.position.x.toFixed(0) + ',' + n.position.y.toFixed(0)
    + ' sc' + n.scale.x.toFixed(3) + ' rot' + n.eulerAngles.z.toFixed(1) + '°'),
  tune: {
    smoke: comp.smokeFrom + '→1 (' + comp.smokeTime + 's) 变形 ±' + Math.round(comp.smokeWobble * 100) + '%',
    puffs: comp.puffUp + 's+' + comp.puffDown + 's 首轮隔 ' + comp.puffStagger + 's 循环隔 ' + comp.puffGap + 's',
    hammer: comp.strikeCount + '下 × ' + comp.liftAngle + '° (' + comp.liftTime + '+' + comp.hitTime + 's) 交接 ' + comp.handoff + 's',
  },
  opacity,
  requires: slot.requires.map((s) => s.node.name),
  hammerAction: !!slot.hammerAction,
  group: {
    host: sceneBg.name,
    slots: group.slots.map((s) => s.node.name),
    nodes: group.nodes.map((n) => n.name + (n.getComponent(cc.Sprite) ? '' : ' ⚠️没挂 Sprite')),
    effect: group.revealEffect ? group.revealEffect.name : null,
  },
  untouched: broken.children.filter((n) => n.getComponent('PieceSlot') && n !== slot04).map((n) => n.name),
};
