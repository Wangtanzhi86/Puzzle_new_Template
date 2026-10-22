/**
 * 剧情气泡接线（配套 `assets/scripts/ui/TypewriterLabel.ts` / `BubbleSequence.ts`）。
 *
 *   - `GameLayer` 下建 `BubbleLayer`（最后一个子节点，盖在角色之上）。跟着 `GameLayer`
 *     一起被 `LandscapeLayout` 平移 / 缩放，横屏不会飘；气泡本身在拼图框内，不会被 RECT Mask 裁掉。
 *     不能挂 `UILayer` 下面 —— 它现在是关的，`BubbleSequence` 收不到事件。
 *   - 三个气泡 `Bubble_01/02/03`：气泡框.png + 一个居中 Label + TypewriterLabel
 *   - `BubbleLayer` 上挂 BubbleSequence：槽位 3 演完 → 气泡 1 → 气泡 2；槽位 4 演完 → 气泡 3
 *   - 顺带把槽位 3 的 SlotSwap 延迟从 0.2 调到 0.3：气泡 1 淡入用 0.2 秒，
 *     晚 0.1 秒再换女主动作，观感上才是「气泡先出来，她再动」
 *
 * ⚠️ 只在场景里还没有 `BubbleLayer` 时建。已有就整段跳过 —— 文字、位置、方向、字号
 *    都以 Inspectors 里配的为准，重跑不会覆盖。
 *
 *   node tools/exec.mjs scene tools/js/mount-bubbles.js
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const gameLayer = canvas.getChildByPath('GameLayer');
const BUBBLE_UUID = '5be7791e-9cf8-4e32-8c52-30b8fedea12e@f9941';
const LAYER = gameLayer.layer;

const BUBBLES = [
  { name: 'Bubble_01', x: 75.619, y: 164.584, text: 'How could \nyou bully her?' },
  { name: 'Bubble_02', x: -105.778, y: 101.599, text: "I didn't touch \nyou!" },
  { name: 'Bubble_03', x: -38.159, y: 213.346, text: 'I believe Lily.' },
];

const spriteFrame = await new Promise((res, rej) =>
  cc.assetManager.loadAny(BUBBLE_UUID, (e, a) => (e ? rej(new Error(BUBBLE_UUID + ' -> ' + e.message)) : res(a))),
);

const ensureNode = (name, parent) => {
  const existing = parent.getChildByName(name);
  if (existing) return existing;
  const node = new cc.Node(name);
  node.layer = LAYER;
  node.setParent(parent);
  return node;
};

let layer = gameLayer.getChildByName('BubbleLayer') || canvas.getChildByName('BubbleLayer');
if (layer) return { skipped: 'BubbleLayer 已存在，保留已配置的文字/位置/方向，不重写' };
if (!layer) {
  layer = new cc.Node('BubbleLayer');
  layer.layer = LAYER;
}
layer.setParent(gameLayer);
layer.layer = LAYER;
layer.setSiblingIndex(gameLayer.children.length - 1);
layer.setPosition(0, 0, 0);
layer.active = true;
let layerTransform = layer.getComponent(cc.UITransform);
if (!layerTransform) layerTransform = layer.addComponent(cc.UITransform);
layerTransform.setContentSize(560, 840);

const bubbleRefs = [];
for (const spec of BUBBLES) {
  const node = ensureNode(spec.name, layer);
  node.layer = LAYER;
  node.setPosition(spec.x, spec.y, 0);
  let transform = node.getComponent(cc.UITransform);
  if (!transform) transform = node.addComponent(cc.UITransform);
  transform.setContentSize(296, 214);

  let sprite = node.getComponent(cc.Sprite);
  if (!sprite) sprite = node.addComponent(cc.Sprite);
  sprite.spriteFrame = spriteFrame;
  sprite.type = cc.Sprite.Type.SIMPLE;
  sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;

  if (!node.getComponent(cc.UIOpacity)) node.addComponent(cc.UIOpacity);

  const textNode = ensureNode('Text', node);
  textNode.layer = LAYER;
  textNode.setPosition(0, 8, 0);
  let textTransform = textNode.getComponent(cc.UITransform);
  if (!textTransform) textTransform = textNode.addComponent(cc.UITransform);
  textTransform.setContentSize(236, 150);

  let label = textNode.getComponent(cc.Label);
  if (!label) label = textNode.addComponent(cc.Label);
  label.useSystemFont = true;
  label.fontFamily = 'Arial';
  label.fontSize = 30;
  label.lineHeight = 32;
  label.color = new cc.Color(74, 48, 38, 255);
  label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
  label.verticalAlign = cc.Label.VerticalAlign.CENTER;
  label.overflow = cc.Label.Overflow.CLAMP;
  label.enableWrapText = true;
  label.string = spec.text;

  let writer = node.getComponent('TypewriterLabel');
  if (!writer) writer = node.addComponent('TypewriterLabel');
  writer.label = label;
  writer.text = spec.text;
  writer.charsPerSecond = 16;
  writer.fadeIn = 0.2;
  writer.hold = 0.5;
  writer.fadeOut = 0.2;

  node.active = false;
  bubbleRefs.push(writer);
}

let sequence = layer.getComponent('BubbleSequence');
if (!sequence) sequence = layer.addComponent('BubbleSequence');
sequence.bubble1 = bubbleRefs[0];
sequence.bubble2 = bubbleRefs[1];
sequence.bubble3 = bubbleRefs[2];
sequence.firstSlot = canvas.getChildByPath('GameLayer/BrokenLayer/Slot_03');
sequence.secondSlot = canvas.getChildByPath('GameLayer/BrokenLayer/Slot_04');
sequence.delay = 0;

const swaps = canvas.getChildByPath('GameLayer/Scene_BG').getComponents('SlotSwap');
const changed = [];
for (const swap of swaps) {
  const watchNode = swap.watch ? swap.watch.node : null;
  if (watchNode && watchNode.name === 'Slot_03') {
    swap.delay = 0.3;
    changed.push('Slot_03 SlotSwap.delay=' + swap.delay);
  }
}

return {
  bubbleFrame: spriteFrame.name + ' | ' + spriteFrame.uuid,
  classOk: {
    writer: !!cc.js.getClassByName('TypewriterLabel'),
    sequence: !!cc.js.getClassByName('BubbleSequence'),
  },
  layer: layer.name + ' @' + layer.getSiblingIndex() + ' active=' + layer.active,
  bubbles: bubbleRefs.map((b) => ({
    node: b.node.name,
    pos: b.node.position.toString(),
    active: b.node.active,
    text: b.text,
    label: b.label ? b.label.string : null,
  })),
  sequence: {
    first: sequence.firstSlot ? sequence.firstSlot.name : null,
    second: sequence.secondSlot ? sequence.secondSlot.name : null,
    delay: sequence.delay,
  },
  changed,
};
