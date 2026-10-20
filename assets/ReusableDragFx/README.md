# 通用拖动轮廓光与柔光圆点样板

当前只接入 Gamescene 的 Item_Bag。参考 7043/337f64f28c40073e13460cf08c6af590.html：拖动时使用圆光点，成功时的尖角星光由原匹配结果模块独立处理。

## 编辑器挂载
完整模块位于「交互界面组 / RainNightDragLayer / 包拖动特效_样板」。
- 容器挂唯一 DragGlowVisual，始终保持启用。它只负责视觉表现，不包含匹配、计分、音频或结算。
- 「拖动轮廓柔光_样板」预建 Sprite / UITransform / UIOpacity，Sprite 显式绑定与道具相同的 SpriteFrame 及 drag-alpha-glow.mtl。
- 「包拖动白色光点_样板」预建 ParticleSystem2D / UITransform。粒子 SpriteFrame 显式绑定 soft-white-dot.png，Custom Material 显式绑定 soft-dot-additive.mtl。
- 原 Graphics 与四角星逻辑已移除。组件七项引用均为具体类型且必需；不使用空引用关闭效果。

## 圆光点
soft-white-dot.png 是 64×64 的白色圆点，明亮小核心叠加连续的柔边光晕，外边缘透明。材质采用 SrcAlpha / One 加法叠加；dotTint.a 专门控制松手时整组快速淡出，不依赖粒子节点 UIOpacity。

ParticleSystem2D 使用 Custom、Free 世界空间，关闭 Preview、Play On Load、Auto Remove On Finish。发射范围覆盖道具显示矩形及近旁，各粒子出生在随机位置，具有大小、透明度、寿命和轻漂速度的随机变化。按住或移动期间都持续生成；已经出生的粒子留在经过的位置，不随道具回拉。不再沿外围排成一圈，也不绘制尖角星。

按用户提供的桌子截图调整为每秒 30 点，贴图直径 5.5±4 屏幕像素（范围 1.5～9.5，实际亮核小于贴图），以细小光点为主、少量较大亮点。寿命 0.75±0.225 秒，轻漂速度 2±1.2 像素/秒，总数上限 48。发射区域恢复为道具显示边界，不再额外按比例放大，四周仅外扩 3 屏幕像素，并减慢漂移，使光点主要留在物体及紧邻四周。参数集中在 DragGlowVisual 上。固定使用 Free 模式，脚本根据 Cocos 3.8 的世界单位换算大小与发射范围。

拿起时轮廓光用 0.08 秒显现，粒子立即开始发射。松手停止新粒子，并在 0.12 秒内用材质透明度收掉残留；后台、强制中断、隐藏、停用和销毁清理。ParticleSystem2D 独立停用仅抑制粒子，恢复后若仍在拖动则重新开始；保留绑定仍必需。

## 换图与迁移
复制本目录及完整视觉容器到目标项目。在编辑器重新绑定 sourceSprite、sourceTransform，以及容器内 particles、particleTransform、glowSprite、glowTransform、glowOpacity 七个引用；同时保留粒子上的贴图和材质绑定。

源 Sprite 和轮廓光 Sprite 绑定同一 SpriteFrame，均使用 Simple + Trim；源 SpriteFrame 关闭 Packable，禁止旋转打包。轮廓 Shader 从源图 alpha 生成发光，不需要为每张图重做轮廓图。圆点贴图可在不同道具间共用，所有资源通过编辑器引用，不在运行时加载。

目标项目的拖动控制器通过已绑定道具节点发送 DragVisualEvents.ts 中的公开事件：
- BEGIN：拿起后发送。
- END：松手时发送，包含成功、回位、取消。
- CLEAR：强制中断、停用、销毁或后台时发送。

## 检查边界
仅完成脚本、材质、挂载、资源与必要绑定等基本检查。未执行游戏预览、自动交互、完整回归或构建。圆光点的相似度、密度、手机帧率及横竖屏效果待用户手动验收。


## 独立迁移包
新增 DragGlowSample.prefab，内含示例输入、示例图片和完整视觉模块，无原场景外部节点引用。导入、换图与已有拖动控制器接入方法见 MIGRATION.md。示例不接入当前 Gamescene。
