const sc = cc.director.getScene();
const canvas = sc.getChildByName('Canvas');
const wanted = {
    PiecePool: ['content', 'dragRoot', 'factory', 'scrollView'],
    DragController: ['pool'],
    LevelFactory: ['brokenLayer'],
    GuideController: ['root', 'ghost', 'finger'],
    ProgressController: ['root', 'label', 'fill'],
    CtaController: ['ctaRoot', 'ctaButton', 'bridge', 'bg', 'logo'],
    GameCta: ['bridge'],
    GameEntry: ['levelFactory'],
    MraidBridge: [],
    AudioManager: [],
    SnapSystem: [],
    RepairSystem: [],
    PieceSlot: ['brokenView'],
    RepairedSlot: [],
    PieceFactory: ['glowEffect', 'glowParams'],
    FeatureFlags: [],
    TrailEmitter: [],
    RepairSweep: ['sweepEffect'],
    SwayMotion: ['opacity'],
    RiseReveal: ['sprite', 'opacity'],
    FrameLoop: ['sprite', 'frames'],
    TapeReveal: ['tapes'],
    RepairReveal: ['frames'],
    CircleReveal: ['revealEffect'],
    SceneBgSwap: ['revealEffect', 'revealView'],
    LandscapeLayout: ['gameLayer', 'progressLayer', 'poolLayer', 'poolBg', 'scrollView', 'cta'],
    BackgroundSwap: ['bg', 'landscapeFrame'],
};
const out = { found: {}, missing: [], canvasOwn: canvas.components.map((c) => cc.js.getClassName(c)) };
(function walk(n) {
    for (const comp of n.components) {
        const cname = cc.js.getClassName(comp);
        if (!(cname in wanted)) continue;
        const path = n.name;
        if (!(cname in out.found)) out.found[cname] = [];
        const refs = {};
        let bad = false;
        for (const p of wanted[cname]) {
            const v = comp[p];
            refs[p] = v ? (v.name || 'set') : null;
            if (!v) bad = true;
        }
        out.found[cname].push(bad ? path + ' !!NULL: ' + JSON.stringify(refs) : path);
        if (bad) out.missing.push(cname + '@' + path);
    }
    for (const c of n.children) walk(c);
})(canvas);
// 替换节点那两个口是可选的，但要么都填、要么都不填；
// 配了渐显（swapFadeTime > 0）时两边都必须有 UIOpacity，且「显示的那个」要排在「隐藏的那个」后面
(function checkSwap(n) {
    const slot = n.getComponent('PieceSlot');
    if (slot && !!slot.swapHide !== !!slot.swapShow) {
        out.missing.push('PieceSlot@' + n.name + ' 换掉的隐藏 / 显示节点没配齐');
    } else if (slot && slot.swapHide && slot.swapShow && slot.swapFadeTime > 0) {
        if (!slot.swapHide.getComponent(cc.UIOpacity) || !slot.swapShow.getComponent(cc.UIOpacity)) {
            out.missing.push('PieceSlot@' + n.name + ' 换节点渐显需要两个节点都挂 UIOpacity');
        }
        if (slot.swapShow.getSiblingIndex() < slot.swapHide.getSiblingIndex()) {
            out.missing.push('PieceSlot@' + n.name + ' 换出的节点排在换掉的后面才压得住，现在反了');
        }
    }
    for (const c of n.children) checkSwap(c);
})(canvas);
// 引导副本的半透明与淡入淡出全靠 UIOpacity，缺了组件运行期收不到（`hide()` 里取到 null 直接跳过）
(function checkGuide(n) {
    const g = n.getComponent('GuideController');
    if (g && g.ghost && !g.ghost.node.getComponent(cc.UIOpacity)) {
        out.missing.push('GuideController@' + n.name + ' 半透明副本没挂 UIOpacity');
    }
    for (const c of n.children) checkGuide(c);
})(canvas);
// 音频配置：没拖音效的条目静默不响；激活 / 结束事件撞一起就是刚响就停
(function checkAudio(n) {
    const a = n.getComponent('AudioManager');
    if (a) {
        a.cues.forEach((c, i) => {
            if (!c.clip) out.missing.push('AudioManager@' + n.name + ' 第' + (i + 1) + '条没拖音效');
            else if (c.event !== 'NONE' && c.event === c.stopEvent) {
                out.missing.push('AudioManager@' + n.name + ' 第' + (i + 1) + '条激活 / 结束事件是同一个，放了就停');
            }
        });
    }
    for (const c of n.children) checkAudio(c);
})(canvas);
// 胶带揭晓靠 FILLED/HORIZONTAL 的 fillRange 刷出来，配错了就是整条不出现
(function checkTapes(n) {
    const tr = n.getComponent('TapeReveal');
    if (tr) {
        for (let i = 0; i < tr.tapes.length; i++) {
            const sp = tr.tapes[i];
            if (!sp || sp.type !== cc.Sprite.Type.FILLED || sp.fillType !== cc.Sprite.FillType.HORIZONTAL) {
                out.missing.push('TapeReveal@' + n.name + ' 第' + (i + 1) + '条胶带不是 FILLED/HORIZONTAL');
            }
        }
    }
    for (const c of n.children) checkTapes(c);
})(canvas);
// 结束界面（§14）：`UILayer` 本来就是四边对齐的，`CtaLayer → CtaRoot → End → bg` 这条链少一环
// 底图就铺不满画布（横屏画布约 1770 宽，缺了就是中间一块 720 宽的卡片）。
(function checkEndCard() {
    const chain = [
        'UILayer/CtaLayer',
        'UILayer/CtaLayer/CtaRoot',
        'UILayer/CtaLayer/CtaRoot/End',
        'UILayer/CtaLayer/CtaRoot/End/bg',
    ];
    for (const p of chain) {
        const w = canvas.getChildByPath(p) && canvas.getChildByPath(p).getComponent(cc.Widget);
        if (!(w && w.isAlignTop && w.isAlignBottom && w.isAlignLeft && w.isAlignRight)) {
            out.missing.push(p + ' 没四边对齐，结束界面铺不满画布');
        }
    }
    const bgNode = canvas.getChildByPath('UILayer/CtaLayer/CtaRoot/End/bg');
    const bgSprite = bgNode && bgNode.getComponent(cc.Sprite);
    if (bgNode) {
        if (!bgNode.getComponent(cc.UIOpacity)) out.missing.push('End/bg 没挂 UIOpacity，淡入起不来');
        if (bgSprite && bgSprite.sizeMode !== cc.Sprite.SizeMode.CUSTOM) {
            out.missing.push('End/bg 不是 CUSTOM 尺寸模式，Sprite 会按贴图把自己缩回去');
        }
    }
    checkButton('UILayer/CtaLayer/CtaRoot/End/btn', 'btn');
})();
// 按钮：缩的必须是子节点。直接缩自己的话，引擎的 touchEnd 会按缩放后的框做 hitTest，
// 贴着边按下再松手会被判成 TOUCH_CANCEL，Button 收不到 TOUCH_END 就不发 CLICK —— CTA 点击丢掉
// （结束界面那个和游戏中那个常驻按钮都按这条查）
function checkButton(path, name) {
    const node = canvas.getChildByPath(path);
    const bt = node && node.getComponent(cc.Button);
    if (!bt) {
        out.missing.push(path + ' 没挂 Button，点了不会跳');
        return;
    }
    if (bt.transition !== cc.Button.Transition.SCALE) out.missing.push(name + ' 的 Button 不是 SCALE 过渡，按下没有反馈');
    if (bt.target === bt.node) out.missing.push(name + ' 的 Button 直接缩自己，贴边按下再松手会丢点击');
    if (bt.target && !bt.target.getComponent(cc.Sprite)) out.missing.push(name + ' 的 Button 缩放目标上没有 Sprite，按下看不出变化');
}
// 游戏中常驻的下载按钮（§14）：位置由 GameCta 现算，场景里查两件只能查的 ——
// 排在 PiecePoolLayer 后面（排在前面会被碎片池底图盖住），以及尺寸不压进碎片池可点区。
(function checkGameCta() {
    const node = canvas.getChildByName('GameCta');
    if (!node) {
        out.missing.push('Canvas/GameCta 不在，游戏中没有常驻下载按钮');
        return;
    }
    const pool = canvas.getChildByName('PiecePoolLayer');
    if (pool && node.getSiblingIndex() < pool.getSiblingIndex()) {
        out.missing.push('Canvas/GameCta 排在 PiecePoolLayer 前面，会被碎片池底图盖住');
    }
    checkButton('GameCta', 'GameCta');
    // 竖屏贴下沿靠 Widget（横屏由 LandscapeLayout 接管时会把它关掉），掉了就停在编辑器里那个坐标上
    const w = node.getComponent(cc.Widget);
    if (!w || !w.isAlignBottom) {
        out.missing.push('Canvas/GameCta 没有贴下沿的 Widget，竖屏它不会跟着画布走');
    }
    // 尺寸：按钮顶边压进碎片池可点区（`ScrollView` 的矩形）的话，压上的那一段触摸会被
    // ScrollView 认领，按下去没反应。世界坐标手算，别用 getBoundingBoxToWorld（会把子节点并进来）
    const sv = canvas.getChildByPath('PiecePoolLayer/ScrollView');
    const ut = node.getComponent(cc.UITransform);
    const svUt = sv && sv.getComponent(cc.UITransform);
    if (ut && svUt) {
        const top = node.worldPosition.y + ut.height * (1 - ut.anchorY);
        const poolBottom = sv.worldPosition.y - svUt.height * svUt.anchorY;
        if (top > poolBottom) {
            out.missing.push('Canvas/GameCta 顶边比碎片池可点区下沿高 ' + (top - poolBottom).toFixed(1) + 'px，那一段点不到');
        }
    }
})();
// 撑满屏幕（§7.1）：运行时画布横竖屏都会比设计稿多一条边，靠 Widget 重排撑满。
// 下面三处是钉住尺寸的，掉了就是「黑边没了、构图却散了」：
// 底图退回 SIMPLE 会被整张拉长；拼图区 / 进度条留着对齐就跟着画布跑偏。
(function checkAdapt() {
    const four = (n) => {
        const w = n && n.getComponent(cc.Widget);
        return !!w && w.isAlignTop && w.isAlignBottom && w.isAlignLeft && w.isAlignRight;
    };
    if (!four(canvas.getChildByName('BackgroundLayer')) || !four(canvas.getChildByPath('BackgroundLayer/Bg_Sprite'))) {
        out.missing.push('BackgroundLayer 或 Bg_Sprite 没四边对齐，画布多出来的那条边没人铺');
    }
    const bgSp = canvas.getChildByPath('BackgroundLayer/Bg_Sprite').getComponent(cc.Sprite);
    if (bgSp.type !== cc.Sprite.Type.SLICED) {
        out.missing.push('Bg_Sprite 不是 SLICED，画布拉长时整张底图会跟着变长');
    } else {
        const f = bgSp.spriteFrame;
        if (f && !(f.insetTop && f.insetBottom && f.insetLeft && f.insetRight)) {
            out.missing.push('背景图九宫格 inset 没配齐（' + [f.insetTop, f.insetBottom, f.insetLeft, f.insetRight].join(',') + '），等于没切');
        }
    }
    // 玩法内容这三处一条边都不许贴：贴了就会在长屏上整体偏下（画布多出来的高度全落在一侧），
    // 或者跟着画布一起变宽（底图被横向拉长）。它们靠「停在设计稿位置」居中。
    [
        ['GameLayer', canvas.getChildByName('GameLayer')],
        ['PiecePoolLayer', canvas.getChildByName('PiecePoolLayer')],
        ['UILayer/ProgressLayer', canvas.getChildByPath('UILayer/ProgressLayer')],
    ].forEach((pair) => {
        const w = pair[1] && pair[1].getComponent(cc.Widget);
        if (w && (w.isAlignTop || w.isAlignBottom || w.isAlignLeft || w.isAlignRight || w.isAlignHorizontalCenter || w.isAlignVerticalCenter)) {
            out.missing.push(pair[0] + ' 贴着画布边，长屏上内容会偏下或被拉宽（见 CLAUDE.md §7.1）');
        }
    });
})();
return out;
