/**
 * 按 CopyPuzzle 的「炉火 / 飘雪 / 烟雾」装配粒子与火焰，全部参数都写成 Inspector 可改的字段：
 *
 *   node tools/exec.mjs scene tools/js/apply-copy-particles.js
 *
 * 幂等（可反复跑）：节点已经存在就复用，只把参数写一遍。
 *
 * 位置是照新工程背景图（720×1280：右上窗、右侧壁炉）估的**占位值** —— 想让雪下在哪、
 * 火苗蹿多高，直接在 Inspector 里改节点位置 / Particle2D 的数值即可，不必改代码。坐标系是
 * `FxLayer` 的局部坐标：原点在画布中心，x 右正、y 上正。
 *
 * 起停条件同样在面板上：`启动事件` / `启动延迟` / `停止事件` / `停止延迟` / `只认槽位`。
 * 现在是「修好一块 → 1.8s 点火 / 1.9s 冒烟」「整关完成 → 停」。想让火等某一件（比如壁炉）
 * 修好才点，就把启动事件留 `PIECE_REPAIRED`、把「只认槽位」填成那件的序号。
 */
const UI_2D = cc.Layers.Enum.UI_2D;

const SF = {
  snow: '16c41e27-acf9-4dda-829e-935a21e59f24',
  smoke: 'dbe675c1-458a-4282-b23f-0678a0db4f02',
  shine: '646b7651-605b-4b20-94b3-7460ee04b888',
  spark: '2f76c8f2-48a7-46ab-b6e9-8ec6faf24333',
  fire1: '6820509b-da04-42cf-a348-dccc4f261f41',
  fire2: 'b0250500-189b-4957-963d-43af914d16d0',
  fire3: 'f00cfd91-5371-441d-8a66-55b5968a25b3',
  fire4: 'fe87b0c6-92af-4491-a5ee-9c572d50a994',
};
const SPRITE_ADD = '8c682025-24b0-4fb9-8179-9b45c212beb5';

function loadAny(uuid) {
  return new Promise((res, rej) =>
    cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))),
  );
}

/** SpriteFrame 是图片的子资源，uuid 就是「图片 uuid + @f9941」 */
async function loadSF(uuid) {
  try {
    return await loadAny(uuid + '@f9941');
  } catch (e) {
    const img = await loadAny(uuid);
    const tex = new cc.Texture2D();
    tex.image = img;
    const sf = new cc.SpriteFrame();
    sf.texture = tex;
    return sf;
  }
}

const snowSF = await loadSF(SF.snow);
const smokeSF = await loadSF(SF.smoke);
const shineSF = await loadSF(SF.shine);
const sparkSF = await loadSF(SF.spark);
const fireFrames = [await loadSF(SF.fire4), await loadSF(SF.fire3), await loadSF(SF.fire2), await loadSF(SF.fire1)];
const spriteAdd = await loadAny(SPRITE_ADD);

const sceneNode = cc.director.getScene();
const canvasNode = sceneNode.getChildByName('Canvas');

// 容器放在 GameLayer 之后：要盖在背景与拼图之上（火苗在壁炉口里、雪在窗前景），
// 但仍在 DragRoot / UILayer 之下，拖拽中的碎片与 HUD 不会被雪盖住。
let layer = canvasNode.getChildByName('FxLayer');
if (!layer) {
  layer = new cc.Node('FxLayer');
  layer.layer = UI_2D;
  const ui = layer.addComponent(cc.UITransform);
  ui.setContentSize(720, 1280);
  const gi = canvasNode.children.findIndex((c) => c.name === 'GameLayer');
  canvasNode.insertChild(layer, gi >= 0 ? gi + 1 : canvasNode.children.length);
}
layer.setPosition(0, 0, 0);

function ensure(name, x, y, z) {
  let n = layer.getChildByName(name);
  if (!n) {
    n = new cc.Node(name);
    n.layer = UI_2D;
    n.addComponent(cc.UITransform);
    n.setParent(layer);
  }
  n.setPosition(x, y, z);
  return n;
}

function setOpacity(n, o) {
  const op = n.getComponent(cc.UIOpacity) || n.addComponent(cc.UIOpacity);
  op.opacity = o;
}

// ---- 飘雪：窗前景。原版 FxSnowWall ----
{
  const n = ensure('FxSnow', 110, 430, 70);
  const p = n.getComponent('Particle2D') || n.addComponent('Particle2D');
  p.spriteFrame = snowSF;
  p.additive = true;
  p.additiveEffect = spriteAdd;
  p.playOnLoad = true;
  p.startEvents = [];
  p.startDelay = 0;
  p.stopEvents = ['LEVEL_COMPLETE'];
  p.stopDelay = 0.5;
  p.slotIndex = -1;
  p.totalParticles = 250;
  p.emissionRate = 350;
  p.life = 1.5;
  p.lifeVar = 0.5;
  p.angle = 250;
  p.angleVar = 30;
  p.startSize = 10;
  p.startSizeVar = 5;
  p.endSize = 10;
  p.endSizeVar = 5;
  p.startSpin = 0;
  p.startSpinVar = 180;
  p.endSpin = 0;
  p.endSpinVar = 180;
  p.startColor = new cc.Color(255, 255, 255, 255);
  p.startColorVar = new cc.Color(0, 0, 0, 0);
  p.endColor = new cc.Color(255, 255, 255, 0);
  p.endColorVar = new cc.Color(0, 0, 0, 0);
  p.posVar = new cc.Vec2(139, 174);
  p.gravity = new cc.Vec2(0, 0);
  p.speed = 522;
  p.speedVar = 348;
  p.tangentialAccel = 0;
  p.tangentialAccelVar = 348;
  p.radialAccel = 0;
  p.radialAccelVar = 348;
  p.positionType = 1;
}

// ---- 烟：壁炉口上方，修好一块 1.9s 后开始。原版 FxSmoke ----
{
  const n = ensure('FxSmoke', 305, -60, 95);
  const p = n.getComponent('Particle2D') || n.addComponent('Particle2D');
  p.spriteFrame = smokeSF;
  p.additive = false;
  p.additiveEffect = null;
  p.playOnLoad = false;
  p.startEvents = ['PIECE_REPAIRED'];
  p.startDelay = 1.9;
  p.stopEvents = ['LEVEL_COMPLETE'];
  p.stopDelay = 0;
  p.slotIndex = -1;
  p.totalParticles = 400;
  p.emissionRate = 100;
  p.life = 3;
  p.lifeVar = 0.2;
  p.angle = 60;
  p.angleVar = 20;
  p.startSize = 52;
  p.startSizeVar = 9;
  p.endSize = 261;
  p.endSizeVar = 35;
  p.startSpin = 0;
  p.startSpinVar = 0;
  p.endSpin = 0;
  p.endSpinVar = 0;
  p.startColor = new cc.Color(39, 39, 39, 255);
  p.startColorVar = new cc.Color(0, 0, 0, 0);
  p.endColor = new cc.Color(22, 22, 22, 0);
  p.endColorVar = new cc.Color(0, 0, 0, 0);
  p.posVar = new cc.Vec2(17, 17);
  p.gravity = new cc.Vec2(0, 174);
  p.speed = 174;
  p.speedVar = 0;
  p.tangentialAccel = 17;
  p.tangentialAccelVar = 35;
  p.radialAccel = 0;
  p.radialAccelVar = 0;
  p.positionType = 1;
}

// ---- 火光柔光：原版 FxFireShine ----
{
  const n = ensure('FxFireShine', 305, -230, 97);
  const p = n.getComponent('Particle2D') || n.addComponent('Particle2D');
  p.spriteFrame = shineSF;
  p.additive = true;
  p.additiveEffect = spriteAdd;
  p.playOnLoad = false;
  p.startEvents = ['PIECE_REPAIRED'];
  p.startDelay = 1.8;
  p.stopEvents = ['LEVEL_COMPLETE'];
  p.stopDelay = 0;
  p.slotIndex = -1;
  p.totalParticles = 15;
  p.emissionRate = 3;
  p.life = 3;
  p.lifeVar = 1;
  p.angle = 90;
  p.angleVar = 0;
  p.startSize = 139;
  p.startSizeVar = 0;
  p.endSize = 661;
  p.endSizeVar = 0;
  p.startSpin = 0;
  p.startSpinVar = 0;
  p.endSpin = 0;
  p.endSpinVar = 0;
  p.startColor = new cc.Color(255, 169, 41, 255);
  p.startColorVar = new cc.Color(0, 0, 0, 0);
  p.endColor = new cc.Color(255, 214, 0, 0);
  p.endColorVar = new cc.Color(0, 0, 0, 0);
  p.posVar = new cc.Vec2(0, 0);
  p.gravity = new cc.Vec2(0, 26);
  p.speed = 0;
  p.speedVar = 0;
  p.tangentialAccel = 0;
  p.tangentialAccelVar = 0;
  p.radialAccel = 0;
  p.radialAccelVar = 0;
  p.positionType = 1;
}

// ---- 火星：原版 FxFireSparcles ----
{
  const n = ensure('FxFireSparks', 305, -300, 130);
  const p = n.getComponent('Particle2D') || n.addComponent('Particle2D');
  p.spriteFrame = sparkSF;
  p.additive = true;
  p.additiveEffect = spriteAdd;
  p.playOnLoad = false;
  p.startEvents = ['PIECE_REPAIRED'];
  p.startDelay = 1.8;
  p.stopEvents = ['LEVEL_COMPLETE'];
  p.stopDelay = 0;
  p.slotIndex = -1;
  p.totalParticles = 500;
  p.emissionRate = 100;
  p.life = 0.7;
  p.lifeVar = 0.3;
  p.angle = 90;
  p.angleVar = 15;
  p.startSize = 10;
  p.startSizeVar = 5;
  p.endSize = 35;
  p.endSizeVar = 9;
  p.startSpin = 0;
  p.startSpinVar = 0;
  p.endSpin = 0;
  p.endSpinVar = 0;
  p.startColor = new cc.Color(255, 169, 41, 255);
  p.startColorVar = new cc.Color(0, 0, 0, 0);
  p.endColor = new cc.Color(255, 214, 0, 0);
  p.endColorVar = new cc.Color(0, 0, 0, 0);
  p.posVar = new cc.Vec2(130, 0);
  p.gravity = new cc.Vec2(0, 348);
  p.speed = 348;
  p.speedVar = 0;
  p.tangentialAccel = 0;
  p.tangentialAccelVar = 0;
  p.radialAccel = 111;
  p.radialAccelVar = 348;
  p.positionType = 1;
}

// ---- 炉火：两张 sprite 交叉淡入的翻页动画（原版 FireAction） ----
{
  const n = ensure('FxFire', 305, -255, 96);
  const f = n.getComponent('FireAction') || n.addComponent('FireAction');
  f.frames = fireFrames;
  f.minOpacity = 40;
  f.fadeTime = 1;
  f.changeInterval = 1;
  f.spriteScale = 1;
  f.spriteAnchor = new cc.Vec2(0.5, 0.5);
  f.playOnLoad = false;
  f.startEvents = ['PIECE_REPAIRED'];
  f.startDelay = 1.8;
  f.stopEvents = ['LEVEL_COMPLETE'];
  f.stopDelay = 0;
  f.slotIndex = -1;
}

return {
  layer: layer.name,
  siblingIndex: layer.getSiblingIndex(),
  children: layer.children.map((c) => c.name),
  snowSF: snowSF ? snowSF.name : null,
  fireFrames: fireFrames.map((s) => (s ? s.name : null)),
  spriteAdd: spriteAdd ? spriteAdd.name : null,
};
