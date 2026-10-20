const sc = cc.director.getScene();
const canvas = sc.getChildByName('Canvas');
const wanted = {
    PiecePool: ['content', 'dragRoot', 'factory', 'scrollView'],
    DragController: ['pool'],
    AutoPlayer: ['pool'],
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
    FireworkReveal: ['revealEffect', 'burst'],
    RadialSweep: ['sweepEffect'],
    PrefillFlight: [],
    BrushReveal: ['brushEffect'],
    StickerApply: ['frontEffect', 'backEffect'],
    SceneBgSwap: ['brushEffect', 'revealView', 'dust'],
    IdleMotion: [],
    FlushAction: ['water'],
    BroomSweep: ['items'],
    SprayAction: ['mistFrame'],
    GroundWater: [],
    LandscapeLayout: ['gameLayer', 'progressLayer', 'poolLayer', 'poolBg', 'scrollView', 'cta'],
    BackgroundSwap: ['bg', 'landscapeFrame'],
    PuzzleAreaFit: ['source', 'doneBg'],
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
// 勾了「开局预填」的槽位，靠 EffectLayer 上的 PrefillFlight 在开场后补演「碎片飞进去」；
// 少了它，那格会一直停在「已铺好」，进度从 0 起，玩家看不到预放置的过程
(function checkPrefill(n) {
    const slot = n.getComponent('PieceSlot');
    if (slot && slot.prefilled && !canvas.getChildByName('EffectLayer').getComponent('PrefillFlight')) {
        out.missing.push('PieceSlot@' + n.name + ' 勾了开局预填，但 EffectLayer 没挂 PrefillFlight，不会补演飞入');
    }
    for (const c of n.children) checkPrefill(c);
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
// 三种「整格接管」的揭晓只能填一个：贴纸贴平 / 画笔涂色 / 圆形扩散都是往同一张修复图的 Sprite 上
// 挂材质，都填了的话只有排在前面那个生效（`repair()` 里的顺序就是下面这个顺序），后面全是配了不演的死配置
(function checkReveal(n) {
    const slot = n.getComponent('PieceSlot');
    if (slot) {
        const set = [
            ['金色烟花', slot.fireworkReveal],
            ['贴纸贴平', slot.stickerApply],
            ['画笔涂色', slot.brushReveal],
            ['圆形扩散', slot.circleReveal],
        ].filter((f) => f[1]);
        if (set.length > 1) {
            out.missing.push('PieceSlot@' + n.name + ' ' + set.map((f) => f[0]).join(' + ') + ' 都填了，只有「' + set[0][0] + '」会演');
        }
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
// 音频配置：没拖音效的条目静默不响（顺序列表算有音效）；激活 / 结束事件撞一起就是刚响就停；
// 「按下按钮」那条听的是 `buttons` 里那些节点的 TOUCH_START，列表空着就是配了不响
(function checkAudio(n) {
    const a = n.getComponent('AudioManager');
    if (a) {
        a.cues.forEach((c, i) => {
            if (!c.clip && !c.sequence.length) out.missing.push('AudioManager@' + n.name + ' 第' + (i + 1) + '条既没拖音效也没配顺序列表');
            else if (c.event !== 'NONE' && c.event === c.stopEvent) {
                out.missing.push('AudioManager@' + n.name + ' 第' + (i + 1) + '条激活 / 结束事件是同一个，放了就停');
            }
        });
        if (a.cues.some((c) => c.event === 'BUTTON_DOWN') && !a.buttons.length) {
            out.missing.push('AudioManager@' + n.name + ' 配了「按下按钮」的音效，但「按压音效按钮」一个都没拖');
        }
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
// 收尾动作（通马桶 / 扫地，§14）：淡出全靠 UIOpacity，缺一个就是取到 null 直接抛（淡出那步炸了，
// 这一格的 PIECE_SHOWN 就永远不抛 —— 最后一格修好时完成背景和结束界面都不出来）。
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
    // 喷瓶不收修复图（它是硬隐藏），所以不并进下面那条「有收尾动作就得挂 UIOpacity」
    const acted = flush || sweep;
    if (acted && slot.repairedView && !slot.repairedView.node.getComponent(cc.UIOpacity)) {
        out.missing.push('@' + n.name + ' 有收尾动作但修复图没挂 UIOpacity，收尾那一步的淡出起不来');
    }
    for (const c of n.children) checkSpot(c);
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
// 结尾视频（§18）：节点必须**睡着**（引擎只在 onDisable 里把 `<video>` 设成 hidden，节点醒着那块区域的触摸
// 就永远到不了画布）、不能挂 Widget（引擎在 META_LOADED 那一下会把节点尺寸改成片源原始像素，Widget 会跟它抢）、
// 片源与播放区域都得配 —— 缺任一 `play()` 就直接放弃视频，表现是「配了却不演」。
(function checkEndVideo() {
    const cta = canvas.getChildByPath('UILayer/CtaLayer');
    const ctrl = cta && cta.getComponent('CtaController');
    if (!ctrl || !ctrl.endVideo) return; // 没配 = 「不演视频」，是合法退路，不算错
    const v = ctrl.endVideo;
    const node = v.node;
    if (node.active) out.missing.push('结尾视频 节点没睡着（active = true），那块区域的触摸到不了画布');
    if (node.getComponent(cc.Widget)) out.missing.push('结尾视频 挂了 Widget，会和引擎改节点尺寸那一句抢');
    if (!v.player) out.missing.push('EndVideo@' + node.name + ' 没配播放器，视频不会演');
    else if (!v.player.clip) out.missing.push('EndVideo@' + node.name + ' 的 VideoPlayer 没拖片源，视频不会演');
    if (!v.region) out.missing.push('EndVideo@' + node.name + ' 没配播放区域，铺不满');
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
            out.missing.push(pair[0] + ' 贴着画布边，长屏上内容会偏下或被拉宽（见 AGENTS.md §7.1）');
        }
    });
    // 拼图框的尺寸不是手配的，是 `PuzzleAreaFit` 按底图比例现算的（§7.1）。掉了就是
    // 「底图换了、框没换」—— Scene_BG 被横向压扁，而 RECT Mask / 完成背景还停在旧框上。
    const frame = [
        ['GameLayer', canvas.getChildByName('GameLayer')],
        ['GameLayer/Scene_BG', canvas.getChildByPath('GameLayer/Scene_BG')],
        ['GameLayer/Scene_BG/完成背景', canvas.getChildByPath('GameLayer/Scene_BG/完成背景')],
    ];
    if (!frame[0][1].getComponent('PuzzleAreaFit')) {
        out.missing.push('GameLayer 没挂 PuzzleAreaFit，换一张比例的底图拼图框不会跟着走（见 AGENTS.md §7.1）');
    }
    const sizeOf = (n) => { const u = n && n.getComponent(cc.UITransform); return u ? u.width + '×' + u.height : '<缺>'; };
    const sizes = frame.map((p) => sizeOf(p[1]));
    if (sizes[0] !== sizes[1] || sizes[1] !== sizes[2]) {
        out.missing.push('拼图框三处尺寸不一致（' + frame.map((p, i) => p[0] + '=' + sizes[i]).join(' / ') + '），RECT Mask 和画笔涂色都盖不满');
    }
})();
// 仙尘（§16）：粒子节点从左下角拖到笔头上全靠 `SceneBgSwap` 每帧 `setPosition`，
// 但「发射器跟着谁走」这件事是由 `positionType` 定的 —— 配成 RELATIVE / GROUPED 的话
// 已经撒出去的那一片会整块跟着笔头平移，拖尾就散了。另外「加载时播放」得关掉：
// 开着的话开演之前它就在拼图区中间一直冒。
(function checkDust() {
    const swap = canvas.getChildByPath('GameLayer/Scene_BG').getComponent('SceneBgSwap');
    if (!swap || !swap.dust) return;
    if (swap.dust.positionType !== cc.ParticleSystem2D.PositionType.FREE) {
        out.missing.push('SceneBgSwap 的仙尘不是 FREE 位置类型，撒出去的那片会跟着笔头整块挪，出不了拖尾');
    }
    if (swap.dust.playOnLoad) {
        out.missing.push('SceneBgSwap 的仙尘开着「加载时播放」，开演之前它就一直在冒');
    }
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

    // 六格都改走别的揭晓（画笔涂色之类）之后这份抄写值就没人读了，别再劝人重跑 sticker 的接线脚本 ——
    // 跑了它会反过来把槽位从别的揭晓手里抢回来
    let used = false;
    (function look(n) {
        const s = n.getComponent('PieceSlot');
        if (s && s.stickerApply) used = true;
        for (const c of n.children) look(c);
    })(canvas);
    if (!used) return;

    const factory = canvas.getChildByPath('PiecePoolLayer/ScrollView').getComponent('PieceFactory');
    const apply = canvas.getChildByName('EffectLayer').getComponent('StickerApply');
    if (!factory || !factory.peelParams || !apply || !apply.frontEffect) return;
    const p = factory.peelParams;
    const drift =
        num(p.corner.x, apply.corner.x) || num(p.corner.y, apply.corner.y) ||
        num(p.liftRatio, apply.openRatio) || num(p.stickTime, apply.applyTime) ||
        p.backColor.r !== apply.backColor.r || p.backColor.g !== apply.backColor.g || p.backColor.b !== apply.backColor.b ||
        num(p.creaseWidth, apply.creaseWidth) || num(p.creaseGlow, apply.creaseGlow);
    if (drift) out.missing.push('StickerApply 的抄写值和全局揭角参数不一致，重跑一次 mount-sticker-apply.js');
})();
// 收尾那一段（§16）：总修复的扫光和完成背景那支画笔**都**挂在「最后一格露面」这一拍上，
// 让它们前后排开靠的是两个各自独立的延时（`RepairSweep.completeDelay` / `SceneBgSwap.delay`），
// 谁也没法给谁传话（事件与发射方一律不动）。对不上就是两道一起演、或者白等一段。数在
// `tools/js/set-finale.js` 里成对写，改那儿就够；这里只管它俩戳没戳齐。
(function checkFinale() {
    const flags = canvas.getComponent('FeatureFlags');
    const sweep = canvas.getChildByName('EffectLayer').getComponent('RepairSweep');
    const swap = canvas.getChildByPath('GameLayer/Scene_BG').getComponent('SceneBgSwap');
    if (!flags || !sweep || !swap) return;
    const sweepEnd = sweep.completeDelay + sweep.completeTime;
    if (flags.sweepOnComplete && swap.delay < sweepEnd - 0.05) {
        out.missing.push('SceneBgSwap 的开演等待（' + swap.delay + 's）短于总修复扫光演完的时刻（' + sweepEnd + 's），两道会叠在一起');
    }
    if (!flags.sweepOnComplete && swap.delay > 0) {
        out.missing.push('总修复扫光关着，但 SceneBgSwap 的开演等待还是 ' + swap.delay + 's，最后一格露面后会白等这一段');
    }
    // 「直接亮出来」靠的是把 revealView 的贴图挪到 Scene_BG 上 —— 没配它最后根本不会出现完成图
    if (swap.instant && !swap.revealView) {
        out.missing.push('SceneBgSwap 选了「直接亮出来」但没配完成背景（revealView），最后不会出现完成图');
    }
})();
return out;
