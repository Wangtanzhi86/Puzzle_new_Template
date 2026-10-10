/**
 * 结束界面接线，配套 `assets/scripts/platform/CtaController.ts`（见 CLAUDE.md §14）。
 *
 *   node tools/exec.mjs scene tools/js/mount-end-card.js
 *
 * 做四件事：
 *
 * 1. `CtaLayer / CtaRoot / End / End/bg` 全挂四边 Widget —— `UILayer` 本来就是四边对齐的，
 *    这条链补齐之后 `bg` 才真的铺满画布（横屏画布约 1770×1280，不补就是中间一块 720 宽的卡片）。
 *    `End/bg` 顺带改成 `SLICED`（九宫格别让它横拉时构图变形）并挂 `UIOpacity`（起播要淡入）。
 *
 * 2. `CtaRoot` 再挂一个 `BackgroundSwap`（`bg` 口 = `End/bg` 的 Sprite），和
 *    `Canvas/BackgroundLayer` 上那个是同一个组件的两个实例，互不干扰。
 *    ⚠️ 横屏那张底图（`landscapeFrame`）**不在这里配**：旧素材已删，场景里是 null，
 *    等美术出图后在 Inspector 里拖进去（别再写死 uuid —— 重新导入就会变）。
 *
 * 3. `End/btn` 拆出一个子节点 `Img` 承接那张 Sprite，`Button` 的 `target` 指向 `Img`。
 *    ⚠️ **不能直接缩 `btn` 自己**：引擎的 `_handleTouchEnd` 会拿**当前缩放后**的矩形做 hitTest
 *    （`cocos/scene-graph/node-event-processor.ts:671`），缩到 0.9 之后贴着边按下再松手会被判成
 *    TOUCH_CANCEL，`Button` 收不到 TOUCH_END 就不发 CLICK —— CTA 点击会丢。缩子节点则 `btn` 的
 *    命中框一动不动，怎么按都收得到。顺带把「下落动画写 btn 的 scale」和「按下反馈写 Img 的 scale」
 *    也隔开了。
 *
 * 4. `CtaController` 的五个口全部指过去。
 *
 * 幂等：重复跑只再赋一次同样的值（`Img` 已存在就复用，不会越跑越多）。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const cta = canvas.getChildByPath('UILayer/CtaLayer');
const root = cta.getChildByName('CtaRoot');
const end = root.getChildByName('End');
const bgNode = end.getChildByName('bg');
const logoNode = end.getChildByName('logo');
const btnNode = end.getChildByName('btn');

/** 四边对齐铺满父节点（`UILayer` 就是画布大小，所以这条链一路铺到屏幕） */
function stretch(node) {
    const w = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
    w.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
    w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
    w.isAlignHorizontalCenter = w.isAlignVerticalCenter = false;
    w.top = w.bottom = w.left = w.right = 0;
    return w;
}
for (const n of [cta, root, end, bgNode]) stretch(n);

const bgSp = bgNode.getComponent(cc.Sprite);
bgSp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
bgSp.type = cc.Sprite.Type.SLICED;
if (!bgNode.getComponent(cc.UIOpacity)) bgNode.addComponent(cc.UIOpacity);

// 竖屏那张底图不另配口：`BackgroundSwap.onLoad` 读的就是 `bg` 上挂着的那张
const swap = root.getComponent('BackgroundSwap') || root.addComponent('BackgroundSwap');
swap.bg = bgSp;

// 按钮：Sprite 挪到子节点 `Img`，命中框留在 `btn` 自己身上
const btnSp = btnNode.getComponent(cc.Sprite);
const btnUt = btnNode.getComponent(cc.UITransform);
let img = btnNode.getChildByName('Img');
if (!img) {
    img = new cc.Node('Img');
    img.setParent(btnNode);
    img.setPosition(0, 0, 0);
}
const imgUt = img.getComponent(cc.UITransform) || img.addComponent(cc.UITransform);
imgUt.setContentSize(btnUt.width, btnUt.height);
const imgSp = img.getComponent(cc.Sprite) || img.addComponent(cc.Sprite);
if (btnSp) {
    imgSp.spriteFrame = btnSp.spriteFrame;
    imgSp.sizeMode = btnSp.sizeMode;
    imgSp.type = btnSp.type;
    imgSp.color = btnSp.color.clone();
    btnNode.removeComponent(btnSp);
}

const button = btnNode.getComponent(cc.Button) || btnNode.addComponent(cc.Button);
button.transition = cc.Button.Transition.SCALE;
button.zoomScale = 0.9;
button.duration = 0.08;
button.target = img;

const ctrl = cta.getComponent('CtaController');
ctrl.ctaRoot = end;
ctrl.bg = bgNode;
ctrl.logo = logoNode;
ctrl.ctaButton = button;

// WidgetManager 的整树重排要等下一次 AFTER_UPDATE，编辑模式不一定跑得到 ——
// 自上而下刷一遍，否则存进场景的 UITransform 停在中间态（见 CLAUDE.md §14）
for (const n of [cta, root, end, bgNode]) {
    const w = n.getComponent(cc.Widget);
    if (w) w.updateAlignment();
}

const four = (n) => {
    const w = n.getComponent(cc.Widget);
    return w ? [w.isAlignLeft, w.isAlignBottom, w.isAlignRight, w.isAlignTop].join('') : 'none';
};
return {
    widget: { cta: four(cta), root: four(root), end: four(end), bg: four(bgNode) },
    endSize: [end.getComponent(cc.UITransform).width, end.getComponent(cc.UITransform).height],
    bg: { type: bgSp.type, sizeMode: bgSp.sizeMode, size: [bgNode.getComponent(cc.UITransform).width, bgNode.getComponent(cc.UITransform).height], opacity: !!bgNode.getComponent(cc.UIOpacity), frame: bgSp.spriteFrame ? bgSp.spriteFrame.name : '<空>' },
    swap: { node: swap.node.name, bg: swap.bg.node.name, landscapeFrame: swap.landscapeFrame ? swap.landscapeFrame.name : null },
    button: { node: button.node.name, transition: button.transition, zoomScale: button.zoomScale, target: button.target ? button.target.name : null, spriteOnBtnNode: !!btnNode.getComponent(cc.Sprite), imgFrame: imgSp.spriteFrame ? imgSp.spriteFrame.name : null, imgSize: [imgUt.width, imgUt.height] },
    ctrl: { ctaRoot: ctrl.ctaRoot.name, bg: ctrl.bg.name, logo: ctrl.logo.name, ctaButton: ctrl.ctaButton ? ctrl.ctaButton.node.name : null, bridge: ctrl.bridge ? ctrl.bridge.node.name : null },
};
