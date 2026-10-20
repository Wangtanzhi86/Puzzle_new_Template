/**
 * 把进度条挪到拖拽层下面：拖起来的碎片要盖住进度条。
 *
 * Canvas 目标顺序：
 *   ... / PiecePoolLayer / ProgressLayer / DragRoot / EffectLayer / UILayer(GuideLayer, CtaLayer) / GameCta
 *
 * 只动 ProgressLayer 的父节点与兄弟序，不改它的位置、尺寸、组件；
 * 世界坐标会保住（UILayer 本身在 0,0、scale 1）。
 * 幂等：已经在 Canvas 下且排在 DragRoot 前面时不做任何事。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
if (!canvas) return { ok: false, error: '找不到 Canvas' };

const dragRoot = canvas.getChildByName('DragRoot');
if (!dragRoot) return { ok: false, error: '找不到 Canvas/DragRoot' };

const uiLayer = canvas.getChildByName('UILayer');
let progress = canvas.getChildByName('ProgressLayer') || (uiLayer && uiLayer.getChildByName('ProgressLayer'));
if (!progress) return { ok: false, error: '找不到 ProgressLayer' };

const before = canvas.children.map((n) => n.name);
const parentBefore = progress.parent ? progress.parent.name : null;

if (progress.parent !== canvas) {
    const world = progress.worldPosition.clone();
    progress.setParent(canvas);
    progress.setWorldPosition(world);
}
if (progress.getSiblingIndex() > dragRoot.getSiblingIndex()) {
    progress.setSiblingIndex(dragRoot.getSiblingIndex());
}

return {
    ok: true,
    parentBefore,
    parentAfter: progress.parent ? progress.parent.name : null,
    before,
    after: canvas.children.map((n) => n.name),
    progressIndex: progress.getSiblingIndex(),
    dragIndex: dragRoot.getSiblingIndex(),
    progressPos: [progress.position.x, progress.position.y],
    progressWorld: [progress.worldPosition.x, progress.worldPosition.y],
};
