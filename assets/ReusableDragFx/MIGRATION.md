# 拖动轮廓柔光与圆光点迁移包

适用：Cocos Creator 3.8.x 的 2D UI 道具。基础检查环境：3.8.6。
包内包括效果组件、Shader、材质、圆光点贴图、背包示例图片、完整预制体和示例拖动输入。
保留当前调好的参数：光点直径 5.5±4 屏幕像素，每秒30点，寿命0.75秒，发射范围为物品显示矩形四周外扩3像素。
这属于当前效果的迁移版本，尚未完成目标项目中的视觉验收。

## 1. 导入

1. 解压，将 assets/ReusableDragFx 文件夹及同级 ReusableDragFx.meta 一起复制到目标项目的 assets 下。
2. 必须保留所有 .meta，它们保存资源标识和引用。不要只复制脚本或重新生成标识。
3. 等待编辑器完成导入和脚本编译。若目标已存在本包或同 UUID 资源，先核对版本，不要直接覆盖或同时放入两份。
4. 把 DragGlowSample.prefab 拖入场景 Canvas 内，保持容器启用。预制体根节点放在希望显示示例物品的位置。
5. 手动运行并拖动背包，检查拿起、移动、松手及取消时的表现。示例松手后停留原地，不包含匹配、回位、音频、缩放或计分。
6. 不需要复制原游戏场景、RainNightDragItem 或其他游戏脚本。

## 2. 包内挂载

DragGlowSample（UITransform + DragGlowSampleInput，示例输入）
- SampleItem（UITransform + Sprite + UIOpacity，示例图片）
- DragGlowFx（UITransform + DragGlowVisual，视觉模块）
  - 拖动轮廓柔光_样板（UITransform + Sprite + UIOpacity）
  - 包拖动白色光点_样板（UITransform + ParticleSystem2D）

示例输入显式绑定 SampleItem 的 UITransform。
视觉组件的七项必需引用均已绑定：
sourceSprite / sourceTransform 指向 SampleItem；
glowSprite / glowTransform / glowOpacity 指向轮廓光节点；
particles / particleTransform 指向圆点节点。
视觉组件与输入组件各自负责独立功能。运行时没有依赖查找或资源动态加载。

## 3. 先换一张物品图

1. 将物品图片以 SpriteFrame 方式导入，在其 SpriteFrame 设置中关闭 Packable，禁止旋转打包。
2. 将 SampleItem.Sprite 和轮廓光节点.Sprite 的 SpriteFrame 同时绑定为同一个新 SpriteFrame。
3. 两个 Sprite 均使用 Simple 并启用 Trim。SampleItem 使用 Custom 尺寸，按实际显示需要调整 UITransform。
4. 保留轮廓光 Sprite 上的 drag-alpha-glow 材质；保留粒子上的 soft-white-dot SpriteFrame 和 soft-dot-additive 材质。
5. 在 DragGlowFx 的 DragGlowVisual 上调整粒子大小、数量、近旁扩展等参数。范围按物品显示矩形计算，留白多的图片应先裁掉多余透明边。

轮廓光通过新图片的 alpha 自动形成，不必为每个物品另画光晕。
建议视觉容器及父级使用普通 UI 平面变换，避免父级旋转、非均匀缩放或 Mask 裁剪影响效果。

## 4. 接到已有游戏物品

1. 从预制体实例根节点移除 DragGlowSampleInput，避免与原游戏拖动逻辑重复处理输入。
2. 将 DragGlowFx 整个模块放到现有的道具拖动显示层，保持它有父节点且始终启用。
3. 在 DragGlowVisual 上把 sourceSprite、sourceTransform 显式绑定到目标物品已有的 Sprite、UITransform。
4. 把轮廓光 Sprite 的 SpriteFrame 同时改为目标物品的同一 SpriteFrame，按上一节检查 Simple、Trim、Packable。
5. 确认新引用完整后移除示例 SampleItem 和空的示例根节点。粒子和轮廓光节点必须仍是 DragGlowFx 的直接子节点。
6. 在已有拖动控制器中，使用其已显式绑定的目标物品节点发送以下三个事件：

```ts
import { DragVisualEvents } from './DragVisualEvents'; // 按脚本实际相对位置调整

// 开始拿起：放在现有逻辑确认允许拖动之后。
boundItemNode.emit(DragVisualEvents.BEGIN);

// 松手、成功、失败回位、触摸取消：每次拖动结束时发送。
boundItemNode.emit(DragVisualEvents.END);

// 强制中断、切换流程、销毁/停用道具：立即清理。
boundItemNode.emit(DragVisualEvents.CLEAR);
```

boundItemNode 表示现有控制器明确绑定的道具节点，不是新增全局变量，也不应通过名称搜索。
视觉组件监听 sourceTransform.node 上的事件；控制器必须向同一个节点发送。
每个需要此效果的物品使用一套独立的 DragGlowFx，并完整绑定该物品。材质和圆点贴图可共用，组件运行时自行使用材质实例。
若原物品已有旧拖动光效，接入时移除或明确停用被替代的旧光效，避免重复叠加。

## 5. 清理与显示

BEGIN 持续发射；END 停止新粒子，0.12秒内收尾；CLEAR 立即清理。
后台、源物品隐藏、视觉组件停用和销毁也会清理。
需要隐藏效果时，不要连同负责调度的父层一起长期隐藏后仍期待它执行事件。
所有保留的引用都必须有效，不能以空引用关闭某个效果。

## 6. 检查与手动验收

已完成本包脚本类型检查、资源元数据、预制体结构及内部引用检查、材质 Shader 参数与资源依赖闭合检查，以及压缩文件完整性检查。
未执行目标项目接入、游戏预览、交互验证、构建或跨版本兼容测试。
运行效果待用户手动验收：
- 按住、拖动、松手、取消、快速重复拿起；
- 换图和调整尺寸后，轮廓贴合及光点大小、范围；
- 道具隐藏/停用和切后台后清理；
- 目标游戏实际横竖屏及不同画布缩放下的显示。

## 7. 交给 AI 接入时可使用的说明

请按目标项目 AGENTS.md，先核对 Cocos MCP 项目身份、当前场景及未保存状态，再导入本包并接入指定物品。
复用包内 DragGlowVisual 和公开事件，不把效果合并进总控制脚本。
完成七项必要引用、贴图/材质绑定，移除示例输入和被替代的旧效果，同步更新项目组件说明。
只做修改范围内基本检查；未明确授权时不运行游戏预览、不保存用户未保存场景。
