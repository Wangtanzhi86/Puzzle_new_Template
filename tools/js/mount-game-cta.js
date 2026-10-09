/**
 * 游戏中那个常驻下载按钮的接线，配套 `assets/scripts/platform/GameCta.ts`（见 CLAUDE.md §14）。
 *
 *   node tools/exec.mjs scene tools/js/mount-game-cta.js
 *
 * 建 `Canvas/GameCta`（`PiecePoolLayer` 后面那个兄弟，排在它前面会被碎片池底图盖住），
 * 拆出子节点 `Img` 承接 Sprite（`Button` 的缩放目标不能是自己，理由同 `mount-end-card.js`），
 * 尺寸 144×48 —— 这是「画布正好 720×1280（16:9 竖屏）」时碎片池可点区下沿到画布下沿之间
 * 能塞下的最大 3:1 按钮，再高一点上半截就压进 `ScrollView` 的矩形里，那一段触摸会被它认领。
 *
 * 竖屏贴下沿靠节点上一个 Widget（`bottom = 6`），横屏那一套在 `LandscapeLayout.toLandscape()` 里
 *（它才量得到拼图列多宽，左边空位的中点得按它算）—— 所以这里只配 Widget，不写死坐标。
 *
 * 幂等：重复跑只再赋一次同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const PICK = 'Canvas';

const cut = canvas.getComponent(cc.UITransform);

const BTN_UUID = '593d1409-cb5e-4020-b5f0-8e77219cd7b1@f9941';
const SIZE = [144, 48];
const BOTTOM = 6;

let node = canvas.getChildByName('GameCta');
if (!node) {
    node = new cc.Node('GameCta');
    node.setParent(canvas);
}
node.setSiblingIndex(canvas.children.length - 1);

const ut = node.getComponent(cc.UITransform) || node.addComponent(cc.UITransform);
ut.setContentSize(SIZE[0], SIZE[1]);
ut.setAnchorPoint(0.5, 0.5);
node.setScale(1, 1, 1);   // 呼吸 tween 拿它当基准，基准得是 1

const frame = await new Promise((resolve, reject) => {
    cc.assetManager.loadAny(BTN_UUID, (err, asset) => (err ? reject(new Error(BTN_UUID + ' -> ' + err.message)) : resolve(asset)));
});

let img = node.getChildByName('Img');
if (!img) {
    img = new cc.Node('Img');
    img.setParent(node);
}
img.setPosition(0, 0, 0);
const imgUt = img.getComponent(cc.UITransform) || img.addComponent(cc.UITransform);
const imgSp = img.getComponent(cc.Sprite) || img.addComponent(cc.Sprite);
// 顺序不能反：赋 spriteFrame 会立刻按当前尺寸模式把节点框改写成贴图尺寸（默认 TRIMMED），
// 先钉 CUSTOM 再赋图，最后才定尺寸。
imgSp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
imgSp.type = cc.Sprite.Type.SIMPLE;
imgSp.spriteFrame = frame;
imgUt.setContentSize(SIZE[0], SIZE[1]);

const button = node.getComponent(cc.Button) || node.addComponent(cc.Button);
button.transition = cc.Button.Transition.SCALE;
button.zoomScale = 0.9;
button.duration = 0.08;
button.target = img;

const cta = node.getComponent('GameCta') || node.addComponent('GameCta');
cta.bridge = canvas.getComponent('MraidBridge');

// 竖屏那条边交给 Widget（画布多高它自己跟），横屏由 LandscapeLayout 接管时先把它关掉。
// ⚠️ 别调 `widget.updateAlignment()`：编辑模式下它会把 `_bottom` 按节点当前矩形**回写**一遍，
// 而画布子节点的本地坐标和它算的内缩量对不上，回写出来的数是错的（实测 6 → 16.367 → 节点被推高
// 21.84px），存进场景的就是那个错值。只写内缩量就够 —— 编辑器下一次 Wizard 重排自己会把这节点摆到
// 该在的地方（实测滚回 -610），运行期更是照 `_bottom` 现算。
const widget = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
widget.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
widget.isAlignBottom = true;
widget.isAlignHorizontalCenter = true;
widget.isAlignTop = widget.isAlignLeft = widget.isAlignRight = widget.isAlignVerticalCenter = false;
widget.bottom = BOTTOM;
// 存场景时先塞一版对的坐标（编辑模式的重排要等下一拍，保存比它早）
node.setPosition(0, -(cut.height * cut.anchorY) + BOTTOM + SIZE[1] * 0.5, 0);

const landscape = canvas.getComponent('LandscapeLayout');
if (landscape) landscape.cta = node;

return {
    pick: PICK,
    path: 'Canvas/' + node.name,
    sibling: node.getSiblingIndex(),
    canvasChildren: canvas.children.map((c) => c.name),
    pos: [node.position.x, node.position.y],
    size: [ut.width, ut.height],
    img: { size: [imgUt.width, imgUt.height], frame: imgSp.spriteFrame ? imgSp.spriteFrame.name : null, sizeMode: imgSp.sizeMode, type: imgSp.type },
    button: { transition: button.transition, zoomScale: button.zoomScale, target: button.target ? button.target.name : null, spriteOnSelf: !!node.getComponent(cc.Sprite) },
    widget: { align: [widget.isAlignBottom, widget.isAlignHorizontalCenter].join(','), bottom: widget.bottom, mode: widget.alignMode },
    cta: { bridge: cta.bridge ? cta.bridge.node.name : null, breathScale: cta.breathScale, breathTime: cta.breathTime },
    landscapeCta: landscape ? (landscape.cta ? landscape.cta.name : null) : 'no-component',
};
