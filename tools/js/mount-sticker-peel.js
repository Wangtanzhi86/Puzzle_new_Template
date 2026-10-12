/**
 * 「贴纸揭角」接线，配套 `assets/scripts/gameplay/StickerPeel.ts` + `assets/effects/sticker-peel-*.effect`。
 *
 * 场景里**只有两个东西要配**：`PieceFactory` 上那对全局材质（`peelFrontEffect` / `peelBackEffect`）。
 * 组件本身不挂任何节点 —— 碎片是运行时建的（`PieceFactory` 建节点时 `addComponent(StickerPeel)`，
 * 和 `PieceGlow` 一样），所以没有别的接线。
 *
 * ⚠️ 材质是**全局一对**、不按格配：池里的碎片节点是复用的，材质只在第一块建起来时挂一次，
 * 逐格换材质会「先到先得、后来不生效」。逐格能配的是值参数（`PieceSlot.peelParams`）。
 *
 *   node tools/exec.mjs scene tools/js/mount-sticker-peel.js
 *
 * 幂等：重复跑只再赋一次同样的引用。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const factory = canvas.getChildByPath('PiecePoolLayer/ScrollView').getComponent('PieceFactory');

const FRONT_UUID = '77932496-3b49-4914-8045-29422bfbcf8d';
const BACK_UUID = '3c2e7bb8-5b54-46d6-950c-9ab1283f4114';

const load = (uuid) =>
  new Promise((res, rej) => cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));

const [front, back] = await Promise.all([load(FRONT_UUID), load(BACK_UUID)]);

// 新加的 @property 在老实例上可能还没有 —— 类名注册过，直接按名字取出来造一份
if (!factory.peelParams) factory.peelParams = new (cc.js.getClassByName('PeelConfig'))();
factory.peelFrontEffect = front;
factory.peelBackEffect = back;

const p = factory.peelParams;
return {
  front: factory.peelFrontEffect.name + ' | ' + factory.peelFrontEffect.uuid,
  back: factory.peelBackEffect.name + ' | ' + factory.peelBackEffect.uuid,
  corner: p.corner.toString(),
  liftRatio: p.liftRatio,
  liftTime: p.liftTime,
  stickTime: p.stickTime,
  backColor: p.backColor.toString(),
  creaseWidth: p.creaseWidth,
  creaseGlow: p.creaseGlow,
};
