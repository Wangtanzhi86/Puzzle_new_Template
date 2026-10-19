import { _decorator, Component, director } from 'cc';

const { ccclass, property } = _decorator;

/** 面板不在场时读这里（编辑器编辑模式、面板被误删）：全开，避免少一个开关就玩法残缺。
 *  两个例外：`autoPlay` —— 它改的是玩法本身（玩家放几块之后系统接管），不是「多演一下少演一下」，
 *  面板丢了就该退回「玩家自己修完」的老行为，不是替他打完；`snapReveal` —— 它是「换掉目标工程自己那套
 *  修复揭晓，改用 CopyPuzzle 的吸附瞬间时序」，默认关着才是这套工程原本的样子。 */
const DEFAULTS = {
    pieceGlow: true,
    stickerPeel: true,
    trail: true,
    revealOnRepair: true,
    stickerApply: true,
    circleReveal: true,
    brushReveal: true,
    sweepOnRepair: true,
    sweepOnComplete: true,
    guide: true,
    progress: true,
    audio: true,
    autoPlay: false,
    snapReveal: false,
};

/**
 * 功能开关表：一个开关关掉一整项可选表现。组件挂在 Canvas 上，值在 Inspector 里勾。
 *
 * 读侧是静态 getter（`FeatureFlags.audio`），每次现扫场景找面板 —— 这是为了不依赖组件顺序：
 * 同节点的组件 `onLoad` / `onEnable` 按数组顺序走，而 `AudioManager` 就在 Canvas 上、在
 * `onEnable` 里读开关，面板要是排它后面，开播时读到的就是默认值，勾的「关」白勾。
 * 全程只读十几次，不值得缓存（缓存就得管生命周期）。
 *
 * 改完**存场景 + 重开预览**：面板是场景数据，跑着的那个预览不会热更新。
 *
 * 两件反直觉的事：
 * 1. 关开关省不下字节。web-mobile 产物是 SystemJS 模块、mangleProperties = false，跨模块没有
 *    死代码消除；被关掉的代码、以及它引用的 .effect 资源照旧进包。省下的只有运行期开销。
 * 2. AppLovin 合规项不在这里，也别往里加：转屏重排、MRAID 生命周期、CTA。关掉这些就是不合规。
 */
@ccclass('FeatureFlags')
export class FeatureFlags extends Component {
    @property({ displayName: '拖动亮边', tooltip: '拿起来的碎片边上一圈白光' })
    pieceGlow = DEFAULTS.pieceGlow;

    @property({ displayName: '揭角', tooltip: '碎片被拿起时一角折起来露出背面，弹回池子时贴回去' })
    stickerPeel = DEFAULTS.stickerPeel;

    @property({ displayName: '拖动拖尾', tooltip: '拖动时洒下的白色光点' })
    trail = DEFAULTS.trail;

    @property({ displayName: '单块修复揭晓', tooltip: '修好时先播一段序列帧，再把修复图放大出来' })
    revealOnRepair = DEFAULTS.revealOnRepair;

    @property({ displayName: '修复贴纸贴平', tooltip: '修好时那一格的修复图整张出现、一角翘着，再按平贴到缺口上（和碎片揭角是同一对材质，反着演）。只有填了「贴纸贴平揭晓」的槽位走它' })
    stickerApply = DEFAULTS.stickerApply;

    @property({ displayName: '修复圆形扩散', tooltip: '修好时修复图从缺口中心羽化扩出来盖住破损图（和结束背景同一套材质）。只有填了「圆形扩散揭晓」的槽位走它，关掉就整条回退到序列帧那套' })
    circleReveal = DEFAULTS.circleReveal;

    @property({ displayName: '修复画笔涂色', tooltip: '修好时一支圆头画笔从左上角斜着来回刷到右下角，刷过的地方才显示修复图。只有填了「画笔涂色揭晓」的槽位走它' })
    brushReveal = DEFAULTS.brushReveal;

    @property({ displayName: '单块修复扫光' })
    sweepOnRepair = DEFAULTS.sweepOnRepair;

    @property({ displayName: '总修复扫光' })
    sweepOnComplete = DEFAULTS.sweepOnComplete;

    @property({ displayName: '文字 / 手指引导' })
    guide = DEFAULTS.guide;

    @property({ displayName: '进度显示' })
    progress = DEFAULTS.progress;

    @property({ displayName: '音效' })
    audio = DEFAULTS.audio;

    @property({ displayName: '吸附瞬间时序（CopyPuzzle）', tooltip: '开：修好那一刻改演 CopyPuzzle 那套 —— 修复图弹一下（0.6 秒内 0.96 → 1.1 → 1）、淡出到 0 再从圆心重新扩出来，扩散带边缘提亮和水平波纹。只有填了「吸附瞬间揭晓」的槽位走它，且整格接管（胶带 / 换节点 / 圆扩散 / 序列帧都不再发生）。关：整条回退到原来的揭晓' })
    snapReveal = DEFAULTS.snapReveal;

    @property({ displayName: '自动打关', tooltip: '玩家自己修够几块之后系统接管，剩下的碎片一块接一块自动飞过去吸附。门槛与节奏在 GameLayer 的「自动打关」组件上' })
    autoPlay = DEFAULTS.autoPlay;

    private static get panel(): FeatureFlags {
        return director.getScene().getComponentInChildren(FeatureFlags);
    }

    /** 静态 getter 和同名实例字段是两个命名空间，互不干扰 —— 消费方照旧写 `FeatureFlags.audio` */
    static get pieceGlow(): boolean { return (FeatureFlags.panel ?? DEFAULTS).pieceGlow; }
    static get stickerPeel(): boolean { return (FeatureFlags.panel ?? DEFAULTS).stickerPeel; }
    static get trail(): boolean { return (FeatureFlags.panel ?? DEFAULTS).trail; }
    static get revealOnRepair(): boolean { return (FeatureFlags.panel ?? DEFAULTS).revealOnRepair; }
    static get stickerApply(): boolean { return (FeatureFlags.panel ?? DEFAULTS).stickerApply; }
    static get circleReveal(): boolean { return (FeatureFlags.panel ?? DEFAULTS).circleReveal; }
    static get brushReveal(): boolean { return (FeatureFlags.panel ?? DEFAULTS).brushReveal; }
    static get sweepOnRepair(): boolean { return (FeatureFlags.panel ?? DEFAULTS).sweepOnRepair; }
    static get sweepOnComplete(): boolean { return (FeatureFlags.panel ?? DEFAULTS).sweepOnComplete; }
    static get guide(): boolean { return (FeatureFlags.panel ?? DEFAULTS).guide; }
    static get progress(): boolean { return (FeatureFlags.panel ?? DEFAULTS).progress; }
    static get audio(): boolean { return (FeatureFlags.panel ?? DEFAULTS).audio; }
    static get autoPlay(): boolean { return (FeatureFlags.panel ?? DEFAULTS).autoPlay; }
    static get snapReveal(): boolean { return (FeatureFlags.panel ?? DEFAULTS).snapReveal; }
}
