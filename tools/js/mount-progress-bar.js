/**
 * 进度条外观接线，配套 `assets/scripts/ui/ProgressController.ts`（见 AGENTS.md §14「进度条」）。
 *
 *   node tools/exec.mjs scene tools/js/mount-progress-bar.js
 *
 * 不用美术图了（原来是「进度条框.png」500×55 + 「进度条.png」493×48 两张药丸图）：
 *   UILayer/ProgressLayer
 *   ├── 进度条底   Sprite：纯白.png（4×4 纯白），SIMPLE，颜色 = 半透明白 —— 细长条
 *   └── 进度条     Sprite：同一张图，FILLED / HORIZONTAL，颜色 = 不透明白 —— 白色填充
 * 颜色 / 透明度 / 尺寸全在 Inspector 里改（底是 Sprite 颜色的 a，填充是 Sprite 颜色），
 * `ProgressController` 照旧只推 `fillRange`，一行代码没动。
 *
 * 尺寸 460×16（ProgressLayer 本身 460×90）：宽等于层宽，高 16 就是「细长条」。位置沿用老进度条的中心
 * 局部 y = 12.141，屏幕上和原来落在同一处。**填充必须排在底后面**（兄弟序），否则被底整个盖住。
 *
 * 幂等：重复跑只再赋一次同样的值（老的两张图节点会先退掉）。
 */
const canvas = cc.director.getScene().getChildByName('Canvas');
const uiLayer = canvas.getChildByName('UILayer');
const progressLayer = uiLayer && uiLayer.getChildByName('ProgressLayer');
if (!progressLayer) return { ok: false, error: '找不到 UILayer/ProgressLayer' };

// assets/recourses/UI及背景/纯白.png（4×4 纯白，.meta 里 packable = false：
// FILLED 裁边时线性采样会吃到动态图集里紧挨着的邻居像素，边上会冒一条杂色）
const WHITE_UUID = '98fe4b8a-baa7-4b93-9e58-9dff5739d0a2@f9941';
const SIZE = [460, 16];
const Y = 12.141;                 // 老进度条的中心，保持原来那个位置
const TRACK = [255, 255, 255, 70];   // 半透明白
const FILL = [255, 255, 255, 255];   // 纯白

for (const name of ['进度条框', '进度条']) {
    const old = progressLayer.getChildByName(name);
    if (old) {
        old.removeFromParent();
        old.destroy();
    }
}

const frame = await new Promise((resolve, reject) => {
    cc.assetManager.loadAny(WHITE_UUID, (err, asset) => (err ? reject(new Error(WHITE_UUID + ' -> ' + err.message)) : resolve(asset)));
});

const make = (name, color, filled, index) => {
    let node = progressLayer.getChildByName(name);
    if (!node) {
        node = new cc.Node(name);
        node.setParent(progressLayer);
    }
    node.layer = canvas.layer;
    node.setSiblingIndex(index);
    node.setPosition(0, Y, 0);
    const ut = node.getComponent(cc.UITransform) || node.addComponent(cc.UITransform);
    ut.setAnchorPoint(0.5, 0.5);
    const sp = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
    // 顺序不能反：赋 spriteFrame 会立刻按当前尺寸模式把节点框改写成贴图尺寸（默认 TRIMMED）
    sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    sp.type = filled ? cc.Sprite.Type.FILLED : cc.Sprite.Type.SIMPLE;
    sp.trim = false;
    sp.spriteFrame = frame;
    sp.color = new cc.Color(color[0], color[1], color[2], color[3]);
    ut.setContentSize(SIZE[0], SIZE[1]);
    return { node, ut, sp };
};

const track = make('进度条底', TRACK, false, 0);
const rawFill = make('进度条', FILL, true, 1);
rawFill.sp.fillType = cc.Sprite.FillType.HORIZONTAL;
rawFill.sp.fillStart = 0;
rawFill.sp.fillEnd = 1;
rawFill.sp.fillRange = 0;
// 编辑模式不 tick TweenSystem，场景面板里填充永远是空的（这个 0 就是场景里存的值）

const cls = cc.js.getClassByName('ProgressController');
const ctrl = uiLayer.getComponent(cls);
ctrl.fill = rawFill.sp;

return {
    ok: true,
    layer: { size: [progressLayer.getComponent(cc.UITransform).width, progressLayer.getComponent(cc.UITransform).height], children: progressLayer.children.map((c) => c.name) },
    track: { size: [track.ut.width, track.ut.height], pos: [track.node.position.x, track.node.position.y], color: [track.sp.color.r, track.sp.color.g, track.sp.color.b, track.sp.color.a], type: track.sp.type },
    fill: { size: [rawFill.ut.width, rawFill.ut.height], pos: [rawFill.node.position.x, rawFill.node.position.y], color: [rawFill.sp.color.r, rawFill.sp.color.g, rawFill.sp.color.b, rawFill.sp.color.a], type: rawFill.sp.type, fillType: rawFill.sp.fillType, range: rawFill.sp.fillRange },
    frame: { name: rawFill.sp.spriteFrame.name, packable: frame.packable },
    controllerBound: ctrl.fill === rawFill.sp,
};
