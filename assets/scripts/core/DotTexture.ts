import { ImageAsset, SpriteFrame, Texture2D } from 'cc';

/**
 * 白点贴图自己算出来就行，不用美术给图：按到圆心的距离填 alpha，存成 `ImageAsset`。
 * 拖尾的光点（`TrailEmitter`）与完成背景那层仙尘（`SceneBgSwap`）共用这一份 ——
 * 两边都只在「没配贴图」时拿它兜底，美术出了图直接拖到各自的 Sprite / 粒子节点上即可。
 */
export function makeDotFrame(px = 64): SpriteFrame {
    const data = new Uint8Array(px * px * 4);
    for (let y = 0; y < px; y++) {
        for (let x = 0; x < px; x++) {
            const dx = ((x + 0.5) / px) * 2 - 1;
            const dy = ((y + 0.5) / px) * 2 - 1;
            const falloff = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy));
            const i = (y * px + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = 255;
            data[i + 3] = falloff * falloff * 255;
        }
    }
    const tex = new Texture2D();
    tex.image = new ImageAsset({ _data: data, width: px, height: px, format: Texture2D.PixelFormat.RGBA8888, _compressed: false });

    const frame = new SpriteFrame();
    frame.texture = tex;
    frame.packable = false;
    return frame;
}
