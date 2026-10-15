/**
 * 游戏中那个常驻下载按钮的接线，配套 `assets/scripts/platform/GameCta.ts`（见 AGENTS.md §14）。
 *
 *   node tools/exec.mjs scene tools/js/mount-game-cta.js
 *
 * 外观不用美术图（原来是「按钮.png」整张 720×240 缩到 0.2，糊）：`Bg` 是「圆角白.png」九宫格
 * + Sprite 颜色当纯色圆角底，`Text` 是系统字 "PLAY NOW"。颜色 / 字号 / 文案全在 Inspector 里改，
 * 改尺寸不用重出图。
 *
 * 层级：
 *   GameCta        Button（缩放目标 = Bg）+ Widget + GameCta 组件
 *   └── Bg         Sprite：圆角白.png，SLICED，颜色 = 纯色底
 *       └── Text   Label：系统字 "PLAY NOW"，白色加粗
 *
 * ⚠️ 缩的必须是子节点：引擎的 `_handleTouchEnd` 按**缩放后**的框做 hitTest，缩 `GameCta` 自己
 * 会让贴边按下再松手判成 TOUCH_CANCEL，`Button` 收不到 TOUCH_END 就不发 CLICK（CTA 点击丢）。
 * 字挂在 `Bg` 下面而不是并排，是为了按下时整块（底 + 字）一起缩。
 *
 * 尺寸 176×48 —— 高度 48 是「画布正好 720×1280（16:9 竖屏）」时碎片池可点区下沿到画布下沿之间
 * 能塞下的最大值，再高一点上半截就压进 `ScrollView` 的矩形里，那一段触摸会被它认领（宽度不受这条限制）。
 *
 * 竖屏贴下沿靠节点上一个 Widget（`bottom = 6`），横屏那一套在 `LandscapeLayout.toLandscape()` 里
 *（它才量得到拼图列多宽，左边空位的中点得按它算）—— 所以这里只配 Widget，不写死坐标。
 *
 * 幂等：重复跑只再赋一次同样的值。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');

// assets/recourses/UI及背景/圆角白.png（48×48，圆角半径 16，.meta 四边 border = 16，packable = false）
const ROUND_UUID = 'c1e742c6-3e67-476a-8f73-ac6675e2f1f0@f9941';
const SIZE = [176, 48];
const BOTTOM = 6;
const COLOR = [52, 168, 83];   // 纯色底：绿，和结束界面那张「按钮.png」同一个色系

let node = canvas.getChildByName('GameCta');
if (!node) {
    node = new cc.Node('GameCta');
    node.setParent(canvas);
}
node.setSiblingIndex(canvas.children.length - 1);
node.layer = canvas.layer;

const ut = node.getComponent(cc.UITransform) || node.addComponent(cc.UITransform);
ut.setContentSize(SIZE[0], SIZE[1]);
ut.setAnchorPoint(0.5, 0.5);
node.setScale(1, 1, 1);   // 呼吸 tween 拿它当基准，基准得是 1

// 老版本那个整张按钮图的子节点，现在不要了
const old = node.getChildByName('Img');
if (old) {
    old.removeFromParent();
    old.destroy();
}

const frame = await new Promise((resolve, reject) => {
    cc.assetManager.loadAny(ROUND_UUID, (err, asset) => (err ? reject(new Error(ROUND_UUID + ' -> ' + err.message)) : resolve(asset)));
});

let bg = node.getChildByName('Bg');
if (!bg) {
    bg = new cc.Node('Bg');
    bg.setParent(node);
}
bg.layer = node.layer;
bg.setPosition(0, 0, 0);
const bgUt = bg.getComponent(cc.UITransform) || bg.addComponent(cc.UITransform);
const bgSp = bg.getComponent(cc.Sprite) || bg.addComponent(cc.Sprite);
// 顺序不能反：赋 spriteFrame 会立刻按当前尺寸模式把节点框改写成贴图尺寸（默认 TRIMMED），
// 先钉 CUSTOM 再赋图，最后才定尺寸。
bgSp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
bgSp.type = cc.Sprite.Type.SLICED;
bgSp.trim = false;
bgSp.spriteFrame = frame;
bgSp.color = new cc.Color(COLOR[0], COLOR[1], COLOR[2], 255);
bgUt.setContentSize(SIZE[0], SIZE[1]);

let text = bg.getChildByName('Text');
if (!text) {
    text = new cc.Node('Text');
    text.setParent(bg);
}
text.layer = node.layer;
text.setPosition(0, 0, 0);
const label = text.getComponent(cc.Label) || text.addComponent(cc.Label);
label.string = 'PLAY NOW';
label.useSystemFont = true;
label.fontFamily = 'Arial';
label.isBold = true;
label.fontSize = 24;
label.lineHeight = 28;
label.overflow = cc.Label.Overflow.NONE;   // 节点尺寸跟着文字走，改文案不用再对尺寸
label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
label.verticalAlign = cc.Label.VerticalAlign.CENTER;
label.color = cc.Color.WHITE;

const button = node.getComponent(cc.Button) || node.addComponent(cc.Button);
button.transition = cc.Button.Transition.SCALE;
button.zoomScale = 0.9;
button.duration = 0.08;
button.target = bg;

const cta = node.getComponent('GameCta') || node.addComponent('GameCta');
cta.bridge = canvas.getComponent('MraidBridge');

// 存场景时先塞一版对的坐标（编辑模式的重排要等下一拍，保存比它早）
const cut = canvas.getComponent(cc.UITransform);
node.setPosition(0, -(cut.height * cut.anchorY) + BOTTOM + SIZE[1] * 0.5, 0);

// 竖屏那条边交给 Widget（画布多高它自己跟），横屏由 LandscapeLayout 接管时先把它关掉。
// ⚠️ 这一段必须排在**所有改节点框 / 位置的操作之后**：编辑模式下 Widget 监听节点的 TRANSFORM_CHANGED，
// 节点一动它就把 `_bottom` 按新位置**回写**一遍（`_adjustWidgetToAllowMovingInEditor`），后写的赢。
// 顺序反了就会存下错的 `_bottom`（实测 setPosition 比 `bottom = 6` 晚 → 落盘 -5.473）。
// ⚠️ 也别调 `widget.updateAlignment()`：同理，它按节点当前矩形回写内缩量，画布子节点的本地坐标和
// 它算出来的对不上（实测 6 → 16.367，节点被顶高 21.84px）。只写内缩量就够 —— 编辑器下一拍自己会把
// 节点摆到该在的地方，运行期更是照 `_bottom` 现算。
const widget = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
widget.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
widget.isAlignBottom = true;
widget.isAlignHorizontalCenter = true;
widget.isAlignTop = widget.isAlignLeft = widget.isAlignRight = widget.isAlignVerticalCenter = false;
widget.bottom = BOTTOM;

const landscape = canvas.getComponent('LandscapeLayout');
if (landscape) landscape.cta = node;

return {
    path: 'Canvas/' + node.name,
    sibling: node.getSiblingIndex(),
    canvasChildren: canvas.children.map((c) => c.name),
    pos: [node.position.x, node.position.y],
    size: [ut.width, ut.height],
    bg: {
        size: [bgUt.width, bgUt.height], frame: bgSp.spriteFrame ? bgSp.spriteFrame.name : null,
        sizeMode: bgSp.sizeMode, type: bgSp.type, inset: [frame.insetTop, frame.insetBottom, frame.insetLeft, frame.insetRight],
        color: [bgSp.color.r, bgSp.color.g, bgSp.color.b, bgSp.color.a], packable: frame.packable, children: bg.children.map((c) => c.name),
    },
    text: {
        string: label.string, size: [text.getComponent(cc.UITransform).width, text.getComponent(cc.UITransform).height],
        fontSize: label.fontSize, bold: label.isBold, systemFont: label.useSystemFont, color: [label.color.r, label.color.g, label.color.b, label.color.a],
    },
    button: { transition: button.transition, zoomScale: button.zoomScale, target: button.target ? button.target.name : null, spriteOnSelf: !!node.getComponent(cc.Sprite) },
    widget: { align: [widget.isAlignBottom, widget.isAlignHorizontalCenter].join(','), bottom: widget.bottom, mode: widget.alignMode },
    cta: { bridge: cta.bridge ? cta.bridge.node.name : null, breathScale: cta.breathScale, breathTime: cta.breathTime },
    landscapeCta: landscape ? (landscape.cta ? landscape.cta.name : 'null') : 'no-component',
};
