set -e
export GIT_TERMINAL_PROMPT=0
BR="Puzzle_261015_PlayableAd"
git checkout -b "$BR" 2>/dev/null || git checkout "$BR"
git add -A
echo "STAGED=$(git diff --cached --name-only | wc -l)"
git commit -q -m "chore: 项目收尾 — 文档体系重构与 DSH 工作区迁移" \
  -m "工作区全部改动一次性收尾：CLAUDE.md 改名 AGENTS.md 并瘦身 40%；WORKLOG 292KB 按主题拆为 docs/worklog/ 13 个小文件；新增 docs/changes 提交记录约定与 docs/reports 日报；.claude 技能迁至 .dsh/skills 并纳入版本库；删除过期 .mcp.json。同时包含 1010 美术资源清理与脚本既有改动。"
HASH=$(git rev-parse --short HEAD)
sed -i "s/<待回填>/$HASH/g" docs/changes/*.md
git add docs/changes
git commit -q --amend --no-edit
echo "HASH=$HASH AMENDED=$(git rev-parse --short HEAD)"
echo "--- pushing ---"
git push -u origin "$BR" && echo "PUSH=ok" || echo "PUSH=failed"
echo "--- done ---"