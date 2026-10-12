import { _decorator, Component, director } from 'cc';

const { ccclass, property } = _decorator;

/** 面板不在场时读这里（编辑器编辑模式、面板被误删）：全开，避免少一个开关就玩法残缺 */
const DEFAULTS = {
    pieceGlow: true,
    stickerPeel: true,
    trail: true,
    revealOnRepair: true,
    stickerApply: true,
    circleReveal: true,
    sweepOnRepair: true,
    sweepOnComplete: true,
    guide: true,
    progress: true,
    audio: true,
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
    static get sweepOnRepair(): boolean { return (FeatureFlags.panel ?? DEFAULTS).sweepOnRepair; }
    static get sweepOnComplete(): boolean { return (FeatureFlags.panel ?? DEFAULTS).sweepOnComplete; }
    static get guide(): boolean { return (FeatureFlags.panel ?? DEFAULTS).guide; }
    static get progress(): boolean { return (FeatureFlags.panel ?? DEFAULTS).progress; }
    static get audio(): boolean { return (FeatureFlags.panel ?? DEFAULTS).audio; }
}
