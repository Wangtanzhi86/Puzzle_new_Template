import { ResolutionPolicy } from 'cc';
import { applyResolution, designSize, frameSize } from '../core/UISpace';

/** 引擎启动时按项目设置应用的是 SHOW_ALL（fitHeight + fitWidth 都开），这里记住当前生效的那条。 */
let current = ResolutionPolicy.SHOW_ALL;

/**
 * 把画布撑满屏幕。
 *
 * SHOW_ALL 会把画布钉死在设计尺寸 720×1280，屏幕比它多出来的那部分没有任何节点去画 ——
 * 竖屏就是上下两条黑边、横屏就是左右两条。改成「补长边」：屏幕比设计稿瘦（手机竖屏）补高度、
 * 比设计稿胖（平板竖屏 / 横屏）补宽度，两种情况下设计稿都完整可见（和 SHOW_ALL 一样不裁内容），
 * 多出来的那条边是真实画布，四边拉满的层（BackgroundLayer / UILayer / DragRoot / EffectLayer）自己就铺过去了。
 *
 * 横屏的比例恒大于设计稿的 720/1280，所以横屏补出来的是宽度，画布是 1770×1280 这种宽幅。
 * 玩法内容三处都不贴边，于是整块竖版构图居中停在屏幕中间，两侧由背景铺满（见 AGENTS.md §7.1）。
 *
 * `view.*` 一律走 `core/UISpace` —— 坐标系只有那一个出口（见该文件头注释）。
 *
 * @returns 策略是否变了。变了说明画布尺寸会动（世界坐标跟着动），调用方该收掉手里那块碎片之类。
 */
export function applyScreenPolicy (): boolean {
    const frame = frameSize();
    const design = designSize();

    const policy = frame.width / frame.height >= design.width / design.height
        ? ResolutionPolicy.FIXED_HEIGHT
        : ResolutionPolicy.FIXED_WIDTH;

    if (policy === current) return false;
    current = policy;
    applyResolution(design, policy);
    return true;
}
