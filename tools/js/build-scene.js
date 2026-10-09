/**
 * ⚠️ 跑之前先想清楚：这份脚本会把 Canvas 下所有层删掉重建。
 * 场景现在是手摆的（GameLayer 是四边 Widget 撑出来的一块、池条带抬了 62px、Slot_01 的位置
 * 和缩放都是调过的），跑一遍这些全没 —— 只在「从零拉一个 demo 场景」时才用。
 */
const R = 'db://assets/resources/素材/';
const sc = cc.director.getScene();
const canvas = sc.getChildByName('Canvas');

// EffectLayer 排在 DragRoot 之后：拖尾要盖得住碎片池底图，但盖不住 CTA
const LAYERS = ['BackgroundLayer', 'GameLayer', 'PiecePoolLayer', 'DragRoot', 'EffectLayer', 'UILayer'];
LAYERS.forEach((n) => {
    const old = canvas.getChildByName(n);
    if (old) {
        old.removeFromParent();
        old.destroy();
    }
});

async function frame(rel) {
    const id = await Editor.Message.request('asset-db', 'query-uuid', R + rel + '.png');
    return await new Promise((res, rej) => cc.assetManager.loadAny({ uuid: id + '@f9941' }, (e, a) => (e ? rej(e) : res(a))));
}

async function asset(dbPath) {
    const id = await Editor.Message.request('asset-db', 'query-uuid', dbPath);
    return await new Promise((res, rej) => cc.assetManager.loadAny({ uuid: id }, (e, a) => (e ? rej(e) : res(a))));
}

function mk(name, parent, w, h, x, y) {
    const n = new cc.Node(name);
    n.addComponent(cc.UITransform).setContentSize(w, h);
    n.setPosition(x || 0, y || 0, 0);
    if (parent) n.setParent(parent);
    return n;
}

/** 幂等挂组件：同名组件先摘干净再挂。
 *  Canvas 这类不随重建刷新的节点，重复跑脚本会攒出一堆重复组件（监听器也会翻倍）。
 *  ⚠️ 摘了再挂 = 组件上的值回到类默认值，Inspector 里调好的手感参数（§16 那张表）会被复位。
 *  FeatureFlags 单独做了存在性判断，是唯一的例外。 */
function comp(node, cls, props) {
    for (const c of node.components.slice()) {
        if (cc.js.getClassName(c) === cls) node.removeComponent(c);
    }
    const c = node.addComponent(cc.js.getClassByName(cls));
    if (props) for (const k in props) c[k] = props[k];
    return c;
}

function widget(n, e) {
    const w = n.addComponent(cc.Widget);
    w.isAlignTop = e.t !== undefined;
    w.isAlignBottom = e.b !== undefined;
    w.isAlignLeft = e.l !== undefined;
    w.isAlignRight = e.r !== undefined;
    if (e.t !== undefined) w.top = e.t;
    if (e.b !== undefined) w.bottom = e.b;
    if (e.l !== undefined) w.left = e.l;
    if (e.r !== undefined) w.right = e.r;
    return w;
}

function sprite(n, f, w, h, type) {
    const s = n.addComponent(cc.Sprite);
    s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    s.type = type || cc.Sprite.Type.SIMPLE;
    if (w !== null) n.getComponent(cc.UITransform).setContentSize(w, h);
    s.spriteFrame = f;
    return s;
}

const F = {
    outline: await frame('[厨房危机]白色边缘线/柜子_透明底_外轮廓白线_白线'),
    cabinet: await frame('916厨房危机压缩版/[完成]柜子'),
    bg: await frame('916厨房危机压缩版/[底图]客厅危机_V2_0528'),
    poolBg: await frame('poolBG'),
    finger: await frame('手指图标'),
    progress: await frame('passing/进度'),
    progressBg: await frame('passing/进度底'),
    cta: await frame('按钮'),
};

// ── 背景 ──────────────────────────────────────────────────────────────
const bgLayer = mk('BackgroundLayer', canvas, 720, 1280, 0, 0);
widget(bgLayer, { t: 0, b: 0, l: 0, r: 0 });
const bgSprite = mk('Bg_Sprite', bgLayer, 720, 894, 0, 0);
sprite(bgSprite, F.bg, 720, 894);
bgSprite.setScale(1.432, 1.432, 1);

// ── 关卡 ──────────────────────────────────────────────────────────────
const gameLayer = mk('GameLayer', canvas, 720, 980, 0, 0);
widget(gameLayer, { t: 0, b: 300, l: 0, r: 0 });
// 拼图区硬边界：矩形取节点自己的 UITransform 尺寸，跟 Widget 撑出来的框永远同尺寸
comp(gameLayer, 'cc.Mask');

// 拼图场景背景。空图占位，美术自己拖 —— 贴齐 GameLayer 四边，所以它就是「拼图目标范围」
const sceneBg = mk('Scene_BG', gameLayer, 720, 980, 0, 0);
sprite(sceneBg, null, 720, 980);
widget(sceneBg, { t: 0, b: 0, l: 0, r: 0 });

const brokenLayer = mk('BrokenLayer', gameLayer, 720, 980, 0, 0);
const repairedLayer = mk('RepairedLayer', gameLayer, 720, 980, 0, 0);

const SLOT_W = 355;
const SLOT_H = 620;

const slot1 = mk('Slot_01', brokenLayer, SLOT_W, SLOT_H, 0, 40);
const broken1 = mk('Broken', slot1, SLOT_W, SLOT_H, 0, 0);
const brokenView = sprite(broken1, F.outline, SLOT_W, SLOT_H);

const repaired1 = mk('Repaired', slot1, SLOT_W, SLOT_H, 0, 0);
const repairedView = sprite(repaired1, F.cabinet, SLOT_W, SLOT_H);
const repairedSlot = comp(repaired1, 'RepairedSlot');

const pieceSlot = comp(slot1, 'PieceSlot', {
    brokenSprite: F.outline,
    repairedSprite: F.cabinet,
    pieceId: 1,
    snapRadius: 0,
    zOrder: 0,
    brokenView: brokenView,
    repairedView: repairedSlot,
});

// ── 碎片池 ────────────────────────────────────────────────────────────
const poolLayer = mk('PiecePoolLayer', canvas, 720, 300, 0, 0);
widget(poolLayer, { b: 0, l: 0, r: 0 });

const poolBgNode = mk('PoolBG', poolLayer, 720, 300, 0, 0);
sprite(poolBgNode, F.poolBg, 720, 300);

const svNode = mk('ScrollView', poolLayer, 720, 300, 0, 0);
widget(svNode, { t: 0, b: 0, l: 0, r: 0 });
const sv = svNode.addComponent(cc.ScrollView);
const view = mk('view', svNode, 720, 280, 0, 0);
view.addComponent(cc.Mask);
const content = mk('content', view, 720, 280, 0, 0);
content.getComponent(cc.UITransform).setAnchorPoint(0.5, 0.5);
const layout = content.addComponent(cc.Layout);
layout.type = cc.Layout.Type.HORIZONTAL;
layout.resizeMode = cc.Layout.ResizeMode.CONTAINER;
layout.horizontalDirection = cc.Layout.HorizontalDirection.LEFT_TO_RIGHT;
layout.verticalDirection = cc.Layout.VerticalDirection.TOP_TO_BOTTOM;
layout.paddingLeft = 24;
layout.paddingRight = 24;
layout.spacingX = 24;
layout.affectedByScale = true;
sv.content = content;
sv.horizontal = true;
sv.vertical = false;

// ── 拖拽层 ────────────────────────────────────────────────────────────
const dragRoot = mk('DragRoot', canvas, 720, 1280, 0, 0);
widget(dragRoot, { t: 0, b: 0, l: 0, r: 0 });

// ── 特效层 ────────────────────────────────────────────────────────────
const effectLayer = mk('EffectLayer', canvas, 720, 1280, 0, 0);
widget(effectLayer, { t: 0, b: 0, l: 0, r: 0 });

// ── UI ────────────────────────────────────────────────────────────────
const uiLayer = mk('UILayer', canvas, 720, 1280, 0, 0);
widget(uiLayer, { t: 0, b: 0, l: 0, r: 0 });

// GuideLayer 里那三个节点（GuideRoot / GuideGhost / GuideFinger）不在这里建，
// 走 tools/js/mount-guide.js —— 它们要挂 UIOpacity、贴图也要现读，那个脚本更清楚
const guideLayer = mk('GuideLayer', uiLayer, 720, 1280, 0, 0);

const progressLayer = mk('ProgressLayer', uiLayer, 460, 90, 0, 500);
const progBg = mk('ProgressBg', progressLayer, 420, 46, 0, 0);
sprite(progBg, F.progressBg, 420, 46);
const progText = mk('ProgressText', progressLayer, 300, 60, 0, 0);
const progLabel = progText.addComponent(cc.Label);
progLabel.string = '0/1';
progLabel.fontSize = 36;
progLabel.lineHeight = 40;
progLabel.color = new cc.Color(255, 255, 255, 255);

const ctaLayer = mk('CtaLayer', uiLayer, 720, 1280, 0, 0);
const ctaRoot = mk('CtaRoot', ctaLayer, 720, 1280, 0, 0);
const ctaBtnNode = mk('CtaButton', ctaRoot, 520, 173, 0, -180);
const ctaSprite = sprite(ctaBtnNode, F.cta, 520, 173);
const ctaButton = ctaBtnNode.addComponent(cc.Button);
ctaButton.transition = cc.Button.Transition.SCALE;
const ctaLabelNode = mk('Label', ctaBtnNode, 400, 80, 0, 0);
const ctaLabel = ctaLabelNode.addComponent(cc.Label);
ctaLabel.string = 'INSTALL';
ctaLabel.fontSize = 52;
ctaLabel.lineHeight = 60;
ctaLabel.color = new cc.Color(90, 45, 20, 255);

// ── 组件挂载 ──────────────────────────────────────────────────────────
const pieceFactory = comp(svNode, 'PieceFactory', {
    glowEffect: await asset('db://assets/effects/piece-glow.effect'),
});
comp(effectLayer, 'TrailEmitter');
comp(effectLayer, 'RepairSweep', {
    sweepEffect: await asset('db://assets/effects/repair-sweep.effect'),
});

const poolComp = comp(poolLayer, 'PiecePool', {
    content: content,
    dragRoot: dragRoot,
    factory: pieceFactory,
    scrollView: sv,
});

const snapSystem = comp(gameLayer, 'SnapSystem');
comp(gameLayer, 'RepairSystem');
const dragController = comp(gameLayer, 'DragController', { pool: poolComp, snap: snapSystem });

const levelFactory = comp(gameLayer, 'LevelFactory', { brokenLayer: brokenLayer });

// GuideController 的三个口（root / ghost / finger）由 tools/js/mount-guide.js 接
comp(uiLayer, 'GuideController');

comp(uiLayer, 'ProgressController', { root: progressLayer, label: progLabel });

// 开关面板的值是作者在 Inspector 里勾的，走 comp() 重挂会复位成默认值 —— 只在缺失时补
if (!canvas.getComponent(cc.js.getClassByName('FeatureFlags'))) comp(canvas, 'FeatureFlags');

const mraidBridge = comp(canvas, 'MraidBridge');
comp(ctaLayer, 'CtaController', { ctaRoot: ctaRoot, ctaButton: ctaButton, bridge: mraidBridge });

comp(canvas, 'AudioManager');

comp(canvas, 'GameEntry', { levelFactory: levelFactory });

return {
    ok: true,
    canvasChildren: canvas.children.map((c) => c.name),
    slot: [slot1.position.x, slot1.position.y, SLOT_W, SLOT_H],
    frames: Object.keys(F).filter((k) => !F[k]),
};
