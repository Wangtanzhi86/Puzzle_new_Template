/**
 * Slot_05（喷瓶）的收尾动作接线，配套 `assets/scripts/level/SprayAction.ts`：
 *   - Slot_05 挂 SprayAction：noMistFrame / mistFrame / gases 三个口填上
 *   - 回填 `PieceSlot.sprayAction`
 *   - 摇晃 / 下落 / 气体渐隐那几个调参写进去（编辑器里改过就会被这里复位，§16）
 *   - 两团气体补 UIOpacity（渐隐要用，缺了就是取到 null 直接抛 —— 抛在这条路上等于这一格的
 *     PIECE_SHOWN 永远不抛，最后一格修好时完成背景和结束界面都不出来）
 *   - Slot_05/Repaired 的 Sprite 改 CUSTOM（框固定 81×192，换贴图时由脚本自己钉框）
 *   - Slot_05 的 pieceId 从 0 拉到 4：原来和 Slot_01 撞号，只靠 Array.sort 的稳定性兜着
 *
 * 两张贴图的 uuid **不写死**（每次重新导入都会变），由调用方从 `.meta` 现算后经 args 传进来：
 *
 *   node tools/exec.mjs scene tools/js/mount-spray-action.js \
 *     "{\"noMist\":\"<uuid>@f9941\",\"mist\":\"<uuid>@f9941\"}"
 *
 * 不传 args 就只接 gases / 引用 / pieceId，两个图口保持原样（那样这一格不会演，handles() 是 false）。
 *
 * 幂等：组件 / 引用已存在就重复赋同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('GameLayer/BrokenLayer');
const slotNode = layer.getChildByName('Slot_05');
const repaired = slotNode.getChildByPath('Repaired');

const load = (uuid) => new Promise((res, rej) =>
  cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

const gasNames = ['气体大', '气体小'];
const gases = gasNames.map((n) => canvas.getChildByPath('GameLayer/Scene_BG/马桶隐藏节点/' + n));
const faded = [];
for (const g of gases) {
  if (!g.getComponent(cc.UIOpacity)) g.addComponent(cc.UIOpacity);
  faded.push(g.name);
}

const comp = slotNode.getComponent('SprayAction') || slotNode.addComponent('SprayAction');
comp.gases = gases;
if (args.noMist) comp.noMistFrame = await load(args.noMist);
if (args.mist) comp.mistFrame = await load(args.mist);

comp.shakeCount = 3;
comp.shakeAngle = 8;
comp.shakeTime = 0.12;
comp.mistRise = 60;
comp.mistDropTime = 0.9;
comp.gasFadeTime = 0.45;
comp.gasStagger = 0.35;

const slot = slotNode.getComponent('PieceSlot');
slot.sprayAction = comp;
slot.pieceId = 4;

const sp = repaired.getComponent(cc.Sprite);
if (sp.sizeMode !== cc.Sprite.SizeMode.CUSTOM) sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;

return {
  slot: slotNode.name,
  pieceId: slot.pieceId,
  comps: slotNode.components.map((c) => cc.js.getClassName(c)),
  frames: {
    noMist: comp.noMistFrame ? comp.noMistFrame.name + ' | ' + comp.noMistFrame.originalSize.width + 'x' + comp.noMistFrame.originalSize.height : null,
    mist: comp.mistFrame ? comp.mistFrame.name + ' | rect ' + comp.mistFrame.rect.width + 'x' + comp.mistFrame.rect.height + ' orig ' + comp.mistFrame.originalSize.width + 'x' + comp.mistFrame.originalSize.height : null,
  },
  gases: gases.map((g) => g.name + (g.getComponent(cc.UIOpacity) ? '+opacity' : '') + ' y=' + g.worldPosition.y.toFixed(1)),
  faded,
  tune: {
    shake: comp.shakeCount + '次 x ' + comp.shakeAngle + '° x ' + comp.shakeTime + 's',
    drop: comp.mistRise + 'px / ' + comp.mistDropTime + 's',
    gas: comp.gasFadeTime + 's / 间隔 ' + comp.gasStagger + 's',
  },
  gasOrder: gases.slice().sort((a, b) => b.worldPosition.y - a.worldPosition.y).map((g) => g.name),
  repairedSprite: { sizeMode: sp.sizeMode, type: sp.type, trim: sp.trim, frame: sp.spriteFrame && sp.spriteFrame.name, size: [repaired.getComponent(cc.UITransform).width, repaired.getComponent(cc.UITransform).height] },
  sprayAction: !!slot.sprayAction,
  untouched: layer.children.filter((n) => n.getComponent('PieceSlot') && n.name !== 'Slot_05').map((n) => n.name),
};
