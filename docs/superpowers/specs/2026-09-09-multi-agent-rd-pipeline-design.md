# 多 Agent Web 应用研发流水线设计

> **版本**：v1.0  
> **日期**：2026-09-09  
> **状态**：待实现  
> **适用范围**：`D:\Code\Qoder\stockF4` 全栈 Web 应用产品研发项目

---

## 1. 概述

本项目采用 **PM → UE/UI → Dev → QA** 四阶段多 Agent 协作研发模式。每个阶段由对应的 Agent 负责，生成标准化文档后交接给下一阶段。本设计定义 Agent 提示词文件、输出模板、阶段交接规则及目录结构。

---

## 2. 目标

- 将产品研发流程固化为可重复执行的配置与提示词。
- 保证每个阶段的输入、输出、质量标准清晰可追溯。
- 让不同 Agent 在同一产品上接力工作时，上下文一致、交付物规范。
- 所有阶段交付物统一归档到 `docs/` 目录，便于查阅与版本管理。

---

## 3. 范围

### 包含

- 4 个 Agent 提示词文件（PM、UE/UI、Dev、QA）。
- 4 个阶段输出模板（PRD、设计文档、HLD、测试计划/报告）。
- 1 个流程说明文件（`workflow.md`）。
- 1 个阶段验收清单（`handoff-checklist.md`）。
- Agent 流水线总览说明（`README.md`）。

### 不包含

- 具体的业务功能实现。
- CI/CD 流水线配置。
- 自动化 Agent 调度/编排系统（当前为人工或脚本按阶段触发）。

---

## 4. 文件结构

```
D:\Code\Qoder\stockF4\
├── AGENTS.md                              # 已存在：全局开发规范与约束
├── .qoder\
│   └── agents\
│       ├── README.md                      # Agent 流水线总览与使用说明
│       ├── workflow.md                    # 阶段定义与交接规则
│       ├── handoff-checklist.md           # 阶段验收清单
│       ├── pm-agent.md                    # 产品经理 Agent 提示词
│       ├── ux-agent.md                    # UE/UI 设计师 Agent 提示词
│       ├── dev-agent.md                   # 开发 Agent 提示词
│       └── qa-agent.md                    # 测试 Agent 提示词
└── docs\
    ├── prd/                               # PM 输出目录（运行时生成）
    ├── design/                            # UE/UI 输出目录（运行时生成）
    ├── hld/                               # Dev 输出目录（运行时生成）
    ├── test/                              # QA 输出目录（运行时生成）
    └── templates\
        ├── prd-template.md                # PM 输出模板
        ├── design-template.md             # UE/UI 输出模板
        ├── hld-template.md                # Dev 高层设计模板
        └── test-plan-template.md          # QA 测试计划/报告模板
```

---

## 5. Agent 与阶段定义

| 阶段 | Agent | 输入 | 输出 |
| :--- | :--- | :--- | :--- |
| 1. 需求 | PM Agent | 产品想法/问题描述 | `docs/prd/YYYY-MM-DD-<feature>-prd.md` |
| 2. 设计 | UE/UI Agent | PRD | `docs/design/YYYY-MM-DD-<feature>-design.md` |
| 3. 开发 | Dev Agent | PRD + 设计文档 | `docs/hld/YYYY-MM-DD-<feature>-hld.md` + 代码 |
| 4. 测试 | QA Agent | PRD + 设计 + HLD + 代码 | `docs/test/YYYY-MM-DD-<feature>-test-plan.md` + 测试报告 |

### 5.1 产品经理 Agent（pm-agent.md）

- **角色**：负责将产品想法转化为结构化 PRD。
- **核心任务**：
  1. 理解产品目标与用户痛点。
  2. 编写用户故事与功能清单。
  3. 定义验收标准与成功指标。
  4. 识别非功能需求（性能、安全、兼容性等）。
- **输出**：按 `docs/templates/prd-template.md` 生成 PRD。

### 5.2 UE/UI 设计师 Agent（ux-agent.md）

- **角色**：负责根据 PRD 设计交互流程与信息架构。
- **核心任务**：
  1. 梳理信息架构与用户流程。
  2. 定义页面结构与导航。
  3. 说明核心交互逻辑与状态变化。
  4. 输出设计 tokens 与组件建议（基于 `AGENTS.md` 技术栈）。
- **输出**：按 `docs/templates/design-template.md` 生成设计文档。

### 5.3 开发 Agent（dev-agent.md）

- **角色**：负责根据 PRD 与设计文档完成高层设计及编码。
- **核心任务**：
  1. 设计系统架构与模块划分。
  2. 定义数据模型与 API 契约。
  3. 编写 HLD 文档。
  4. 完成代码实现并确保通过 lint、类型检查与单元测试。
- **输出**：`docs/hld/YYYY-MM-DD-<feature>-hld.md` + 代码。

### 5.4 测试 Agent（qa-agent.md）

- **角色**：负责制定测试策略、编写测试用例并输出测试报告。
- **核心任务**：
  1. 基于 PRD、设计文档、HLD 识别测试范围。
  2. 编写单元测试、集成测试、E2E 测试用例。
  3. 执行测试并记录结果。
  4. 输出测试报告，包含缺陷汇总与上线建议。
- **输出**：按 `docs/templates/test-plan-template.md` 生成测试计划/报告。

---

## 6. 交接规则（workflow.md）

### 6.1 流程顺序

```
产品想法 → PM Agent → PRD → UE/UI Agent → 设计文档 → Dev Agent → HLD + 代码 → QA Agent → 测试报告
```

### 6.2 阶段准入条件

- **PM 阶段**：产品想法/问题描述已明确。
- **UE/UI 阶段**：PRD 已通过 `handoff-checklist.md` 验收。
- **Dev 阶段**：PRD 与设计文档均已验收。
- **QA 阶段**：HLD 与代码已完成并通过开发自测。

### 6.3 阶段准出条件

每个阶段完成后，必须：

1. 按对应模板生成完整交付物。
2. 通过 `handoff-checklist.md` 中该阶段所有验收项。
3. 交付物文件名符合 `YYYY-MM-DD-<feature>-<stage>.md` 规范。
4. 交付物中无 `TBD`、`TODO` 等未决事项，或已明确记录为后续迭代。

### 6.4 异常处理

- 若某阶段验收不通过，必须回到该阶段 Agent 重新处理，不可跳过。
- 若发现上一阶段缺陷，可退回上一阶段，并更新对应交付物。

---

## 7. 输出模板设计

### 7.1 PRD 模板（prd-template.md）

- 背景与目标
- 目标用户
- 用户故事
- 功能清单
- 非功能需求
- 验收标准
- 成功指标
- 风险与依赖
- 附录

### 7.2 设计文档模板（design-template.md）

- 设计目标
- 信息架构
- 用户流程图
- 页面结构
- 核心交互说明
- 设计 tokens（颜色、字体、间距）
- 组件建议
- 响应式/适配说明
- 验收 checklist

### 7.3 HLD 模板（hld-template.md）

- 架构概述
- 模块划分
- 数据模型
- API 设计
- 错误处理
- 安全考虑
- 性能考虑
- 部署/运维考虑
- 待确认事项

### 7.4 测试计划/报告模板（test-plan-template.md）

- 测试范围
- 测试环境
- 测试策略
- 单元测试用例
- 集成测试用例
- E2E 测试用例
- 执行结果
- 缺陷汇总
- 测试结论与上线建议

---

## 8. 提示词文件通用结构

每个 `*.agent.md` 文件包含以下章节：

1. **角色（Role）**：Agent 身份与职责。
2. **目标（Goal）**：该阶段要达成的结果。
3. **输入（Input）**：必须读取的上下文文件路径与格式。
4. **执行步骤（Steps）**：按顺序执行的任务列表。
5. **输出要求（Output）**：必须生成的文件、命名规则、保存位置。
6. **质量标准（Quality Standards）**：必须遵守的规范与检查项。
7. **约束（Constraints）**：禁止事项与边界条件。
8. **交接说明（Handoff）**：如何通知下一阶段或标记完成。

---

## 9. 验收标准

本设计实现后，应满足：

- [ ] `.qoder/agents/` 下存在全部 7 个文件。
- [ ] `docs/templates/` 下存在全部 4 个模板。
- [ ] 每个 Agent 提示词文件结构完整、角色清晰、输出要求明确。
- [ ] `workflow.md` 完整定义四阶段流程、准入/准出条件、异常处理。
- [ ] `handoff-checklist.md` 每个阶段至少包含 5 项可检查的验收项。
- [ ] 所有文件互相引用路径正确，无歧义。

---

## 10. 后续工作

1. 实现上述 Agent 提示词文件与模板文件。
2. 在实际需求上验证一次完整流程（PM → UE/UI → Dev → QA）。
3. 根据验证结果迭代优化提示词与模板。
