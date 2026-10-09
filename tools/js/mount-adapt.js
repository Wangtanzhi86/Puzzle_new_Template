/**
 * 竖屏撑满屏幕的场景侧接线，配套 `assets/scripts/ui/ScreenAdapter.ts`。
 * 策略那一半在脚本里（SHOW_ALL 会把画布钉死在 720×1280，多出来的屏幕没人画 → 上下两条黑边），
 * 但画布变高之后下面这三处得跟着改，否则黑边没了、构图却散了：
 *
 *   1. `BackgroundLayer/Bg_Sprite` —— 原来没有 Widget，只靠尺寸刚好等于 720×1280 才看着铺满；
 *      补四边 Widget，宽高模式改 CUSTOM（不然 Sprite 会拿贴图尺寸把自己缩回去），
 *      type 改 SLICED —— `背景图.jpg` 的九宫格四边各留了 160px，拉伸时只拉中间那段。
 *   2. `GameLayer` / `PiecePoolLayer` / `UILayer/ProgressLayer` —— 三处**一条边都不贴**，尺寸钉死。
 *      它们原来都锚在画布底边上（那是按「画布 == 设计稿」摆的），画布一变高就整体往下挪了多出来的
 *      那一半，长屏上就是「内容偏下」。不贴边之后节点停在设计稿里的位置，而设计稿居中在画布上 ——
 *      构图和 SHOW_ALL 时一模一样。尺寸不钉死的话 L/R 会让它们跟着画布变宽，`Scene_BG` /
 *      `完成背景` / RECT Mask / 碎片池全被横向拉长。
 *
 *   node tools/exec.mjs scene tools/js/mount-adapt.js
 *
 * 幂等：重复跑只是再赋一次同样的值。横竖屏共用这一套 —— 横屏也走「补长边」（补宽度），画布变宽、构图居中同样靠它。
 * 要横屏两栏（拼图区放大 + 竖池子在右）得写代码，Widget 表达不了，见 CLAUDE.md §7.1。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const canvasH = canvas.getComponent(cc.UITransform).height;

const fourEdge = (node) => {
  const w = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
  w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
  w.top = w.bottom = w.left = w.right = 0;
  w.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
  return w;
};

// 1. 整屏背景：拉满 + 九宫格
//    左右各留 160 是为了「比设计稿宽的窗口」（横屏 / iPad 竖屏 / 矮胖的 Game View 面板，
//    这时走 FIXED_HEIGHT，画布比 720 宽）—— 不补的话整张图横向拉长。
//    画布正好 720 宽时左右这两条是空操作（节点宽 = 图宽，中段 1:1 不拉）。
const bg = canvas.getChildByPath('BackgroundLayer/Bg_Sprite');
const bgUt = bg.getComponent(cc.UITransform);
const bgWidget = fourEdge(bg);
const bgSprite = bg.getComponent(cc.Sprite);
bgSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
bgSprite.type = cc.Sprite.Type.SLICED;

// 2. 玩法内容整体居中：这三处**一条边都不贴**，尺寸钉死
//    「补长边」之后画布比设计稿多一条边。原来 GameLayer（bottom 461.441）、碎片池（bottom 56.187）、
//    进度条（bottom 354.579）都锚在画布底边上 —— 那是按「画布 == 设计稿」摆的；画布一变高，
//    它们就整体往下挪了多出来的那一半，长屏上看着就是「内容偏下、顶上空的」。一条边都不贴之后，
//    节点停在设计稿里的位置（GameLayer y=195.72 / 池子 y=-433.813 / 进度条 y=-240.421），
//    而设计稿本来就居中在画布上 —— 于是构图和 SHOW_ALL 时一模一样，只是黑边被背景填了。
//    尺寸必须显式再钉一次：对齐边一拆，节点就回去用**自己存的 contentSize**（GameLayer 存的是
//    980，不是摆出来的 748.559），宽高当场就错了。这几个数是场景里摆好的，不是算出来的。
//    （拆之前 L/R 对齐也会让它跟着画布一起变宽，把 Scene_BG / 完成背景 / RECT Mask 横向拉长。）
const unanchor = (node, w, h) => {
  const ut = node.getComponent(cc.UITransform);
  const wd = node.getComponent(cc.Widget) || node.addComponent(cc.Widget);
  wd.isAlignTop = wd.isAlignBottom = wd.isAlignLeft = wd.isAlignRight = false;
  wd.isAlignHorizontalCenter = wd.isAlignVerticalCenter = false;
  wd.alignMode = cc.Widget.AlignMode.ON_WINDOW_RESIZE;
  ut.setContentSize(w, h);
  wd.updateAlignment();
  return wd;
};

const gameWidget = unanchor(canvas.getChildByName('GameLayer'), 580, 748.559);
const poolLayer = canvas.getChildByName('PiecePoolLayer');
const poolWidget = unanchor(poolLayer, 720, 300);
const progress = canvas.getChildByPath('UILayer/ProgressLayer');
const progUt = progress.getComponent(cc.UITransform);
const progWidget = unanchor(progress, progUt.width, progUt.height);

// WidgetManager 的整树重排要等下一次 AFTER_UPDATE，编辑模式不一定跑得到，
// 这里自上而下手动刷一遍，免得存进场景的 UITransform 还停在中间态（GameLayer 一度是 980 的）。
const settle = (n) => {
  const w = n.getComponent(cc.Widget);
  if (w) w.updateAlignment();
  n.children.forEach(settle);
};
canvas.children.forEach(settle);

const brief = (w) => (w ? { t: w.isAlignTop, b: w.isAlignBottom, l: w.isAlignLeft, r: w.isAlignRight, hc: w.isAlignHorizontalCenter, vc: w.isAlignVerticalCenter, mode: w.alignMode } : null);
const sizeOf = (n) => { const u = n.getComponent(cc.UITransform); return [u.width, u.height]; };
return {
  canvasH,
  bg: { size: [bgUt.width, bgUt.height], widget: brief(bgWidget), sizeMode: bgSprite.sizeMode, type: bgSprite.type, frame: bgSprite.spriteFrame ? bgSprite.spriteFrame.name : null, inset: bgSprite.spriteFrame ? [bgSprite.spriteFrame.insetTop, bgSprite.spriteFrame.insetBottom, bgSprite.spriteFrame.insetLeft, bgSprite.spriteFrame.insetRight] : null },
  centered: [
    { n: 'GameLayer', pos: [canvas.getChildByName('GameLayer').position.x, canvas.getChildByName('GameLayer').position.y], size: sizeOf(canvas.getChildByName('GameLayer')), widget: brief(gameWidget) },
    { n: 'PiecePoolLayer', pos: [poolLayer.position.x, poolLayer.position.y], size: sizeOf(poolLayer), widget: brief(poolWidget) },
    { n: 'ProgressLayer', pos: [progress.position.x, progress.position.y], size: sizeOf(progress), widget: brief(progWidget) },
  ],
  sceneBg: sizeOf(canvas.getChildByPath('GameLayer/Scene_BG')),
};
