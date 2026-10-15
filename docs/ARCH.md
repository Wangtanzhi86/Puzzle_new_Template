# 脚本模块划分（§4 全文）

> 从 `AGENTS.md` 拆出来。**新增 / 改名脚本、找某个职责落在哪个文件** 时读这一份。
> 规范正文（单一职责、≤1000 行、只走 EventBus）留在 AGENTS.md §4 的指针处。


单一职责，**每个脚本 ≤ 1000 行**，模块间**只通过 EventBus 通信**，禁止跨模块直接持有引用。

```
assets/scripts/
├── core/
│   ├── EventBus.ts          事件总线（on / off / emit / offTarget / offAll）
│   ├── GameEvent.ts         事件枚举（唯一事件名来源）
│   ├── PoolManager.ts       通用对象池管理
│   └── DotTexture.ts        代码画的白点贴图（拖尾光点与完成背景的仙尘共用，两边都只在没配图时兜底）
├── config/
│   ├── PlayableConfig.ts    商店地址（打包器的占位符闸门扫这里）
│   └── FeatureFlags.ts      功能开关表：一个开关关掉一整项可选表现，见 §15
├── data/
│   └── LevelTypes.ts        配置数据类型定义（SlotData / LevelData / ZOrder / OverlayMode）
├── level/
│   ├── LevelFactory.ts      从关卡 Prefab 构建关卡，输出槽位数据
│   ├── PieceSlot.ts         单槽位组件：@property 暴露所有可拖图槽 + zOrder
│   ├── RepairedSlot.ts      修复后节点组件：可配显隐时机
│   ├── FlushAction.ts       收尾动作「通马桶」（当前无槽位配，见下）
│   ├── GroundWater.ts       地上脏水：修错时从上到下刷出来（当前无槽位配）
│   ├── BroomSweep.ts        收尾动作「扫地」（当前无槽位配）
│   ├── SprayAction.ts       收尾动作「喷瓶」（当前无槽位配）
│   └── SceneBgSwap.ts       全部修完：把完成图亮到拼图区底图上（现在是「直接亮出来」，画笔那套还在）+ 抛 END_SHOW
├── gameplay/
│   ├── PieceFactory.ts      碎片视图工厂（创建 / 回收 / 复位）
│   ├── PiecePool.ts         碎片池（Layout 内横向排列，对象池复用，分批上场）
│   ├── DragController.ts    拖拽输入（触摸事件 → 位置更新）
│   ├── AutoPlayer.ts        自动打关：玩家修够门槛后系统接管，剩下的碎片一批一批（默认 2 屏）飞过去吸附
│   ├── SnapSystem.ts        吸附判定（距离 < snapRadius → 吸附）
│   ├── RepairSystem.ts      修复流程：单块修复 + 进度 + 总修复
│   ├── PieceGlow.ts         拖动亮边
│   ├── TrailEmitter.ts      拖动拖尾
│   ├── RepairSweep.ts       修复扫光（单块 / 总修复）
│   ├── RepairReveal.ts      修复揭晓：序列帧 + 从小到大放大
│   ├── CircleReveal.ts      圆形扩散揭晓（bg-reveal 材质）
│   ├── BrushReveal.ts       画笔涂色揭晓（brush-reveal 材质）：圆头笔从左上角斜着来回刷到右下角，刷过的地方才显示修复图
│   ├── StickerPeel.ts       贴纸揭角：拿起碎片时一角折起来露出背面。导出 `peelLine()` 与 StickerApply 共用
│   ├── StickerApply.ts      贴纸贴平：修好时修复图整张出现、一角翘着，再推向对边按平；推完还带一下收尾脉冲（缩小淡出 → 放大淡入）
│   └── IdleMotion.ts        通用循环待机动作（以编辑器里摆的位置为基准走正弦）
├── ui/
│   ├── GuideController.ts   空闲引导：手指 + 半透明副本演一遍拖动（纯画面，不碰玩法）
│   ├── ProgressController.ts 进度显示
│   ├── ScreenAdapter.ts     屏幕策略：按窗口比例换 ResolutionPolicy 把画布撑满（§7.1）
│   ├── LandscapeLayout.ts   横屏两栏布局（§7.1）
│   ├── BackgroundSwap.ts    横竖屏各一张底图，转屏换 spriteFrame（§7.1）
│   └── PuzzleAreaFit.ts     拼图框按底图比例自适应：改尺寸不改位置，编辑期（@executeInEditMode）跟随换图（§7.1）
├── platform/
│   ├── MraidBridge.ts       MRAID 生命周期、ready 时序、平台判定、静音通知（openStore() 是唯一跳转入口）
│   ├── CtaController.ts     结束界面：背景淡入 + logo / 按钮下落弹跳（配了结尾视频就先播它，§18）
│   ├── EndVideo.ts          结尾视频：完成背景刷完后盖着拼图区播一段，播完 / 点一下才亮结束界面（§18）
│   ├── EndgameCta.ts        终局跳转：修满 winCount 个 / 修错 → 跳商店，之后点哪都跳
│   ├── GameCta.ts           游戏中常驻的下载按钮
│   └── PlayableAnalytics.ts AppLovin 试玩埋点，见 §17
├── audio/
│   └── AudioManager.ts      音频总控：配置列表（激活事件 / 音效或顺序列表 / 音量 / 渐入渐出 / 循环间隔 / 结束事件）+ 按压音效按钮
└── bootstrap/
    └── GameEntry.ts         唯一入口，负责初始化与模块装配
```

新增 / 改名脚本，`.scene` 里的组件引用不会断（按**脚本 uuid** 记 `__type__`，不是类名），
只要 `.ts` 和 `.ts.meta` 一起改、uuid 不变。

⚠️ **「代码里有」不等于「当前场景在用」**：`FlushAction` / `BroomSweep` / `SprayAction` / `GroundWater`
四个收尾动作、`IdleMotion` 待机动作、`PieceSlot` 的 `swapHide`+`swapShow`（换节点）
与 `altView`+`requires`（两种状态）、`poolSprite` —— **脚本都还在、都没坏，但场景里连组件实例都没有
（它们要挂的那些节点也已经不存在了）**；`RepairReveal` / `CircleReveal` / `RepairSweep` 三个特效组件
倒还挂在 `EffectLayer` 上，但**总开关是关的、槽位也没配**。改「表现」之前先确认那一格到底走的是哪条路 ——
清单在**现状速查**里。写代码时**不要**按这些"还能用"的前提去改动它们（会白改）。

