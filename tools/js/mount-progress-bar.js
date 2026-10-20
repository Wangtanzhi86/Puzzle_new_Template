/**
 * 进度条外观接线，配套 `assets/scripts/ui/ProgressController.ts`。
 *
 *   node tools/exec.mjs scene tools/js/mount-progress-bar.js
 *
 *   UILayer/ProgressLayer（460 × 119.2）
 *   ├── 进度条底   Sprite：精神值框.png，SIMPLE —— 整条框
 *   └── 进度条     Sprite：内容物.png，FILLED / HORIZONTAL —— 框内那截“内容物”
 *
 * 框内填充区在原图里是 x=127..855、y=85..166（876×227 的那张图），
 * 不是从框的最左边开始。所以填充节点的框按“内容物可见像素”反算：
 * 内容物可见区 435×50（445×108 里 x=1..436、y=40..90），映射到框内 728×81 像素。
 * 填充图的 `fillStart` 只剩内容物自身左边那 1px 透明边（0.00228），
 * 以后要手动把起点再往右挪，直接改 `进度条` Sprite 的 Fill Start 即可（0~1），
 * ProgressController 会把满格目标换算成 `1 - fillStart`，右端不会提前停。
 *
 * 幂等：重复跑只再赋一次同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const uiLayer = canvas.getChildByName('UILayer');
const progressLayer = uiLayer && uiLayer.getChildByName('ProgressLayer');
if (!progressLayer) return { ok: false, error: '找不到 UILayer/ProgressLayer' };

const FRAME_UUID = '94009498-cc1a-4703-8048-2bbcf6e6d72d@f9941'; // 精神值框.png
const FILL_UUID = '11d38882-6f1f-41c2-850f-914551726866@f9941';  // 内容物.png

const load = (uuid) => new Promise((resolve, reject) => {
    cc.assetManager.loadAny(uuid, (err, asset) => (err ? reject(new Error(uuid + ' -> ' + err.message)) : resolve(asset)));
});
const [frame, fillFrame] = await Promise.all([load(FRAME_UUID), load(FILL_UUID)]);

// 460 宽下：框高 119.2009；框内 x=-163.31..218.97、y=-27.57..14.97（中心 -6.30，高 42.54）
const W = 460;
const H = (W * 227) / 876;
// 旧进度条中心在 ProgressLayer 局部 y=12.141；新框内腔中心在 y=-6.30。
// 把整层上移 18.441，让「填充线」仍落在原来的高度，不往碎片池里压。
const LAYER_Y = -275.481;
const FILL_X = 31.35;
const FILL_Y = 3.06;
const FILL_W = 391.07;
const FILL_H = 91.89;
const FILL_START = 0.00228;

progressLayer.setPosition(progressLayer.position.x, LAYER_Y, 0);
const layerUt = progressLayer.getComponent(cc.UITransform);
layerUt.setContentSize(W, H);

const ensure = (name, index) => {
    let node = progressLayer.getChildByName(name);
    if (!node) {
        node = new cc.Node(name);
        node.setParent(progressLayer);
    }
    node.layer = canvas.layer;
    node.setSiblingIndex(index);
    return node;
};

const bgNode = ensure('进度条底', 0);
bgNode.setPosition(0, 0, 0);
const bgUt = bgNode.getComponent(cc.UITransform) || bgNode.addComponent(cc.UITransform);
bgUt.setAnchorPoint(0.5, 0.5);
const bgSp = bgNode.getComponent(cc.Sprite) || bgNode.addComponent(cc.Sprite);
bgSp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
bgSp.type = cc.Sprite.Type.SIMPLE;
bgSp.trim = false;
bgSp.spriteFrame = frame;
bgSp.color = new cc.Color(255, 255, 255, 255);
bgUt.setContentSize(W, H);

const fillNode = ensure('进度条', 1);
fillNode.setPosition(FILL_X, FILL_Y, 0);
const fillUt = fillNode.getComponent(cc.UITransform) || fillNode.addComponent(cc.UITransform);
fillUt.setAnchorPoint(0.5, 0.5);
const fillSp = fillNode.getComponent(cc.Sprite) || fillNode.addComponent(cc.Sprite);
fillSp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
fillSp.type = cc.Sprite.Type.FILLED;
fillSp.fillType = cc.Sprite.FillType.HORIZONTAL;
fillSp.fillStart = FILL_START;
fillSp.fillRange = 0;
fillSp.trim = false;
fillSp.spriteFrame = fillFrame;
fillSp.color = new cc.Color(255, 255, 255, 255);
fillUt.setContentSize(FILL_W, FILL_H);

const cls = cc.js.getClassByName('ProgressController');
const ctrl = uiLayer.getComponent(cls);
ctrl.fill = fillSp;

return {
    ok: true,
    layer: { size: [layerUt.width, layerUt.height], pos: [progressLayer.position.x, progressLayer.position.y] },
    bg: { size: [bgUt.width, bgUt.height], pos: [bgNode.position.x, bgNode.position.y], frame: frame.name },
    fill: {
        size: [fillUt.width, fillUt.height],
        pos: [fillNode.position.x, fillNode.position.y],
        frame: fillFrame.name,
        type: fillSp.type,
        fillType: fillSp.fillType,
        fillStart: fillSp.fillStart,
        fillRange: fillSp.fillRange,
    },
    controllerBound: ctrl.fill === fillSp,
};
