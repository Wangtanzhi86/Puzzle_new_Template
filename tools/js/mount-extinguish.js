/**
 * Slot_02（灭火器）的收尾动作接线，配套 `assets/scripts/level/ExtinguishAction.ts`：
 *   - Slot_02 挂 ExtinguishAction：mistFrame（喷射那张）/ fire（Scene_BG/火）两个口填上
 *   - 回填 `PieceSlot.extinguishAction`
 *   - 抬起 / 落位 / 摇晃 / 火焰渐隐 / 灭火器渐隐那几个调参写进去（编辑器里改过就会被这里复位，§16）
 *   - 火焰与 Slot_02/Repaired 各补一个 UIOpacity（渐隐要用，缺了就是取到 null 直接抛 ——
 *     抛在这条路上等于这一格的 PIECE_SHOWN 永远不抛）
 *
 * 喷射贴图的 uuid **不写死**（每次重新导入都会变），由调用方从 `.meta` 现算后经 args 传进来：
 *
 *   node tools/exec.mjs scene tools/js/mount-extinguish.js "{\"mist\":\"<uuid>@f9941\"}"
 *
 * 不传 args 就只接 fire / 引用 / UIOpacity，mistFrame 保持原样（那样这一格不会演，handles() 是 false）。
 *
 * 幂等：组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const slotNode = canvas.getChildByPath('GameLayer/BrokenLayer/Slot_02');
const repaired = slotNode.getChildByName('Repaired');
const fire = canvas.getChildByPath('GameLayer/Scene_BG/火');

const load = (uuid) => new Promise((res, rej) =>
  cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

const comp = slotNode.getComponent('ExtinguishAction') || slotNode.addComponent('ExtinguishAction');
comp.fire = fire;
if (args.mist) comp.mistFrame = await load(args.mist);

comp.rise = 60;
comp.dropTime = 0.9;
comp.shakeCount = 3;
comp.shakeDepth = 20;
comp.shakeTime = 0.12;
comp.fireDelay = 0.2;
comp.fireFadeTime = 0.45;
comp.mistFadeTime = 0.3;

const opacity = [];
for (const n of [fire, repaired]) {
  if (!n.getComponent(cc.UIOpacity)) n.addComponent(cc.UIOpacity);
  opacity.push(n.name);
}

const slot = slotNode.getComponent('PieceSlot');
slot.extinguishAction = comp;

const sp = repaired.getComponent(cc.Sprite);
const ut = repaired.getComponent(cc.UITransform);
const f = comp.mistFrame;

return {
  slot: slotNode.name,
  comps: slotNode.components.map((c) => cc.js.getClassName(c)),
  frames: {
    idle: sp.spriteFrame ? sp.spriteFrame.name : null,
    mist: f ? f.name + ' | rect ' + f.rect.width + 'x' + f.rect.height
      + ' offset ' + f.offset.x + ',' + f.offset.y + ' orig ' + f.originalSize.width + 'x' + f.originalSize.height : null,
  },
  nodeBox: { size: [ut.width, ut.height], scale: [repaired.scale.x, repaired.scale.y], pos: [repaired.position.x, repaired.position.y], anchor: [ut.anchorX, ut.anchorY], trim: sp.trim, sizeMode: sp.sizeMode },
  tune: {
    arrive: comp.rise + 'px ' + comp.dropTime + 's',
    shake: comp.shakeCount + ' 次 × ' + comp.shakeDepth + 'px（单程 ' + comp.shakeTime + 's）',
    fire: comp.fireDelay + '+' + comp.fireFadeTime + 's',
    mist: comp.mistFadeTime + 's',
  },
  opacity,
  extinguishAction: !!slot.extinguishAction,
  untouched: canvas.getChildByPath('GameLayer/BrokenLayer').children
    .filter((n) => n.getComponent('PieceSlot') && n.name !== 'Slot_02').map((n) => n.name),
};
