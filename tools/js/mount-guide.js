/**
 * 给空闲引导接线：`Canvas/UILayer/GuideLayer` 下建三个节点，并把 `GuideController` 指过去
 *
 *   GuideRoot    容器，位移 tween 打的是它
 *   GuideGhost   半透明副本（Sprite + UIOpacity），编辑期贴 Slot_01 那块碎片的图当占位
 *   GuideFinger  手指（贴 assets/recourses/手指图标.png，缩到 0.5）
 *
 *   node tools/exec.mjs scene tools/js/mount-guide.js
 *
 * 幂等：节点 / 组件已存在就复用，重复跑只再赋一次同样的值。
 * 三个节点在场景里保持 active —— 编辑模式不跑生命周期，看不见就摆不了位；开演时组件会收起来。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const layer = canvas.getChildByPath('UILayer/GuideLayer');
const ctrl = canvas.getChildByPath('UILayer').getComponent('GuideController');

const FINGER_UUID = 'a561721d-1690-49cc-8b26-dd4da3c2599c@f9941';
const GHOST_UUID = 'c74ce759-ec50-4c97-993e-781fb18629f9@f9941';
const FINGER_SCALE = 0.5;
const PIECE_HEIGHT = 150;

const load = (uuid) => new Promise((res, rej) => cc.assetManager.loadAny(uuid, (e, a) => (e ? rej(new Error(uuid + ' -> ' + e.message)) : res(a))));
const [fingerFrame, ghostFrame] = [await load(FINGER_UUID), await load(GHOST_UUID)];

function ensure(parent, name) {
  let n = parent.getChildByName(name);
  if (!n) {
    n = new cc.Node(name);
    n.setParent(parent);
  }
  return n;
}

// 尺寸模式一律 CUSTOM：运行期会按池里那块碎片的实际大小改 contentSize
function spriteOf(node) {
  const s = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
  s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  return s;
}

const root = ensure(layer, 'GuideRoot');
root.setSiblingIndex(0);
root.setPosition(0, 0, 0);
const rootUT = root.getComponent(cc.UITransform) || root.addComponent(cc.UITransform);
rootUT.setContentSize(720, 1280);

const ghost = ensure(root, 'GuideGhost');
const ghostSprite = spriteOf(ghost);
ghostSprite.spriteFrame = ghostFrame;
const gr = ghostFrame.rect;
ghost.getComponent(cc.UITransform).setContentSize(PIECE_HEIGHT * (gr.width / gr.height), PIECE_HEIGHT);
ghost.setScale(1, 1, 1);
ghost.setPosition(0, 0, 0);
const opacity = ghost.getComponent(cc.UIOpacity) || ghost.addComponent(cc.UIOpacity);
opacity.opacity = ctrl.ghostOpacity;

const finger = ensure(root, 'GuideFinger');
const fingerSprite = spriteOf(finger);
fingerSprite.spriteFrame = fingerFrame;
finger.getComponent(cc.UITransform).setContentSize(fingerFrame.rect.width, fingerFrame.rect.height);
finger.setScale(FINGER_SCALE, FINGER_SCALE, 1);
finger.setPosition(ctrl.fingerOffset.x, ctrl.fingerOffset.y, 0);

ctrl.root = root;
ctrl.ghost = ghostSprite;
ctrl.finger = fingerSprite;

return {
  root: root.name,
  rootChildren: root.children.map((c) => c.name),
  ghost: {
    frame: ghostSprite.spriteFrame.name + ' | ' + ghostSprite.spriteFrame.uuid,
    size: [ghost.getComponent(cc.UITransform).width, ghost.getComponent(cc.UITransform).height],
    sizeMode: ghostSprite.sizeMode,
    opacity: opacity.opacity,
  },
  finger: {
    frame: fingerSprite.spriteFrame.name + ' | ' + fingerSprite.spriteFrame.uuid,
    size: [finger.getComponent(cc.UITransform).width, finger.getComponent(cc.UITransform).height],
    scale: finger.scale.x,
    position: [finger.position.x, finger.position.y],
  },
  wired: {
    root: ctrl.root ? ctrl.root.name : null,
    ghost: ctrl.ghost ? ctrl.ghost.node.name : null,
    finger: ctrl.finger ? ctrl.finger.node.name : null,
  },
  props: {
    idleDelay: ctrl.idleDelay,
    loopGap: ctrl.loopGap,
    tapTime: ctrl.tapTime,
    tapDepth: ctrl.tapDepth,
    moveTime: ctrl.moveTime,
    fadeTime: ctrl.fadeTime,
    ghostOpacity: ctrl.ghostOpacity,
    fingerOffset: [ctrl.fingerOffset.x, ctrl.fingerOffset.y],
  },
};
