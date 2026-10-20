# 结束界面：循环滚屏

## 改了什么

- 新增 `assets/scripts/ui/EndCarousel.ts`：卡片排成一条无限横向环（环长 = 卡片数 × 间距），
  每帧按 `i * spacing + scroll` 取模映射到 [−环/2, 环/2)；越靠中间缩放越大（`centerScale` 1 → `sideScale` 0.55），
  `|x|` 超过 `visibleRange`（460）就隐藏；层级按 |x| 从远到近逐帧重排 `siblingIndex`（中间的永远最上）。
  开场 `flipSpeed`（1700 px/s）在 `flipTime`（1.4s）内二次方缓出到 `speed`（90 px/s），即「快速翻阅」后落常速循环。
- 新增 `tools/js/mount-end-carousel.js`：重建 `Canvas/UILayer/CtaLayer/CtaRoot/End/Carousel`（720×660，y = −40，插在 bg 与「文字标题」之间），
  10 张 `Card_01..10`（300×370，与集图 964×1188 同比例），每张：
  `Glow_3/2/1`（圆角白 Sprite，分别放大 1.16 / 1.09 / 1.04，透明度 24 / 56 / 120，冷白偏青）+ `Clip/Image`（集图）
  + `Stroke_3/2/1`（Graphics 圆角矩形描边，线宽 16 / 8 / 3，透明度 34 / 90 / 220）—— 由外到内叠出霓虹光边。
- 没用 Mask：图片是矩形，用 Graphics 描边 + 底层光晕已足够；也避免 3.8.8 里 `Mask` 与自建 `Graphics` 抢组件的坑。
- 未新增任何美术资源：光晕与边框都复用 `Fail/btn/Img` 的「圆角白」+ Graphics。

## 为什么这么改

- 用「无限环 + 模运算」而不是「到边界后挪回队尾」：卡片在 |x| = 环/2 = 1000 处才换边，
  远在屏幕（±360）之外，看不到跳变。
- 逐帧重排 `siblingIndex` 而不是给每张卡加 `zOrder` 脚本：10 张卡开销可忽略，逻辑也简单。
- 想过用真正的 3D 透视（`Camera` 倾斜 + 卡片绕 Y 旋转），需要 3D 相机投到 2D UI 上，改动大且体积/性能都不划算，否掉。

## 怎么验的

- 只做了场景结构回读：Carousel 存在、10 张 Card、Card_01 有 Glow_3/2/1 + Clip/Image + Stroke_3/2/1，图是「第1集」，节点已存盘。

## 影响什么 / 还没验的部分

- 只动了 `End` 一个节点（多出 `Carousel` 子节点），bg / 文字标题 / btn 未动。
- 未跑预览：开场减速手感、卡片间距与缩放曲线、光晕强度都还要目视调；
  参数全在组件的 `EndCarousel` Inspector 上（间距 / 两档缩放 / 可视半宽 / 两种速度 / 减速时长）。
- 10 张集图里 Level 4/5 无素材，按位置取了 1、2、3、6、7、8、9、10、11、12。
## 补丁（同日）：对齐参考视频 —— 白框 / 中间高亮 / 按钮与标题粒子

参考：`D:\Rescourse\puzzle_1016\拆分\视频.mp4`（720×1280，10s，30fps）。用 imageio-ffmpeg 抽帧（4×4 拼图，fps=2）核对：
每张卡是**白色圆角粗框**，正中那张额外一圈亮白光晕、并且最大；顶部标题与 PLAY NOW 按钮上都有细碎光点。

- 卡片描边由冷青霓虹改成**白色**三层（线宽 16 / 8 / 3，alpha 36 / 150 / 255），默认就是白框。
- 中间高亮：卡片里的 `Glow_1/2/3`（圆角白 Sprite，放大 1.04 / 1.09 / 1.16）透明度不再写死，改由
  `EndCarousel.applyGlow()` 每帧按焦点算：`focus = max(0, 1 − |x| / (spacing × 1.1))`，
  `Glow_1 = 90 + 130f`、`Glow_2 = 40 + 120f`、`Glow_3 = 16 + 90f` —— 正中那张最亮（220 / 160 / 106），
  两侧按距离衰减，配合已有的「正中最大 + 层级最高」。
- 新增 `assets/scripts/ui/Sparkles.ts`：轻量光点粒子（自己建 Sprite 节点、正弦淡入淡出、向上飘、左右微漂）。
  没用 `ParticleSystem2D`：场景里现成的「魔法仙尘」`spriteFrame` 是空的（贴图走材质），参数搬不过来；
  自绘这套参数少、不依赖粒子模块配置，也方便逐项调。
- 场景 `End` 下新增 `TitleSparkles`（700×300，14 颗，盖住标题）与 `BtnSparkles`（720×220，16 颗，盖住按钮），
  光点贴图用「圆角白」，颜色默认暖白 `(255,246,214)`。粒子节点不注册任何触摸监听，不吃按钮点击。

## 还没验的部分

- 未跑预览：白框线宽、中心光晕强度、粒子数量/速度都要目视调；
  `Sparkles` 的参数（数量 / 范围 / 寿命 / 尺寸 / 上升速度 / 漂移 / 颜色）都在 Inspector 上。
## 补丁：按参考图重排 + 真圆角裁剪 + 离散步进（第二轮）

参考图（用户提供）：标题在上、中间一排白圆角卡、下面 Google Play / App Store 两个商店按钮、最下一颗大 PLAY NOW。

### 排版
- `End/Carousel` 720×600 @ (0, 70)，卡片 280×352、间距 212、两侧缩到 0.62、可见半径 400。
- 新增 `End/Stores`（560×80 @ y=−286），Google / Apple 两枚按钮 262×74（`assets/recourses/UI及背景/Google.png`、`apple.png`，原图 573×163），x=∓140。
- `btn`（PLAY NOW）下移到 (0, −502)；`TitleSparkles` / `BtnSparkles` 跟着标题与按钮的新位置。
- `End/bg` 是「纯白」占位的，染成深棕 (38,29,26) —— 参考图是深底，白框才有对比。换正式底图时把颜色调回白即可。

### 圆角（卡片图片真的被裁圆角）
- 新增 `assets/scripts/ui/RoundedClip.ts`（`@executeInEditMode`）：给节点补 `Graphics` + `Mask(GRAPHICS_STENCIL)`，
  按 UITransform 尺寸画圆角矩形并 `fill()`，子节点（卡片图）就按圆角裁掉方角。`radius = 30`、`inset = 1`。
- 查过 3.8.8 引擎源码：`Mask._updateGraphics()` 只对 RECT / ELLIPSE 清空重画，`GRAPHICS_STENCIL` 直接 return，
  所以自己的路径不会被 Mask 抹掉；`_createGraphics()` 只在 Mask 自建 Graphics 时把 fillColor 的 alpha 置 0，
  先挂好 Graphics 就不会踩到。
- 卡片结构：`Glow_3/2/1`（圆角白光晕）→ `Clip`（Mask 裁剪）> `Image` → `Stroke_3/2/1`（白描边 24/12/5，alpha 46/190/255）。
  描边画在裁剪框内侧，四角不会露出方角。

### 离散步进（不再连续轮转）
- `EndCarousel` 重写：`interval` 1.7s 一次，`moveTime` 0.55s 缓出把下一张从右侧送进正中，其余各退一格；
  到位后 `pulseTime` 0.55s 走一个正弦脉冲 —— 正中那张放大 `pulseScale`(0.1)、`Glow_1/2/3` 透明度按 `pulseGlow` 再抬一档，然后落回。
- 层级按「离正中越近越靠上」每帧重排（`setSiblingIndex`），新到的那张在最上面。
- 卡片按环形取位（`((i − pos) % n + n) % n` 再折到 ±n/2），10 张永远循环，超出 `visibleRange` 的直接 `active=false`。

### 还没验的部分
- 未跑预览：圆角半径 / 描边粗细、卡片大小与间距、两个商店按钮的尺寸位置、深底色的观感都要目视调。
- `RoundedClip` 用的是 Mask + 自绘 Graphics 的 stencil，编辑器里预览确认裁剪生效（若某张卡出现方角，先看 Clip 上的 Mask 是否被别的组件顶掉）。
## 补丁：光晕不再用拉伸的圆角图，改 Graphics 圆角描边

问题：`Glow_1/2/3` 原来是「圆角白」48×48 的 Sprite 放大到 280×352 —— 圆角被非等比拉伸成椭圆，
四角出现一圈斜着的暗边，看着像脏污（用户截图里的那种「怪」）。

改法：`Glow_1/2/3` 换成 Graphics 圆角描边（white，lineWidth 12 / 26 / 48，半径 30，画在卡片边缘），
透明度由 UIOpacity 控制；`Clip` 的图盖在它们上面，所以只露出「框外那一半」，形成由亮到暗的三层光晕。
`Stroke_1` 保留一条 8px 纯白边压在图上面。

否掉的方案：①给 48×48 图设 SLICED + border —— 九宫格只能保持角不变形，但做不出外扩的光晕；
②烘一张柔边 PNG —— 又要加美术资源，改尺寸就得重烘；③自定义材质做 blur —— 体积与性能都不划算。

`EndCarousel.applyGlow()` 的基准/跨度同步改成 26/40、70/80、150/70（脉冲再抬一档）。
## 修复：白框 / 光晕一进运行就没了

原因：边框是用 `Graphics.roundRect() + stroke()` 在编辑器里画上去的，但 **`cc.Graphics` 在场景文件里只存组件属性，不存路径指令**
（核对 `assets/scene.scene`：Graphics 那段只有 `_lineWidth` / `_strokeColor` 等，没有路径）。
所以场景一加载，所有描边都是空路径 —— 之前看到的「怪白框」其实是那张被拉伸的圆角白图，描边从来没渲染出来过。

改法：新增 `assets/scripts/ui/RoundedFrame.ts`（`@executeInEditMode`），节点上挂它 + `Graphics`，
`onLoad` / `onEnable` 里按 UITransform 尺寸现画一圈圆角白边。卡片的 `Glow_3/2/1`（线宽 48/26/12，UIOpacity 26/70/150）
与 `Stroke_1`（线宽 8，纯白）都改用它。

顺带：`EndCarousel.onEnable` 不再当场 `setActive`（父节点激活途中改层级，编辑器会报
`Cannot change hierarchy while activating or deactivating the parent`），首帧布局挪到第一次 `update`。
## 四件事：进场快滚 / 标题粒子向下 / 商店徽标可点 / 正中卡片撒粒子

- `EndCarousel` 加 `introTime`(1.1s) / `introSpeed`(14 张/秒)：`onEnable` 起先按速度连续滚动，到点取整落位，再进原来的步进节奏。
- `Sparkles` 加 `downward` 开关：勾上就从范围顶边往下落（`TitleSparkles` 已勾，范围 700×300 @ y=484，顶边贴标题上沿）。
- 新增 `ui/StoreButton.ts`：`Button.CLICK` → `bridge.openStoreUrl(ANDROID_STORE_URL | IOS_STORE_URL)`，并抛 `CTA_CLICK`。
  `MraidBridge` 拆出 `openStoreUrl(url)`（`openStore()` 退化成「按设备选 url 再调它」），平台注入的 `window.__ccCta` 仍然优先。
- 新增 `ui/CardBurst.ts`：从中心向外撒一圈光点、飞散变淡；`EndCarousel.burst` 在首次落位与每次步进到位时调 `burst()`。
  节点 `Carousel/CenterBurst`（280×352 @ 0,0），光点贴图沿用「圆角白」。

## 怎么验的

重跑 `tools/js/mount-end-carousel.js` 后存盘，`scene.scene` 里核对到：`EndCarousel.introTime=1.1 / introSpeed=14 / burst=CenterBurst`、
`TitleSparkles.Sparkles.downward=true`、`Stores/Google`(android=true) 与 `Stores/Apple`(android=false) 都带 `Button + StoreButton`。

## 影响 / 还没验

`winCount=0`（终局组件在 `CtaLayer` 上），所以结束界面路径上不会和 `EndgameCta` 的「点哪都跳」撞车；若以后把 `winCount` 调回 >0，
那时 End 界面根本不出现，也不冲突。
真机 CTA 各平台（Moloco / Google 的无参 `__ccCta`）未验。
## 补：进场衔接与按钮按压反馈

- 进场快滚由「匀速累加 + 到点取整」改成「从当前整数位缓动滑过 N 张（N = introSpeed × introTime）」，
  用 easeInOutCubic 落回整数位，并让下一步间隔缩到 `interval * 0.45`，消除落位那一下的跳变与空档。
- `StoreButton` 加 `pressScale`(0.9)：`TOUCH_START` 缩、`TOUCH_END/CANCEL` 弹回，0.07s / 0.14s。
## 补：粒子尺寸差异 / 五张可见 / 可拖动 / 自发光边框

- `Sparkles` / `CardBurst` 尺寸改用平方分布（`sizeMin + rand^2.2 * (max-min)`），Sparkles 3~34px、CardBurst 4~40px，大小差距拉开。
- 卡片带改一次露 5 张：`spacing` 212→132、`visibleRange` 400→340，新增 `shrink`(0.82) 让第 3 张起继续缩小。
- `EndCarousel` 加拖动：`TOUCH_START/MOVE/END` 直接改 `_pos`（位移 / spacing），松手按 `moveTime` 吸附到最近整数张，
  拖动期间暂停自动步进，吸附完照常脉冲 + 撒粒子。`draggable` 可关。
- 自发光：`RoundedFrame` 加 `glowRings/glowSpread/glowPower`，向外叠若干圈更宽更淡的描边；
  每圈用独立子节点 + 独立 `Graphics`（同一 Graphics 的路径会累积，换线宽会把前面几圈一起重画）。
  编辑器里只画实边（`EDITOR` 分支），运行期才建环。
- 卡片三层光晕改为：Glow_1 线宽 4 + 3 环 10px（op190）/ Glow_2 线宽 3 + 4 环 24px（op90）/ Glow_3 线宽 3 + 6 环 46px（op40）。
## 补：正中卡片改用现成粒子系统

`CardBurst` 不再自己撒 Sprite，改成复用 `assets/scripts/effects/Particle2D.ts`（工程里那份 2.x 粒子复刻）：
贴图 `assets/recourses/particles/spark.png`，加色材质 `assets/ReusableDragFx/soft-dot-additive.effect`，
`angle 90 / angleVar 180` 全向发散、`speed 260±150`、`life 0.55±0.25`、`startSize 26±20 → endSize 0`、
`totalParticles 80 / emissionRate 900`，`resetSystem()` 发 0.08 秒后 `stopSystem()`。
节点仍是 `Carousel/CenterBurst`，`CardBurst.fx` 指向它的 `Particle2D`；参数全可在 Inspector 调。