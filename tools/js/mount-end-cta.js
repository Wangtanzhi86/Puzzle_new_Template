/**
 * 结束界面那个大按钮的外观接线，和 `Canvas/GameCta` 同一套做法（见 CLAUDE.md §14「游戏中常驻的下载按钮」）。
 *
 *   node tools/exec.mjs scene tools/js/mount-end-cta.js
 *
 * 底色是「圆角白.png」九宫格 + `Sprite.color` 上色，文案是系统字 Label —— 不用美术图。
 * 原来那张「按钮.png」随 2026-10-10 换美术删掉了，`End/btn/Img` 一直是空 Sprite（见 memory
 * 「2026-10-10 换美术后的空壳表现」），这条把外观补回来。
 *
 * 层级（`Img` 是 `Button` 的缩放目标，`Text` 挂在它下面，按下时底和字一起缩）：
 *
 *   btn          Button（缩放目标 = Img）+ 692×209 的命中框，自己不带 Sprite
 *   └── Img      Sprite：圆角白.png，SLICED，颜色 = 纯色底
 *       └── Text Label：系统字 "PLAY NOW"，白色加粗
 *
 * ⚠️ 缩的必须是子节点：引擎的 `_handleTouchEnd` 按**缩放后**的框做 hitTest，缩 `btn` 自己会让
 * 贴边按下再松手判成 TOUCH_CANCEL，`Button` 收不到 TOUCH_END 就不发 CLICK（CTA 点击丢）。
 *
 * 字号按 `GameCta` 的比例定（字高约占按钮高的 7 成、宽约 7.6 成），所以这个按钮看着就是
 * 「同一个按钮放大版」。`btn` 的尺寸 / 位置 / scale 一概不动 —— 0.777 是编辑器里摆好的值，
 * `CtaController.drop()` 拿它当基准。
 *
 * 幂等：重复跑只再赋一次同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const btnNode = canvas.getChildByPath('UILayer/CtaLayer/CtaRoot/End/btn');

// assets/recourses/UI及背景/圆角白.png（48×48，圆角半径 16，.meta 四边 border = 16，packable = false）
const ROUND_UUID = 'c1e742c6-3e67-476a-8f73-ac6675e2f1f0@f9941';
const COLOR = [52, 168, 83];   // 纯色底：绿，和游戏中那个常驻按钮同色
const FONT_SIZE = 100;         // GameCta 是 24 配 48 高的底，这里按同一个比例放大

const btnUt = btnNode.getComponent(cc.UITransform);
const SIZE = [btnUt.width, btnUt.height];

// 老版本留在 btn 自己身上的 Sprite（`mount-end-card.js` 已经把它挪到 `Img` 了，这里兜个底）
const stray = btnNode.getComponent(cc.Sprite);
if (stray) btnNode.removeComponent(stray);

let img = btnNode.getChildByName('Img');
if (!img) {
    img = new cc.Node('Img');
    img.setParent(btnNode);
}
img.layer = btnNode.layer;
img.setPosition(0, 0, 0);
const imgUt = img.getComponent(cc.UITransform) || img.addComponent(cc.UITransform);
const imgSp = img.getComponent(cc.Sprite) || img.addComponent(cc.Sprite);

const frame = await new Promise((resolve, reject) => {
    cc.assetManager.loadAny(ROUND_UUID, (err, asset) => (err ? reject(new Error(ROUND_UUID + ' -> ' + err.message)) : resolve(asset)));
});

// 顺序不能反：赋 spriteFrame 会立刻按当前尺寸模式把节点框改写成贴图尺寸（默认 TRIMMED），
// 先钉 CUSTOM 再赋图，最后才定尺寸。
imgSp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
imgSp.type = cc.Sprite.Type.SLICED;
imgSp.trim = false;
imgSp.spriteFrame = frame;
imgSp.color = new cc.Color(COLOR[0], COLOR[1], COLOR[2], 255);
imgUt.setContentSize(SIZE[0], SIZE[1]);

let text = img.getChildByName('Text');
if (!text) {
    text = new cc.Node('Text');
    text.setParent(img);
}
text.layer = btnNode.layer;
text.setPosition(0, 0, 0);
const label = text.getComponent(cc.Label) || text.addComponent(cc.Label);
label.string = 'PLAY NOW';
label.useSystemFont = true;
label.fontFamily = 'Arial';
label.isBold = true;
label.fontSize = FONT_SIZE;
label.lineHeight = Math.round(FONT_SIZE * 28 / 24);
label.overflow = cc.Label.Overflow.NONE;   // 节点尺寸跟着文字走，改文案不用再对尺寸
label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
label.verticalAlign = cc.Label.VerticalAlign.CENTER;
label.color = cc.Color.WHITE;

// `Button` 本来就是 SCALE / zoom 0.9 / target = Img（`mount-end-card.js` 接的），这里只兜底
const button = btnNode.getComponent(cc.Button) || btnNode.addComponent(cc.Button);
button.transition = cc.Button.Transition.SCALE;
button.zoomScale = 0.9;
button.duration = 0.08;
button.target = img;

const textUt = text.getComponent(cc.UITransform);
return {
    path: 'Canvas/UILayer/CtaLayer/CtaRoot/End/btn',
    btn: { size: [btnUt.width, btnUt.height], pos: [btnNode.position.x, btnNode.position.y], scale: btnNode.scale.x, spriteOnSelf: !!btnNode.getComponent(cc.Sprite) },
    img: {
        size: [imgUt.width, imgUt.height], frame: imgSp.spriteFrame ? imgSp.spriteFrame.name : null,
        sizeMode: imgSp.sizeMode, type: imgSp.type, trim: imgSp.trim,
        color: [imgSp.color.r, imgSp.color.g, imgSp.color.b, imgSp.color.a],
        inset: [frame.insetTop, frame.insetBottom, frame.insetLeft, frame.insetRight], packable: frame.packable,
    },
    text: {
        string: label.string, size: [textUt.width, textUt.height], fontSize: label.fontSize,
        heightRatio: +(textUt.height / btnUt.height).toFixed(3), widthRatio: +(textUt.width / btnUt.width).toFixed(3),
        bold: label.isBold, systemFont: label.useSystemFont, color: [label.color.r, label.color.g, label.color.b, label.color.a],
    },
    button: { transition: button.transition, zoomScale: button.zoomScale, target: button.target ? button.target.name : null },
};
