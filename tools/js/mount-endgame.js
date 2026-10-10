/**
 * 终局跳转接线，配套 `assets/scripts/platform/EndgameCta.ts`（见 CLAUDE.md §14）。
 *
 *   node tools/exec.mjs scene tools/js/mount-endgame.js
 *
 * 做三件事：
 *
 * 1. `UILayer/CtaLayer` 挂 `EndgameCta`。
 * 2. 三个口指过去：`bridge` = `Canvas` 上的 `MraidBridge`、`failRoot` = `CtaRoot/Fail`、
 *    `failButton` = `Fail/btn` 的 `Button`。
 * 3. 给 `Fail` 节点补一个 `UIOpacity` —— 修错那一下整棵淡入打的是它（`Fail/bg` 上那个只管自己）。
 *    ⚠️ 缺了它 `EndgameCta.showFail()` 里 `this._fade` 是 null，淡入整段被跳过：界面照样出，
 *    只是硬切一下。`verify-scene.js` 会拦这条。
 * 4. 给 `Fail` 补四边 `Widget` —— 它原来**一个都没有**（尺寸钉在场景里那个 720×1280），
 *    横屏画布变宽（1770×1280）之后整棵 Fail 只剩中间 720px 宽，`Fail/bg`（半透明黑罩）
 *    自己那四边 Widget 是对着父节点这个死框对齐的，于是左右两边露着 —— 就是
 *    「失败界面的背景没像结束界面那样铺满横屏」。`End` 一直有四边 Widget（`mount-end-card.js` 里那个
 *    `stretch()` 铺到 `End/bg` 为止），所以它横屏是满的。
 *
 * 幂等：重复跑只再赋一次同样的值。
 *
 * ⚠️ `Fail` 自己的 `Sprite` 已齐、按钮的 `Button` 已齐，这两样不动。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const cta = canvas.getChildByPath('UILayer/CtaLayer');
const root = cta.getChildByName('CtaRoot');
const fail = root.getChildByName('Fail');
const failBtn = fail.getChildByName('btn');

if (!fail.getComponent(cc.UIOpacity)) fail.addComponent(cc.UIOpacity);

// 四边对齐铺满父节点（`CtaRoot` 本身就是四边对齐的，所以这条链一路铺到屏幕）——
// 和 `mount-end-card.js` 里给 `End` 那套逐字一致
const fw = fail.getComponent(cc.Widget) || fail.addComponent(cc.Widget);
fw.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
fw.isAlignTop = fw.isAlignBottom = fw.isAlignLeft = fw.isAlignRight = true;
fw.isAlignHorizontalCenter = fw.isAlignVerticalCenter = false;
fw.top = fw.bottom = fw.left = fw.right = 0;
// WidgetManager 的整树重排要等下一次 AFTER_UPDATE，编辑模式不一定跑得到（见 CLAUDE.md §14）
fw.updateAlignment();

const ctrl = cta.getComponent('EndgameCta') || cta.addComponent('EndgameCta');
ctrl.bridge = canvas.getComponent('MraidBridge');
ctrl.failRoot = fail;
ctrl.failButton = failBtn.getComponent(cc.Button);

return {
    node: ctrl.node.name,
    bridge: ctrl.bridge ? ctrl.bridge.node.name : null,
    failRoot: ctrl.failRoot ? ctrl.failRoot.name : null,
    failActive: ctrl.failRoot ? ctrl.failRoot.active : null,
    failOpacity: !!fail.getComponent(cc.UIOpacity),
    failWidget: [fw.isAlignLeft, fw.isAlignBottom, fw.isAlignRight, fw.isAlignTop].join(''),
    failSize: [fail.getComponent(cc.UITransform).width, fail.getComponent(cc.UITransform).height],
    failButton: ctrl.failButton ? ctrl.failButton.node.name : null,
    buttonTarget: ctrl.failButton && ctrl.failButton.target ? ctrl.failButton.target.name : null,
    winCount: ctrl.winCount,
    failFadeTime: ctrl.failFadeTime,
};
