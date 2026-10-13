const sc = cc.director.getScene();
const canvas = sc.getChildByName('Canvas');
const wanted = {
    PiecePool: ['content', 'dragRoot', 'factory', 'scrollView'],
    DragController: ['pool'],
    LevelFactory: ['brokenLayer'],
    GuideController: ['root', 'ghost', 'finger'],
    ProgressController: ['root', 'label', 'fill'],
    CtaController: ['ctaRoot', 'ctaButton', 'bridge', 'bg', 'logo'],
    EndgameCta: ['bridge', 'failRoot', 'failButton'],
    GameCta: ['bridge'],
    GameEntry: ['levelFactory'],
    MraidBridge: [],
    PlayableAnalytics: [],
    AudioManager: [],
    SnapSystem: [],
    RepairSystem: [],
    PieceSlot: ['brokenView'],
    RepairedSlot: [],
    PieceFactory: ['glowEffect', 'glowParams', 'peelFrontEffect', 'peelBackEffect'],
    FeatureFlags: [],
    TrailEmitter: [],
    RepairSweep: ['sweepEffect'],
    RepairReveal: [],
    CircleReveal: ['revealEffect'],
    StickerApply: ['frontEffect', 'backEffect'],
    SceneBgSwap: ['revealEffect', 'revealView'],
    GroupReveal: ['revealEffect'],
    IdleMotion: [],
    FlushAction: ['water'],
    BroomSweep: ['items'],
    SprayAction: ['mistFrame'],
    ExtinguishAction: ['mistFrame', 'fire'],
    HammerAction: ['fx', 'smoke'],
    GroundWater: [],
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
// 替换节点：`swapShow` 单独填就生效（这一格只「亮出显示节点」），`swapHide` 是可选的 ——
// 只填 `swapHide` 才是配错（没有要放出来的东西，整段什么都不发生）；
// 两个都填且配了渐显（swapFadeTime > 0）时两边都必须有 UIOpacity，且「显示的那个」要排在「隐藏的那个」后面
(function checkSwap(n) {
    const slot = n.getComponent('PieceSlot');
    if (slot && slot.swapHide && !slot.swapShow) {
        out.missing.push('PieceSlot@' + n.name + ' 只配了「隐藏节点」没配「显示节点」，这一格什么都没得换');
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
// 两种状态的槽位：配了「达标后的修复图」就必须配「前置槽位」—— 不配前置 `meetsRequires()` 恒为 true，
// 永远走达标那条，失败分支（展示未达标那张 + 抛 REPAIR_FAILED）一次都走不到
(function checkAlt(n) {
    const slot = n.getComponent('PieceSlot');
    if (slot && slot.altView && !slot.requires.length) {
        out.missing.push('PieceSlot@' + n.name + ' 配了「达标后的修复图」却没配「前置槽位」，失败分支永远走不到');
    }
    for (const c of n.children) checkAlt(c);
})(canvas);
// 两种「整格接管」的揭晓只能填一个：贴纸贴平 / 圆形扩散都是往同一张修复图的 Sprite 上挂材质，
// 都填了的话只有排在前面那个（贴纸）生效，另一个是配了不演的死配置
(function checkReveal(n) {
    const slot = n.getComponent('PieceSlot');
    if (slot && slot.stickerApply && slot.circleReveal) {
        out.missing.push('PieceSlot@' + n.name + ' 贴纸贴平 和 圆形扩散 都填了，只有贴纸会演');
    }
    for (const c of n.children) checkReveal(c);
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
// 地上脏水靠 FILLED/VERTICAL 的 fillRange 0→−1 从顶上刷下来：方向反了就是从下往上，配错了整块不出现
(function checkGroundWater(n) {
    const gw = n.getComponent('GroundWater');
    if (gw) {
        const sp = n.getComponent(cc.Sprite);
        if (!sp || sp.type !== cc.Sprite.Type.FILLED || sp.fillType !== cc.Sprite.FillType.VERTICAL || sp.fillStart !== 1) {
            out.missing.push('GroundWater@' + n.name + ' 不是 FILLED/VERTICAL/fillStart=1，从上往下刷不出来');
        }
    }
    for (const c of n.children) checkGroundWater(c);
})(canvas);
// 收尾动作（通马桶 / 扫地 / 喷瓶 / 灭火，§14）：淡出全靠 UIOpacity，缺一个就是取到 null 直接抛
// （淡出那步炸了，这一格的 PIECE_SHOWN 就永远不抛 —— 最后一格修好时完成背景和结束界面都不出来）。
// 扫地那组还得真有子物品可扫，空的就是整段什么都不发生。
(function checkSpot(n) {
    const slot = n.getComponent('PieceSlot');
    if (!slot) {
        for (const c of n.children) checkSpot(c);
        return;
    }
    const flush = n.getComponent('FlushAction');
    if (flush && flush.water && !flush.water.getComponent(cc.UIOpacity)) {
        out.missing.push('FlushAction@' + n.name + ' 脏水没挂 UIOpacity，淡出起不来');
    }
    const sweep = n.getComponent('BroomSweep');
    if (sweep && sweep.items) {
        if (!sweep.items.children.length) {
            out.missing.push('BroomSweep@' + n.name + ' 物品父节点下没有子节点，扫不动');
        }
        for (const c of sweep.items.children) {
            if (!c.getComponent(cc.UIOpacity)) {
                out.missing.push('BroomSweep@' + n.name + ' 物品「' + c.name + '」没挂 UIOpacity，渐隐起不来');
            }
        }
    }
    const spray = n.getComponent('SprayAction');
    if (spray) {
        for (const g of spray.gases) {
            if (!g.getComponent(cc.UIOpacity)) {
                out.missing.push('SprayAction@' + n.name + ' 气体「' + g.name + '」没挂 UIOpacity，渐隐起不来');
            }
        }
    }
    const ext = n.getComponent('ExtinguishAction');
    if (ext && ext.fire && !ext.fire.getComponent(cc.UIOpacity)) {
        out.missing.push('ExtinguishAction@' + n.name + ' 火焰节点没挂 UIOpacity，下落时的渐隐起不来');
    }
    const hammer = n.getComponent('HammerAction');
    if (hammer) {
        if (!hammer.puffs.length || !hammer.hammers.length) {
            out.missing.push('HammerAction@' + n.name + ' 没配全小烟雾 / 锤子，handles() 是 false，这一段整个不会演');
        }
        for (const p of hammer.puffs) {
            if (!p.getComponent(cc.UIOpacity)) {
                out.missing.push('HammerAction@' + n.name + ' 小烟雾「' + p.name + '」没挂 UIOpacity，渐显渐隐起不来');
            }
        }
    }
    // 喷瓶和敲击都不收修复图（它们是硬隐藏），所以不并进下面那条「有收尾动作就得挂 UIOpacity」
    const acted = flush || sweep || ext;
    if (acted && slot.repairedView && !slot.repairedView.node.getComponent(cc.UIOpacity)) {
        out.missing.push('@' + n.name + ' 有收尾动作但修复图没挂 UIOpacity，收尾那一步的淡出起不来');
    }
    for (const c of n.children) checkSpot(c);
})(canvas);
// 组揭晓：扩散材质是挂在每个节点自己的 Sprite 上的，没挂 Sprite 就是运行期直接抛；
// 槽位 / 节点空着就是「永远等不到」或「揭晓没东西可亮」
(function checkGroupReveal(n) {
    const g = n.getComponent('GroupReveal');
    if (g) {
        if (!g.slots.length) out.missing.push('GroupReveal@' + n.name + ' 没配「这一组的槽位」，永远等不到揭晓');
        if (!g.nodes.length) out.missing.push('GroupReveal@' + n.name + ' 没配「要亮出的节点」，揭晓没东西可亮');
        for (const node of g.nodes) {
            if (!node || !node.getComponent(cc.Sprite)) {
                out.missing.push('GroupReveal@' + n.name + ' 要亮出的节点里有一个没挂 Sprite，扩散材质挂不上去');
            }
        }
    }
    for (const c of n.children) checkGroupReveal(c);
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
// 终局跳转（§14）：修满 3 个或修错 → 跳商店，之后点屏幕任意处再跳。
// 淡入打的是 `Fail` 自己的 `UIOpacity`，缺了组件整段淡入被静默跳过（界面硬切一下才出来）；
// 终局后 `Fail/bg` 虽然铺满全屏但不认领触摸（点击靠全局 `input` 收），上面那颗按钮得自己接得住。
(function checkEndgame() {
    const ctrl = canvas.getChildByPath('UILayer/CtaLayer').getComponent('EndgameCta');
    if (ctrl && ctrl.failRoot && !ctrl.failRoot.getComponent(cc.UIOpacity)) {
        out.missing.push('EndgameCta 的失败界面没挂 UIOpacity，淡入起不来');
    }
    checkButton('UILayer/CtaLayer/CtaRoot/Fail/btn', 'Fail/btn');
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
// 揭角（§14）：逐格覆盖是「全有或全无」，勾上就整份换成 `peelParams` 自己的值 ——
// 没有那份（老实例还没刷出字段）就是取到 undefined 直接抛。
// 另外全局那份改了之后没重跑 `mount-sticker-apply.js` 的话，贴纸贴平那 6 个抄写值还是旧的，
// 「手上翘着的角」和「缺口上翘着的角」对不上（覆盖过的槽位不受影响，它们现读自己的那份）。
(function checkPeel() {
    const num = (a, b) => Math.abs(a - b) > 1e-6;
    (function walk(n) {
        const slot = n.getComponent('PieceSlot');
        if (slot && slot.peelOverride && !slot.peelParams) {
            out.missing.push('PieceSlot@' + n.name + ' 勾了「本格单独配揭角」却没有那份参数');
        }
        for (const c of n.children) walk(c);
    })(canvas);

    const factory = canvas.getChildByPath('PiecePoolLayer/ScrollView').getComponent('PieceFactory');
    const apply = canvas.getChildByName('EffectLayer').getComponent('StickerApply');
    // 没有任何槽位指过来时（当前 6 格全走圆形扩散）这套是死配置，两边姿势对不对得上无所谓
    let stickerUsed = false;
    (function any(n) {
        const s = n.getComponent('PieceSlot');
        if (s && s.stickerApply) stickerUsed = true;
        for (const c of n.children) any(c);
    })(canvas);
    if (!stickerUsed || !factory || !factory.peelParams || !apply || !apply.frontEffect) return;
    const p = factory.peelParams;
    const drift =
        num(p.corner.x, apply.corner.x) || num(p.corner.y, apply.corner.y) ||
        num(p.liftRatio, apply.openRatio) || num(p.stickTime, apply.applyTime) ||
        p.backColor.r !== apply.backColor.r || p.backColor.g !== apply.backColor.g || p.backColor.b !== apply.backColor.b ||
        num(p.creaseWidth, apply.creaseWidth) || num(p.creaseGlow, apply.creaseGlow);
    if (drift) out.missing.push('StickerApply 的抄写值和全局揭角参数不一致，重跑一次 mount-sticker-apply.js');
})();
return out;
