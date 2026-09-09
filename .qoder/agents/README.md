# 多 Agent 研发流水线

本目录包含项目研发流程中各阶段 Agent 的提示词文件与流程说明。

## 适用场景

覆盖 Web 应用产品从需求到测试的完整研发流程：

```
PM Agent → UE/UI Agent → Dev Agent → QA Agent
```

## 文件说明

| 文件 | 用途 |
| :--- | :--- |
| `workflow.md` | 定义四阶段流程、文件命名规则、准入/准出条件、异常处理 |
| `handoff-checklist.md` | 各阶段验收清单，作为阶段交接依据 |
| `pm-agent.md` | 产品经理 Agent 提示词，输出 PRD |
| `ux-agent.md` | UE/UI 设计师 Agent 提示词，输出设计文档 |
| `dev-agent.md` | 开发 Agent 提示词，输出 HLD 与代码 |
| `qa-agent.md` | 测试 Agent 提示词，输出测试计划/报告 |

## 输出模板

所有输出模板位于 `docs/templates/`：

| 模板 | 使用阶段 |
| :--- | :--- |
| `docs/templates/prd-template.md` | PM Agent |
| `docs/templates/design-template.md` | UE/UI Agent |
| `docs/templates/hld-template.md` | Dev Agent |
| `docs/templates/test-plan-template.md` | QA Agent |

## 交付物目录

- `docs/prd/`：PRD 文档
- `docs/design/`：设计文档
- `docs/hld/`：高层设计文档
- `docs/test/`：测试计划与报告

## 使用方式

1. 从 `pm-agent.md` 开始，根据产品想法生成 PRD。
2. PRD 验收通过后，使用 `ux-agent.md` 生成设计文档。
3. 设计文档验收通过后，使用 `dev-agent.md` 生成 HLD 与代码。
4. 开发自测通过后，使用 `qa-agent.md` 生成测试计划/报告。

每个阶段必须满足 `handoff-checklist.md` 中的准出条件，方可进入下一阶段。

## 相关文件

- `AGENTS.md`：项目全局开发规范与约束
- `docs/superpowers/specs/2026-09-09-multi-agent-rd-pipeline-design.md`：本流水线设计文档
