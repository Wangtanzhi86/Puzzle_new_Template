import { Rect, ResolutionPolicy, Size, Vec3, view } from 'cc';

/**
 * 坐标系与适配层的**单一出口**：全工程只有这个文件碰 `view.*`。
 *
 * 前提（引擎源码级结论）：`Touch.getUILocation()` = 窗口像素减 viewport 再除 view scale
 * （`cocos/ui/view.ts:586-590`），单位是**设计单位**、原点在**可视区左下角**；
 * `visibleRect` 恒等于可视区（`view.ts:436-484`）；Canvas 被自带 Widget 撑满可视区
 * （`cocos/ui/widget-manager.ts:79-85,141-147`）→ Canvas 世界坐标就是可视区中心、scale = 1。
 * 所以：
 *
 *   **世界系 == UI 系数值**，`uiToWorld(x, y)` 就是原样搬过去（z = 0）。
 *
 * 转屏 / 撑满只改画布尺寸（720×1280 ↔ ~1770×1280），世界原点不动、上面这条不变。
 * 以后若要给 Canvas 加缩放或偏移，**只改这一个文件**，调用点不用知道。
 */

/** 窗口真实像素尺寸 —— 只用来判方向（撑满后 `visibleSize` 会跟着策略走，方形窗口会被它判错） */
export function frameSize(): Size {
    return view.getFrameSize();
}

/** 可视区尺寸（设计单位）。撑满 / 转屏之后这就是画布尺寸，布局要现读、别在 `build()` 时存快照 */
export function visibleSize(): Size {
    return view.getVisibleSize();
}

/** 设计分辨率（项目设置里那 720×1280），不含策略带来的补边 */
export function designSize(): Size {
    return view.getDesignResolutionSize();
}

/** 可视区在世界系里的矩形：世界原点在中心，所以左下角是 (-w/2, -h/2) */
export function visibleRect(): Rect {
    const s = view.getVisibleSize();
    return new Rect(-s.width * 0.5, -s.height * 0.5, s.width, s.height);
}

/** UI 坐标 → 世界坐标。z 一律 0（2D 层）。传 `out` 复用同一个 Vec3，别每帧 new */
export function uiToWorld(x: number, y: number, out?: Vec3): Vec3 {
    const p = out ?? new Vec3();
    p.set(x, y, 0);
    return p;
}

/** 换分辨率策略 —— 只给 `ScreenAdapter` 用：工程里只有它在 SHOW_ALL / FIXED_HEIGHT / FIXED_WIDTH 之间切 */
export function applyResolution(design: Size, policy: number): void {
    view.setDesignResolutionSize(design.width, design.height, policy);
}
