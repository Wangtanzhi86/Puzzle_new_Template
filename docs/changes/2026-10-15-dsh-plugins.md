# 装 DSH 插件：save-token / dsh-context / better-sidebar / dsh-market

- 日期：2026-10-15
- 提交：5cd7183（profile 改动在工作区之外，不进本仓库）

## 改了什么

- 装上：`dsh-plugin-save-token@2.4.1`、`dsh-context@0.70.0`、`dsh-better-sidebar@0.26.0`、`@dsh-market/plugin@0.4.13`
- `~/.dsh/profiles/desktop/cordis.patch.yml` 里打开了 `tool-plugin-manager`（备份 `.bak-2026-10-15`）

## 为什么这么改

- 本机**无法从沙箱启动任何子进程**（`pwsh` 恒定 `0xC0000142`，直接 spawn 报 EPERM），
  跑不了 `pnpm` —— 只能用 DSH 原生的 `plugin_manager` 工具装。
- 该工具在 profile 里默认禁用，所以先打开再装。

## 怎么验的

- `plugin_manager list_bundles` 确认 4 个都是 `installed: true, enabled: true`。
- `save_token_expand` 工具出现且压缩提示可见 ⇒ save-token 已实际生效。

## 影响什么 / 还没验的部分

- ⚠️ `@yilinxiao/dsh-mcp-lazy` **被 DSH 拒绝**：
  peer 依赖与运行时 `0.2.0-rc.2` 不兼容；开版本豁免有崩溃/数据丢失风险，**已决定放弃**。
  105 个 cocos MCP 工具仍然常驻上下文。
- `tool-plugin-manager` 目前仍是开启状态；不想让 agent 具备装插件能力就去掉那两行。
