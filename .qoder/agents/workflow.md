# 多 Agent 研发流程说明

## 流程总览

```
产品想法/问题描述
    ↓
PM Agent
    ↓
docs/prd/YYYY-MM-DD-<feature>-prd.md
    ↓
UE/UI Agent
    ↓
docs/design/YYYY-MM-DD-<feature>-design.md
    ↓
Dev Agent
    ↓
docs/hld/YYYY-MM-DD-<feature>-hld.md + 代码
    ↓
QA Agent
    ↓
docs/test/YYYY-MM-DD-<feature>-test-plan.md + 测试报告
```

## 阶段准入条件

| 阶段 | 准入条件 |
| :--- | :--- |
| PM | 产品想法或问题描述已明确 |
| UE/UI | PRD 已通过 `handoff-checklist.md` 验收 |
| Dev | PRD 与设计文档均已通过验收 |
| QA | HLD 与代码已完成，并通过开发自测 |

## 阶段准出条件

每个阶段完成后必须满足：

1. 按对应模板生成完整交付物。
2. 通过 `handoff-checklist.md` 中该阶段所有验收项。
3. 交付物文件名符合 `YYYY-MM-DD-<feature>-<stage>.md` 规范。
4. 交付物中无未决 `TBD`、`TODO`，或已明确记录为后续迭代。
5. 引用 `AGENTS.md` 中的全局规范，无冲突。

## 文件命名规则

- PRD：`docs/prd/YYYY-MM-DD-<feature>-prd.md`
- 设计文档：`docs/design/YYYY-MM-DD-<feature>-design.md`
- HLD：`docs/hld/YYYY-MM-DD-<feature>-hld.md`
- 测试计划/报告：`docs/test/YYYY-MM-DD-<feature>-test-plan.md`

日期使用需求/任务启动当天日期，`feature` 使用小写 kebab-case。

## 异常处理

- 阶段验收不通过：回到该阶段 Agent 重新处理，不可跳过。
- 发现上一阶段缺陷：退回上一阶段，更新对应交付物后重新验收。
- 需求中途变更：回到 PM 阶段重新评估，并更新后续所有受影响文档。

## Agent 触发方式

当前为人工或脚本触发。触发下一阶段 Agent 时，必须提供：

1. 上一阶段交付物的绝对路径。
2. 本次 feature 名称（用于生成输出文件名）。
3. 任何需要特别注意的约束或上下文。
