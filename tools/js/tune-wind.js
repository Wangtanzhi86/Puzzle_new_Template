/**
 * 把 FxSnow 从「圆点雪花」改成「一条条被风刮进来的线」。
 *
 *   node tools/exec.mjs scene tools/js/tune-wind.js
 *
 * 幂等：位置取 Slot_03/Broken，起停只认槽位 3 修好那一下。
 */
const LINE_UUID = 'ce36cd45-34b5-4a0d-9d91-c780cbb2d7f8@f9941';
const load = (uuid) => new Promise((res, rej) =>
  cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

const frame = await load(LINE_UUID);
const sc = cc.director.getScene();
const n = sc.getChildByPath('Canvas/FxLayer/FxSnow');
if (!n) throw new Error('缺少节点: Canvas/FxLayer/FxSnow');
const p = n.getComponent('Particle2D');
if (!p) throw new Error('FxSnow 上没有 Particle2D');

const anchor = sc.getChildByPath('Canvas/GameLayer/BrokenLayer/Slot_03/Broken');
if (!anchor) throw new Error('缺少节点: Slot_03/Broken');
n.setWorldPosition(anchor.worldPosition);

p.spriteFrame = frame;
p.lengthRatio = 32;
p.alignToVelocity = true;

p.totalParticles = 50;
p.emissionRate = 30;
p.life = 0.53;
p.lifeVar = 0.07;
p.angle = 180;
p.angleVar = 5;
p.startSize = 3.2;
p.startSizeVar = 0.8;
p.endSize = 1.4;
p.endSizeVar = 0.4;
p.startSpin = 0;
p.startSpinVar = 0;
p.endSpin = 0;
p.endSpinVar = 0;
p.startColor = new cc.Color(238, 247, 255, 235);
p.startColorVar = new cc.Color(0, 0, 0, 0);
p.endColor = new cc.Color(238, 247, 255, 0);
p.endColorVar = new cc.Color(0, 0, 0, 0);
p.posVar = new cc.Vec2(4, 62);
p.gravity = new cc.Vec2(0, 0);
p.speed = 500;
p.speedVar = 80;
p.tangentialAccel = 0;
p.tangentialAccelVar = 0;
p.radialAccel = 0;
p.radialAccelVar = 0;
p.curveDistance = 40;
p.curveAccel = 570;
p.positionType = 1;

// 槽位 3 = 排序后的第 3 个（0 起），不是 pieceId
p.stopEvents = ['PIECE_REPAIRED'];
p.stopDelay = 0;
p.slotIndex = 2;

return { node: n.name, pos: [n.position.x, n.position.y], lengthRatio: p.lengthRatio, angle: p.angle, speed: p.speed, total: p.totalParticles, curveDistance: p.curveDistance, curveAccel: p.curveAccel };