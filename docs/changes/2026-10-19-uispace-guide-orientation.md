# 工作包 A：坐标系单一出口 UISpace + 引导手转屏重来 + 删掉吸附半径快照

- 日期：2026-10-19
- 提交：56e71b8
- 关联：`docs/手感移植清单-到Puzzle_new_Template.md` 工作包 A（A1–A5）

## 改了什么

- **新增 `assets/scripts/core/UISpace.ts`**：全工程唯一碰 `view.*` 的地方。
  导出 `frameSize()`（窗口像素，只判方向）、`visibleSize()`（可视区设计单位）、`designSize()`（项目设置那 720×1280）、`visibleRect()`（世界系里的可视矩形，原点在中心）、`uiToWorld(x, y, out?)`、`applyResolution(design, policy)`（只给 `ScreenAdapter` 用）。
  头注释写清前提与出处：`Touch.getUILocation()` 的单位是设计单位、原点在可视区左下角（`cocos/ui/view.ts:586-590`）；`visibleRect` 恒等于可视区（`view.ts:436-484`）；Canvas 被自带 Widget 撑满（`widget-manager.ts:79-85,141-147`）⇒ **Canvas 世界坐标 = 可视区中心、scale = 1、世界系 == UI 系数值**。
- **`assets/scripts/ui/ScreenAdapter.ts`**：`view.getFrameSize/getDesignResolutionSize/setDesignResolutionSize` 三处改走 `UISpace`，策略判断与 `current` 缓存的逻辑不变。
- **`assets/scripts/bootstrap/GameEntry.ts`**：`probe()` 里的 `view.getFrameSize()` / `getVisibleSize()` 与 `isPortrait()` 改走 `UISpace`；不再 import `view`。
- **`assets/scripts/ui/LandscapeLayout.ts`**：常驻按钮位置那处 `view.getVisibleSize().width` 改 `visibleSize().width`。
- **A2 删掉 `SlotData.snapRadius`**（`assets/scripts/data/LevelTypes.ts`、`assets/scripts/level/LevelFactory.ts`），`assets/scripts/gameplay/SnapSystem.ts` 的圆形分支改成现读 `d.slot.radius`；`LevelTypes` 里留一条注记「派生量一律现读，别存快照」。
- **A3 `assets/scripts/ui/GuideController.ts`**：`onEnable`/`onDisable` 订阅 `GameEvent.ORIENTATION_CHANGED`；新增 `onOrientation`：停掉 root / ghost / UIOpacity / finger 上的 tween，`_showing = false`、root 收起，然后**立刻 `show()` 重来** —— `play()` 里的起点（碎片实时 `worldPosition`）和终点（`slot.worldCenter`）都是现读的，重来一遍自然对准新画布。
- `assets/scripts/level/PieceSlot.ts`：`snapRadius` / `snapRadiusRatio` 的 tooltip 改成「只在圆形模式生效」，和 C3 的落地方式对齐（见 2026-10-19-feel-drag-snap-insert-reveal.md）。

## 为什么这么改

- **为什么要把 `view.` 收口**：本工程有 720×1280 / ~1770×1280 两种画布，还有一批「现读 vs 快照」的坑（`SlotData.snapRadius` 就是活样本）。`view.*` 散在四个文件里时，谁在什么时候读、读到的是哪一版，只能靠人去记。
- **为什么不把 `uiToWorld` 写成真的矩阵变换**（否掉的方案）：现在 Canvas 的 scale 恒为 1、原点在可视区中心，真做一层矩阵就是**没人验证的死代码**，而且和引擎的真实变换会悄悄漂。现在它是恒等映射 + 一段写清前提的注释，将来真加缩放时改的正好是这一处。
- **为什么删快照、不改成「转屏时刷新快照」**（否掉的方案）：`radius` 是 `width/height` 的派生量，而 `width/height` 本身是现算的 getter。刷新快照要求每个监听 `ORIENTATION_CHANGED` 的人都记得刷 —— 漏一个就是二次 bug；现读没有这个失败模式。
- **为什么引导手是「停掉重来」而不是「改 tween 终点」**：Tween 抓的是数值快照，不支持改目标值（清单 B4 那条已经踩过）。重来一遍的代价是这一遍从头演，收益是绝对不会飞向旧坐标。
- **为什么转屏时立刻重来、不先等 `idleDelay`**：转屏那一刻玩家正在看引导，等几秒再出现会像「引导没了」。

## 怎么验的

- `grep -rn "view\." assets/scripts --include=*.ts`：引擎 `view` 只剩 `core/UISpace.ts` 里那 6 处（其余命中都是局部变量叫 `view` 的地方，如 `SnapReveal.ts:78`）。
- `grep -rn "snapRadius:" assets/scripts`：只剩注释，字段已删。
- `git diff` 逐段复核（含 A2 的三处引用、A3 的订阅/退订成对）。
- **`npm run check` 没跑成**：`连不上 MCP (http://127.0.0.1:21058/mcp)：fetch failed` —— 编辑器没开，端口按项目路径现算（本机这条路径算出来是 21058；`docs/STATUS.md` 记的 27502 是另一份工程路径的结果）。所以**场景校验、编译告警、预览全是空白**。
- A5 逐条核查 `grep -n "worldPosition\|worldCenter" assets/scripts`：除了两处 **tween 终点**（`GuideController.play()` 的 `data.slot.worldCenter`、`PiecePool.sendHome()` 的 `entry.spacer.getWorldPosition()`）都是现读；前者已由 `onOrientation` 兜住，后者在转屏时走 `sendHome(entry, true)` 即时落位（`DragController.onOrientation`）。`PiecePool.consumeAll` / `AutoPlayer.fly` 本来就是「先克隆 from、排完版再读 to」的正确写法，未动。

## 影响什么 / 还没验的部分

- `SlotData` 少一个字段：全仓只有 `LevelFactory` / `SnapSystem` 两处消费，已同步；场景里没有序列化这个字段，不需要迁移。
- `UISpace` 是新文件，需要编辑器刷新资源库才认（`npm run check` 之前先刷新）。
- 转屏时引导手会**从头演一遍**（而不是从中断处续），这条只有人工转屏才看得出观感是否突兀。
- 圆形吸附模式（`snapMode = 0`）现在读 `slot.radius`，行为等价但**没实测**；默认走矩形，老圆模式属于回退路径。
- `npm run check` / 编译 / 预览**全未跑**，交给开编辑器的下一步。
