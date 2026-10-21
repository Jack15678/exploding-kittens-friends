# 爆炸猫 · 好友厨房

- 禁止未经用户同意使用子 agent。A/B 测试前询问是否必要。
- 仅供作者与朋友非商业娱乐。使用原创牌面与文案。
- 修改规则或食谱前阅读 `docs/RULES.md`；联机只向每人发送允许其看到的状态。
- 运行 `npm test` 与 `npm run build`；UI / 联机变更进行相应浏览器验证。
- 本地提交不代表可以推送或发布。

<!-- dev-memory:start -->
## Dev Memory

This project enables the `dev-memory` Skill. Read its SKILL.md when available.
- Maintain docs/dev-memory/HISTORY.md (events and verification), DECISIONS.md
  (choices and lasting constraints), and KNOWLEDGE.md (reusable lessons) as
  valuable information appears. Keep one authoritative explanation; cross-reference it.
- Distinguish proposed/accepted/rejected/superseded decisions, user choices,
  agent choices, and retrospective inference. Never invent historical reasons.
- Follow git_policy in .dev-memory.json and current user instructions. The default
  commit-complete-task-with-records policy commits a coherent, appropriately verified
  small task to local Git, using explicit task paths and the memory_git setting below.
  Preserve any user-chosen policy. Inspect the index first; never include unrelated
  staged work or bypass checks.
- Save attempted approaches and evidence; distinguish implemented from verified.
- For handoff, checkpoint the current goal, latest user constraints, progress,
  verification and next action. A snapshot does not transfer uncommitted files.
- Read only relevant entries. Hooks only prompt the current agent; they never
  interpret conversations, create another agent, or run Git commits.
- Current user boundaries override this workflow. If the user requests read-only,
  no writes, no commit, or stop, honor that even when a hook requests a check.
- memory_git in .dev-memory.json overrides instructions to commit records:
  local keeps docs/dev-memory/ out of Git; tracked permits committing the records.
  Never force-add local memory or copy its contents into commit messages.
<!-- dev-memory:end -->
