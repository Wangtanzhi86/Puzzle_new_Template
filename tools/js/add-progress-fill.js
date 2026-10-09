// 给 UILayer/ProgressLayer 补上进度条填充「进度条」，并接到 ProgressController.fill。
// 幂等：已有节点就只刷新属性。填充图 493x48 外框 500x55，留 3.5px 内缩。
const canvas = director.getScene().getChildByName('Canvas');
const uiLayer = canvas.getChildByName('UILayer');
const progressLayer = uiLayer.getChildByName('ProgressLayer');
const frame = progressLayer.getChildByName('进度条框');
if (!frame) return { ok: false, error: '找不到 ProgressLayer/进度条框' };

const sf = await new Promise((res, rej) => {
  cc.assetManager.loadAny({ uuid: '12659c63-95df-4902-89ce-6080e612f7df@f9941' }, (e, a) => (e ? rej(e) : res(a)));
});

let fill = progressLayer.getChildByName('进度条');
const existed = !!fill;
if (!fill) {
  fill = new cc.Node('进度条');
  fill.layer = frame.layer;
  progressLayer.addChild(fill);
}
fill.setSiblingIndex(frame.getSiblingIndex() + 1);

const ui = fill.getComponent(cc.UITransform) || fill.addComponent(cc.UITransform);
ui.setAnchorPoint(0.5, 0.5);
ui.setContentSize(493, 48);
fill.setPosition(frame.position.x, frame.position.y, 0);

const sp = fill.getComponent(cc.Sprite) || fill.addComponent(cc.Sprite);
sp.spriteFrame = sf;
sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
sp.trim = false;
sp.type = cc.Sprite.Type.FILLED;
sp.fillType = cc.Sprite.FillType.HORIZONTAL;
sp.fillStart = 0;
sp.fillEnd = 1;
sp.fillRange = 0;

const cls = cc.js.getClassByName('ProgressController');
const ctrl = uiLayer.getComponent(cls);
ctrl.fill = sp;

return {
  ok: true,
  existed,
  fill: fill.name,
  sibling: fill.getSiblingIndex(),
  frameSibling: frame.getSiblingIndex(),
  size: ui.contentSize.width + 'x' + ui.contentSize.height,
  pos: fill.position.x + ',' + fill.position.y,
  spriteType: sp.type,
  fillType: sp.fillType,
  fillRange: sp.fillRange,
  controllerBound: ctrl.fill === sp,
};
