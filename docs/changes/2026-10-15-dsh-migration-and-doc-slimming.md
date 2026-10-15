# DSH 工作区瘦身：拆文档、迁技能、装插件

- 日期：2026-10-15
- 提交：5cd7183

## 改了什么

- `CLAUDE.md` → **`AGENTS.md`**（61,486 B → 36,533 B，−40.6%）
- 原「现状速查」整节 → `docs/STATUS.md`；§4 → `docs/ARCH.md`；§18 → `docs/VIDEO.md`（均逐字搬运）
- `docs/WORKLOG.md` 299,225 B → **11,961 B** 索引；正文按主题拆成 `docs/worklog/01..13-*.md`（逐字搬运，13 个文件 / 71 节）
- `.dsh/skills` 从「指向 `.claude/skills` 的目录联接」改为**真实目录并进版本库**；删除 `.claude/`、`.mcp.json`
- `.gitignore`：`.dsh/*` + `!.dsh/skills/`
- 21 个文件里的 `CLAUDE.md §N` 引用 → `AGENTS.md §N`
- 新增本目录 `docs/changes/`（每次提交一个文档）

## 为什么这么改

- 工作区指令预算 64KB，`CLAUDE.md` 已经占 96%，再涨会被**从中间截断**（§11 之后全丢）。
- ⚠️ **DSH 的指令文件候选是 `["AGENTS.md", "CLAUDE.md"]` —— 两个都在会被读两遍**（双倍注入）。
  所以必须**改名**而不是复制；别再把 `CLAUDE.md` 引进来。
- WORKLOG 的问题是**单一文件 292KB**：要查一个主题也得整个读。拆成 13 个 10–40KB 的文件后按需读一个就够。
- ⚠️ **git 历史替不了 WORKLOG**：当时全仓库只有 6 个 commit，全是一行摘要，
  而 WORKLOG 里是逐格接线、被否方案、实测读数 —— 所以做了**逐字拆分**而不是删除。

## 怎么验的

- 拆分后逐个文件核对字节数 + 节数（见 `docs/WORKLOG.md` 的文件地图表）。
- `git check-ignore -v .dsh/skills` 确认技能文件会进版本库。
- 全仓库 grep `CLAUDE.md`：`extensions/funplay-cocos-mcp/**` 之外**已无残留**
  （该扩展是第三方，Claude Code 只是它支持的客户端之一，**故意不动**）。

## 影响什么 / 还没验的部分

- `.claude/` 空目录当时删不掉（`Permission denied`，句柄未释放）—— 重启 DSH 后 `rmdir /s /q .claude`。
- 插件安装见下一节：`dsh-mcp-lazy` 因 peer 依赖不兼容**被 DSH 拒绝**，已放弃。
