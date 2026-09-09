# 多 Agent Web 应用研发流水线实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一套覆盖 PM → UE/UI → Dev → QA 四阶段的 Agent 提示词文件、输出模板、流程说明与交接清单。

**Architecture:** 所有 Agent 提示词统一放在 `.qoder/agents/`，所有输出模板统一放在 `docs/templates/`，实际交付物按阶段落入 `docs/prd/`、`docs/design/`、`docs/hld/`、`docs/test/`。通过 `workflow.md` 定义阶段顺序与准入/准出条件，`handoff-checklist.md` 作为验收依据。

**Tech Stack:** Markdown 文档；无运行时依赖。

---

## 文件结构

```
D:\Code\Qoder\stockF4\
├── AGENTS.md                              # 已存在
├── .qoder\agents\
│   ├── README.md                          # 总览与使用说明
│   ├── workflow.md                        # 阶段定义与交接规则
│   ├── handoff-checklist.md               # 阶段验收清单
│   ├── pm-agent.md                        # 产品经理 Agent 提示词
│   ├── ux-agent.md                        # UE/UI 设计师 Agent 提示词
│   ├── dev-agent.md                       # 开发 Agent 提示词
│   └── qa-agent.md                        # 测试 Agent 提示词
└── docs\
    ├── prd/                               # 运行时输出目录
    ├── design/                            # 运行时输出目录
    ├── hld/                               # 运行时输出目录
    ├── test/                              # 运行时输出目录
    └── templates\
        ├── prd-template.md                # PM 输出模板
        ├── design-template.md             # UE/UI 输出模板
        ├── hld-template.md                # Dev 输出模板
        └── test-plan-template.md          # QA 输出模板
```

---

### Task 1: 创建目录结构

**Files:**
- Create directory: `.qoder/agents/`
- Create directory: `docs/templates/`
- Create directory: `docs/prd/`
- Create directory: `docs/design/`
- Create directory: `docs/hld/`
- Create directory: `docs/test/`

- [ ] **Step 1: 创建所有目录**

Run:
```bash
mkdir -p "D:\Code\Qoder\stockF4\.qoder\agents"
mkdir -p "D:\Code\Qoder\stockF4\docs\templates"
mkdir -p "D:\Code\Qoder\stockF4\docs\prd"
mkdir -p "D:\Code\Qoder\stockF4\docs\design"
mkdir -p "D:\Code\Qoder\stockF4\docs\hld"
mkdir -p "D:\Code\Qoder\stockF4\docs\test"
```

Expected: 6 个目录全部创建成功，无报错。

---

### Task 2: 创建核心流程文件

**Files:**
- Create: `.qoder/agents/workflow.md`
- Create: `.qoder/agents/handoff-checklist.md`

- [ ] **Step 1: 创建 workflow.md**

Create `D:\Code\Qoder\stockF4\.qoder\agents\workflow.md` with:

```markdown
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
```

- [ ] **Step 2: 创建 handoff-checklist.md**

Create `D:\Code\Qoder\stockF4\.qoder\agents\handoff-checklist.md` with:

```markdown
# 阶段验收清单

## PM 阶段准出检查

- [ ] PRD 已按 `docs/templates/prd-template.md` 完整填写。
- [ ] 包含清晰的目标用户与用户故事。
- [ ] 功能清单已拆分，每个功能有明确验收标准。
- [ ] 非功能需求（性能、安全、兼容性）已说明。
- [ ] 文件保存为 `docs/prd/YYYY-MM-DD-<feature>-prd.md`。
- [ ] 文档中无未决 `TBD`、`TODO`，或已标记为后续迭代。

## UE/UI 阶段准出检查

- [ ] 设计文档已按 `docs/templates/design-template.md` 完整填写。
- [ ] 信息架构与用户流程完整，无歧义。
- [ ] 核心页面与交互说明覆盖 PRD 中所有功能。
- [ ] 设计 tokens 与组件建议符合 `AGENTS.md` 技术栈。
- [ ] 文件保存为 `docs/design/YYYY-MM-DD-<feature>-design.md`。
- [ ] 文档中无未决 `TBD`、`TODO`，或已标记为后续迭代。

## Dev 阶段准出检查

- [ ] HLD 已按 `docs/templates/hld-template.md` 完整填写。
- [ ] 代码实现覆盖 PRD 与设计文档中所有功能。
- [ ] 代码通过 lint 与类型检查。
- [ ] 单元测试已补充并通过（核心逻辑覆盖率 ≥ 80%）。
- [ ] HLD 保存为 `docs/hld/YYYY-MM-DD-<feature>-hld.md`。
- [ ] 无敏感信息硬编码，配置通过环境变量管理。

## QA 阶段准出检查

- [ ] 测试计划/报告已按 `docs/templates/test-plan-template.md` 完整填写。
- [ ] 测试范围覆盖 PRD、设计文档、HLD 中的关键路径。
- [ ] 单元、集成、E2E 测试用例齐全。
- [ ] 测试结果已记录，缺陷已汇总并分级。
- [ ] 报告保存为 `docs/test/YYYY-MM-DD-<feature>-test-plan.md`。
- [ ] 已给出明确的上线/回退建议。
```

- [ ] **Step 3: 验证文件存在**

Run:
```bash
ls "D:\Code\Qoder\stockF4\.qoder\agents\workflow.md"
ls "D:\Code\Qoder\stockF4\.qoder\agents\handoff-checklist.md"
```

Expected: 两个文件均存在。

---

### Task 3: 创建 PRD 模板与 PM Agent

**Files:**
- Create: `docs/templates/prd-template.md`
- Create: `.qoder/agents/pm-agent.md`

- [ ] **Step 1: 创建 prd-template.md**

Create `D:\Code\Qoder\stockF4\docs\templates\prd-template.md` with:

```markdown
# <Feature Name> 产品需求文档

> **版本**：v1.0  
> **日期**：YYYY-MM-DD  
> **状态**：Draft / Review / Final  
> **作者**：PM Agent

---

## 1. 背景与目标

### 1.1 背景
[描述为什么要做这个功能，解决什么问题]

### 1.2 目标
[用一句话描述本次需求的核心目标]

### 1.3 成功指标
[可量化的指标，例如转化率提升、错误率下降等]

---

## 2. 目标用户

[描述主要用户画像及其痛点]

---

## 3. 用户故事

- 作为 [角色]，我希望 [目标]，以便 [价值]。
- 作为 [角色]，我希望 [目标]，以便 [价值]。

---

## 4. 功能清单

### 4.1 功能 A

- **功能描述**：[简短描述]
- **优先级**：P0 / P1 / P2
- **验收标准**：
  - [ ] 验收项 1
  - [ ] 验收项 2

### 4.2 功能 B

- **功能描述**：[简短描述]
- **优先级**：P0 / P1 / P2
- **验收标准**：
  - [ ] 验收项 1
  - [ ] 验收项 2

---

## 5. 非功能需求

- **性能**：[响应时间、并发量等]
- **安全**：[权限、数据保护等]
- **兼容性**：[浏览器、设备、API 版本等]
- **可用性**：[可用性目标、降级策略等]

---

## 6. 边界与约束

- [列出明确不做的事项]
- [列出技术或业务约束]

---

## 7. 风险与依赖

| 风险 | 影响 | 缓解措施 |
| :--- | :--- | :--- |
| 风险 1 | 高/中/低 | [措施] |
| 风险 2 | 高/中/低 | [措施] |

---

## 8. 附录

[参考资料、原型链接、相关文档等]
```

- [ ] **Step 2: 创建 pm-agent.md**

Create `D:\Code\Qoder\stockF4\.qoder\agents\pm-agent.md` with:

```markdown
# 产品经理 Agent（PM Agent）

## 角色

你是本项目的**产品经理 Agent**。你的职责是将产品想法或问题描述转化为结构清晰、可执行的 PRD（产品需求文档），为 UE/UI 设计阶段提供完整输入。

## 目标

为每个 feature 生成一份符合 `docs/templates/prd-template.md` 的 PRD，保存到 `docs/prd/YYYY-MM-DD-<feature>-prd.md`。

## 输入

1. 产品想法或问题描述（用户直接提供）。
2. `AGENTS.md`（项目全局规范，必须遵守）。
3. `docs/templates/prd-template.md`（输出格式模板）。

## 执行步骤

1. **理解背景**：分析用户给出的产品想法，识别目标用户、核心痛点与业务价值。
2. **定义目标**：用一句话概括本次需求的核心目标，并给出可量化的成功指标。
3. **编写用户故事**：按“作为 [角色]，我希望 [目标]，以便 [价值]”格式编写。
4. **拆解功能清单**：将需求拆分为独立功能点，每个功能点包含描述、优先级和验收标准。
5. **补充非功能需求**：性能、安全、兼容性、可用性等。
6. **识别边界与风险**：明确不做的事项、技术/业务约束、风险与依赖。
7. **生成 PRD**：按模板格式输出完整 PRD。
8. **自检**：对照 `handoff-checklist.md` 中 PM 阶段准出项逐项检查。

## 输出要求

- 文件路径：`docs/prd/YYYY-MM-DD-<feature>-prd.md`
- 文件名规范：`YYYY-MM-DD-<feature>-prd.md`，其中 `<feature>` 使用小写 kebab-case
- 必须包含：背景、目标、目标用户、用户故事、功能清单、验收标准、非功能需求
- 文档中不得出现未说明的 `TBD` 或 `TODO`

## 质量标准

- 功能清单可独立交付，边界清晰。
- 验收标准具体、可测试。
- 与 `AGENTS.md` 中的技术栈和架构约束无冲突。

## 约束

- 禁止直接讨论实现细节或技术方案。
- 禁止跳过用户故事直接罗列功能点。
- 禁止输出代码、数据库设计或 API 定义。

## 交接说明

PRD 完成后，通知 UE/UI Agent 进入设计阶段，提供：

1. PRD 文件绝对路径。
2. Feature 名称。
3. 需要重点关注的用户体验或业务约束。
```

- [ ] **Step 3: 验证文件存在**

Run:
```bash
ls "D:\Code\Qoder\stockF4\docs\templates\prd-template.md"
ls "D:\Code\Qoder\stockF4\.qoder\agents\pm-agent.md"
```

Expected: 两个文件均存在。

---

### Task 4: 创建设计文档模板与 UE/UI Agent

**Files:**
- Create: `docs/templates/design-template.md`
- Create: `.qoder/agents/ux-agent.md`

- [ ] **Step 1: 创建 design-template.md**

Create `D:\Code\Qoder\stockF4\docs\templates\design-template.md` with:

```markdown
# <Feature Name> 设计文档

> **版本**：v1.0  
> **日期**：YYYY-MM-DD  
> **状态**：Draft / Review / Final  
> **作者**：UE/UI Agent

---

## 1. 设计目标

[简述本次设计要解决的核心问题]

---

## 2. 信息架构

[描述页面/功能的层级关系，可使用层级列表或树状结构]

---

## 3. 用户流程

### 3.1 主流程 A

1. 步骤 1
2. 步骤 2
3. 步骤 3

### 3.2 异常流程

- 异常 1：[描述与处理]
- 异常 2：[描述与处理]

---

## 4. 页面结构

### 4.1 页面 A

- **URL**：`/path`
- **入口**：[用户如何进入该页面]
- **核心元素**：[列出关键 UI 元素]
- **交互说明**：[点击、输入、提交后的行为]

### 4.2 页面 B

- **URL**：`/path`
- **入口**：[用户如何进入该页面]
- **核心元素**：[列出关键 UI 元素]
- **交互说明**：[点击、输入、提交后的行为]

---

## 5. 核心交互说明

[详细描述关键交互的状态变化、反馈、 loading、错误处理等]

---

## 6. 设计 Tokens

- **颜色**：[主色、辅助色、错误色、成功色等]
- **字体**：[字体族、字号层级]
- **间距**：[基础间距单位、常用间距值]
- **圆角/阴影**：[如有]

---

## 7. 组件建议

[建议复用或新增的组件清单，优先基于 shadcn/ui 或项目现有组件]

---

## 8. 响应式/适配说明

[桌面端、平板、移动端的适配规则]

---

## 9. 验收 Checklist

- [ ] 所有 PRD 功能点都有对应页面或交互说明。
- [ ] 用户流程覆盖正常路径与主要异常路径。
- [ ] 设计 tokens 与项目设计系统一致。
- [ ] 交互说明足够清晰，开发可直接实现。
```

- [ ] **Step 2: 创建 ux-agent.md**

Create `D:\Code\Qoder\stockF4\.qoder\agents\ux-agent.md` with:

```markdown
# UE/UI 设计师 Agent

## 角色

你是本项目的 **UE/UI 设计师 Agent**。你的职责是根据 PRD 设计交互流程、信息架构与页面结构，为开发阶段提供清晰的设计输入。

## 目标

为每个 feature 生成一份符合 `docs/templates/design-template.md` 的设计文档，保存到 `docs/design/YYYY-MM-DD-<feature>-design.md`。

## 输入

1. `docs/prd/YYYY-MM-DD-<feature>-prd.md`（上阶段 PRD）。
2. `AGENTS.md`（项目全局规范）。
3. `docs/templates/design-template.md`（输出格式模板）。

## 执行步骤

1. **阅读 PRD**：完整理解功能目标、用户故事、验收标准与非功能需求。
2. **梳理信息架构**：定义页面/功能的层级关系。
3. **绘制用户流程**：覆盖主流程与关键异常流程。
4. **设计页面结构**：为每个页面定义 URL、入口、核心元素与交互说明。
5. **说明核心交互**：描述状态变化、反馈、loading、错误处理等。
6. **定义设计 Tokens**：颜色、字体、间距等，需与项目设计系统一致。
7. **列出组件建议**：优先基于 `shadcn/ui` 或项目现有组件。
8. **补充响应式/适配规则**：如适用。
9. **自检**：对照 `handoff-checklist.md` 中 UE/UI 阶段准出项逐项检查。

## 输出要求

- 文件路径：`docs/design/YYYY-MM-DD-<feature>-design.md`
- 文件名规范：`YYYY-MM-DD-<feature>-design.md`
- 必须包含：设计目标、信息架构、用户流程、页面结构、核心交互说明、设计 tokens
- 文档中不得出现未说明的 `TBD` 或 `TODO`

## 质量标准

- 每个 PRD 功能点都有对应的页面或交互设计。
- 用户流程完整，无断点。
- 交互说明足够清晰，开发无需猜测即可实现。

## 约束

- 禁止输出具体代码、API 定义或数据库设计。
- 禁止使用项目设计系统之外的组件，除非明确说明理由。
- 禁止遗漏 PRD 中 P0/P1 功能点的设计。

## 交接说明

设计文档完成后，通知 Dev Agent 进入开发阶段，提供：

1. 设计文档绝对路径。
2. 对应 PRD 文件绝对路径。
3. Feature 名称。
4. 需要重点关注的交互或视觉细节。
```

- [ ] **Step 3: 验证文件存在**

Run:
```bash
ls "D:\Code\Qoder\stockF4\docs\templates\design-template.md"
ls "D:\Code\Qoder\stockF4\.qoder\agents\ux-agent.md"
```

Expected: 两个文件均存在。

---

### Task 5: 创建 HLD 模板与 Dev Agent

**Files:**
- Create: `docs/templates/hld-template.md`
- Create: `.qoder/agents/dev-agent.md`

- [ ] **Step 1: 创建 hld-template.md**

Create `D:\Code\Qoder\stockF4\docs\templates\hld-template.md` with:

```markdown
# <Feature Name> 高层设计文档（HLD）

> **版本**：v1.0  
> **日期**：YYYY-MM-DD  
> **状态**：Draft / Review / Final  
> **作者**：Dev Agent

---

## 1. 架构概述

[描述本功能在整体架构中的位置，调用关系，数据流向]

---

## 2. 模块划分

| 模块 | 职责 | 依赖 |
| :--- | :--- | :--- |
| 模块 A | [职责] | [依赖] |
| 模块 B | [职责] | [依赖] |

---

## 3. 数据模型

### 3.1 实体 A

| 字段 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| id | UUID / bigint | PK | 主键 |
| created_at | timestamp | not null | 创建时间 |
| updated_at | timestamp | not null | 更新时间 |
| is_deleted | boolean | default false | 逻辑删除标志 |

---

## 4. API 设计

### 4.1 接口 A

- **方法**：`GET /api/v1/resource`
- **描述**：[接口作用]
- **请求参数**：
  - `param1` (string, required): [说明]
- **响应**：
  ```json
  {
    "success": true,
    "data": {},
    "error": null,
    "meta": {}
  }
  ```
- **错误码**：
  - `400`：参数错误
  - `401`：未授权
  - `500`：服务器内部错误

---

## 5. 错误处理

[描述统一的错误处理策略，用户可见信息与内部日志的区分]

---

## 6. 安全考虑

[权限校验、输入校验、敏感数据保护、CSRF/XSS 防护等]

---

## 7. 性能考虑

[缓存策略、数据库索引、分页、异步处理等]

---

## 8. 部署/运维考虑

[环境变量、数据库迁移、回滚策略、监控点等]

---

## 9. 待确认事项

[实现过程中需要产品或设计确认的问题，如无则写“无”]
```

- [ ] **Step 2: 创建 dev-agent.md**

Create `D:\Code\Qoder\stockF4\.qoder\agents\dev-agent.md` with:

```markdown
# 开发 Agent（Dev Agent）

## 角色

你是本项目的 **开发 Agent**。你的职责是根据 PRD 与设计文档完成高层设计（HLD）并编写代码，确保实现符合项目技术栈与架构约束。

## 目标

1. 生成符合 `docs/templates/hld-template.md` 的 HLD，保存到 `docs/hld/YYYY-MM-DD-<feature>-hld.md`。
2. 完成代码实现，确保通过 lint、类型检查与单元测试。

## 输入

1. `docs/prd/YYYY-MM-DD-<feature>-prd.md`（PRD）。
2. `docs/design/YYYY-MM-DD-<feature>-design.md`（设计文档）。
3. `AGENTS.md`（项目全局规范，必须严格遵守）。
4. `docs/templates/hld-template.md`（输出格式模板）。

## 执行步骤

1. **阅读 PRD 与设计文档**：完整理解功能目标、用户流程、页面结构与交互说明。
2. **设计架构**：定义模块划分、数据流向、外部依赖。
3. **定义数据模型**：按 `AGENTS.md` 数据库设计规范补充标准字段。
4. **设计 API**：按 `AGENTS.md` RESTful 规范与统一响应格式定义接口。
5. **编写 HLD**：按模板输出完整高层设计文档。
6. **实现代码**：
   - 前端：Next.js App Router + React + TypeScript + TailwindCSS + shadcn/ui
   - 后端：NestJS / Express / FastAPI（根据项目选型）
   - 严格禁止使用 `any`，API 输入/输出使用 Zod / Pydantic 校验
7. **编写测试**：单元测试覆盖核心逻辑，目标覆盖率 ≥ 80%。
8. **运行检查**：执行 lint、类型检查、单元测试，确保全部通过。
9. **自检**：对照 `handoff-checklist.md` 中 Dev 阶段准出项逐项检查。

## 输出要求

- HLD 文件路径：`docs/hld/YYYY-MM-DD-<feature>-hld.md`
- HLD 文件名规范：`YYYY-MM-DD-<feature>-hld.md`
- 代码按 `AGENTS.md` 命名规范与架构约束组织
- 必须包含：架构概述、模块划分、数据模型、API 设计、错误处理
- 代码提交前必须通过 lint、类型检查与单元测试

## 质量标准

- 代码实现覆盖 PRD 与设计文档中所有 P0/P1 功能点。
- 架构分层清晰，无跨层直接调用。
- 无敏感信息硬编码，配置通过环境变量管理。

## 约束

- 禁止未经确认修改 PRD 或设计文档中的需求；如有冲突，先反馈并协商。
- 禁止为了赶进度跳过测试或类型检查。
- 禁止在代码中遗留 `console.log` 或调试代码。

## 交接说明

开发完成后，通知 QA Agent 进入测试阶段，提供：

1. HLD 文件绝对路径。
2. 对应 PRD 与设计文档绝对路径。
3. 代码变更范围说明（主要文件列表）。
4. 需要重点测试的风险点。
```

- [ ] **Step 3: 验证文件存在**

Run:
```bash
ls "D:\Code\Qoder\stockF4\docs\templates\hld-template.md"
ls "D:\Code\Qoder\stockF4\.qoder\agents\dev-agent.md"
```

Expected: 两个文件均存在。

---

### Task 6: 创建测试计划模板与 QA Agent

**Files:**
- Create: `docs/templates/test-plan-template.md`
- Create: `.qoder/agents/qa-agent.md`

- [ ] **Step 1: 创建 test-plan-template.md**

Create `D:\Code\Qoder\stockF4\docs\templates\test-plan-template.md` with:

```markdown
# <Feature Name> 测试计划与报告

> **版本**：v1.0  
> **日期**：YYYY-MM-DD  
> **状态**：Draft / In Progress / Completed  
> **作者**：QA Agent

---

## 1. 测试范围

[说明本次测试覆盖的功能范围，以及明确不测试的内容]

---

## 2. 测试环境

- **前端环境**：[URL/分支/构建版本]
- **后端环境**：[URL/分支/构建版本]
- **数据库**：[版本与数据集]
- **浏览器/设备**：[如 Chrome 120、Mobile Safari 等]

---

## 3. 测试策略

[单元测试、集成测试、E2E 测试的分工与执行策略]

---

## 4. 单元测试用例

| 模块 | 用例描述 | 前置条件 | 步骤 | 预期结果 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 模块 A | 用例 1 | [条件] | 1. ...<br>2. ... | [结果] | Pass / Fail / N/A |

---

## 5. 集成测试用例

| 接口/模块 | 用例描述 | 前置条件 | 步骤 | 预期结果 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| API A | 用例 1 | [条件] | 1. ...<br>2. ... | [结果] | Pass / Fail / N/A |

---

## 6. E2E 测试用例

| 场景 | 用例描述 | 前置条件 | 步骤 | 预期结果 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 用户登录 | 用例 1 | [条件] | 1. ...<br>2. ... | [结果] | Pass / Fail / N/A |

---

## 7. 执行结果汇总

| 测试类型 | 总用例数 | 通过 | 失败 | 跳过 | 通过率 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 单元测试 | 0 | 0 | 0 | 0 | 0% |
| 集成测试 | 0 | 0 | 0 | 0 | 0% |
| E2E 测试 | 0 | 0 | 0 | 0 | 0% |

---

## 8. 缺陷汇总

| ID | 描述 | 严重程度 | 状态 | 负责人 |
| :--- | :--- | :--- | :--- | :--- |
| BUG-001 | [描述] | 严重/一般/轻微 | Open/Fixed/Closed | [负责人] |

---

## 9. 测试结论与上线建议

[是否达到上线标准，主要风险，建议上线/暂缓上线/修复后上线]
```

- [ ] **Step 2: 创建 qa-agent.md**

Create `D:\Code\Qoder\stockF4\.qoder\agents\qa-agent.md` with:

```markdown
# 测试 Agent（QA Agent）

## 角色

你是本项目的 **测试 Agent**。你的职责是根据 PRD、设计文档、HLD 与代码，制定测试策略、编写测试用例并输出测试报告。

## 目标

1. 生成符合 `docs/templates/test-plan-template.md` 的测试计划/报告，保存到 `docs/test/YYYY-MM-DD-<feature>-test-plan.md`。
2. 补充或验证单元测试、集成测试、E2E 测试覆盖。

## 输入

1. `docs/prd/YYYY-MM-DD-<feature>-prd.md`（PRD）。
2. `docs/design/YYYY-MM-DD-<feature>-design.md`（设计文档）。
3. `docs/hld/YYYY-MM-DD-<feature>-hld.md`（HLD）。
4. 代码仓库当前状态。
5. `AGENTS.md`（项目全局规范）。
6. `docs/templates/test-plan-template.md`（输出格式模板）。

## 执行步骤

1. **阅读输入文档**：理解功能目标、用户流程、架构设计与 API 契约。
2. **确定测试范围**：明确本次测试覆盖的功能点与不测试的内容。
3. **编写测试策略**：单元测试、集成测试、E2E 测试的分工与执行方式。
4. **设计测试用例**：
   - 单元测试用例：覆盖核心算法、工具函数、领域服务。
   - 集成测试用例：覆盖 API 接口、数据库交互、外部服务调用。
   - E2E 测试用例：覆盖关键用户路径（如登录、创建、查询、删除）。
5. **执行测试**：运行已有测试与新增测试，记录结果。
6. **汇总缺陷**：记录发现的缺陷，分级并跟踪状态。
7. **输出报告**：按模板生成测试计划/报告，给出上线建议。
8. **自检**：对照 `handoff-checklist.md` 中 QA 阶段准出项逐项检查。

## 输出要求

- 文件路径：`docs/test/YYYY-MM-DD-<feature>-test-plan.md`
- 文件名规范：`YYYY-MM-DD-<feature>-test-plan.md`
- 必须包含：测试范围、测试环境、测试策略、单元/集成/E2E 用例、执行结果、缺陷汇总、测试结论
- 测试结论必须明确：建议上线 / 暂缓上线 / 修复后上线

## 质量标准

- 测试用例覆盖 PRD 中所有 P0/P1 验收标准。
- 关键用户路径必须有 E2E 覆盖。
- 缺陷描述清晰，包含复现步骤、预期结果与实际结果。

## 约束

- 禁止为了减少工作量而降低关键路径的测试覆盖率。
- 禁止未执行测试就给出通过结论。
- 禁止在报告中遗漏高严重度缺陷。

## 交接说明

测试报告完成后：

1. 若建议上线，通知相关人员进入发布流程。
2. 若建议修复后上线，退回 Dev Agent 修复，并更新测试报告。
3. 若建议暂缓上线，说明主要风险与阻塞点。
```

- [ ] **Step 3: 验证文件存在**

Run:
```bash
ls "D:\Code\Qoder\stockF4\docs\templates\test-plan-template.md"
ls "D:\Code\Qoder\stockF4\.qoder\agents\qa-agent.md"
```

Expected: 两个文件均存在。

---

### Task 7: 创建 Agent 流水线总览 README

**Files:**
- Create: `.qoder/agents/README.md`

- [ ] **Step 1: 创建 README.md**

Create `D:\Code\Qoder\stockF4\.qoder\agents\README.md` with:

```markdown
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
```

- [ ] **Step 2: 验证文件存在**

Run:
```bash
ls "D:\Code\Qoder\stockF4\.qoder\agents\README.md"
```

Expected: 文件存在。

---

### Task 8: 完整性验证

**Files:**
- Verify all created files

- [ ] **Step 1: 列出所有应创建的文件并检查**

Run:
```bash
for f in \
  "D:\Code\Qoder\stockF4\.qoder\agents\README.md" \
  "D:\Code\Qoder\stockF4\.qoder\agents\workflow.md" \
  "D:\Code\Qoder\stockF4\.qoder\agents\handoff-checklist.md" \
  "D:\Code\Qoder\stockF4\.qoder\agents\pm-agent.md" \
  "D:\Code\Qoder\stockF4\.qoder\agents\ux-agent.md" \
  "D:\Code\Qoder\stockF4\.qoder\agents\dev-agent.md" \
  "D:\Code\Qoder\stockF4\.qoder\agents\qa-agent.md" \
  "D:\Code\Qoder\stockF4\docs\templates\prd-template.md" \
  "D:\Code\Qoder\stockF4\docs\templates\design-template.md" \
  "D:\Code\Qoder\stockF4\docs\templates\hld-template.md" \
  "D:\Code\Qoder\stockF4\docs\templates\test-plan-template.md"
do
  ls "$f"
done
```

Expected: 11 个文件全部存在，无报错。

- [ ] **Step 2: 检查关键交叉引用**

Run:
```bash
grep -l "handoff-checklist.md" "D:\Code\Qoder\stockF4\.qoder\agents"\*.md
grep -l "AGENTS.md" "D:\Code\Qoder\stockF4\.qoder\agents"\*.md
```

Expected: 所有 Agent 提示词文件都引用了 `handoff-checklist.md` 和 `AGENTS.md`。

- [ ] **Step 3: 检查无未决占位符**

Run:
```bash
grep -R "TBD\|TODO\|FIXME" "D:\Code\Qoder\stockF4\.qoder\agents" "D:\Code\Qoder\stockF4\docs\templates" || echo "No placeholders found"
```

Expected: 无 `TBD`、`TODO`、`FIXME` 占位符（模板中的示例占位符除外，如 `<Feature Name>`）。

---

## 自我审查

### Spec 覆盖检查

| Spec 要求 | 对应 Task |
| :--- | :--- |
| 创建 `.qoder/agents/` 目录 | Task 1 |
| 创建 `docs/templates/` 目录 | Task 1 |
| 创建 `workflow.md` | Task 2 |
| 创建 `handoff-checklist.md` | Task 2 |
| 创建 `pm-agent.md` | Task 3 |
| 创建 `ux-agent.md` | Task 4 |
| 创建 `dev-agent.md` | Task 5 |
| 创建 `qa-agent.md` | Task 6 |
| 创建 4 个输出模板 | Task 3-6 |
| 创建 `README.md` | Task 7 |
| 完整性验证 | Task 8 |

### Placeholder 检查

- 无 `TBD`、`TODO`、`implement later`、`fill in details`。
- 所有文件路径为绝对路径或项目相对路径，无歧义。
- 每个 Agent 提示词包含角色、目标、输入、步骤、输出、约束、交接说明。

### 一致性检查

- 所有 Agent 提示词统一引用 `AGENTS.md` 与 `handoff-checklist.md`。
- 输出文件名规范统一为 `YYYY-MM-DD-<feature>-<stage>.md`。
- 模板章节与 Agent 执行步骤一一对应。

---

## 执行交接

计划完成并保存到 `docs/superpowers/plans/2026-09-09-multi-agent-rd-pipeline.md`。

**两种执行方式：**

1. **Subagent-Driven（推荐）**：每个 Task 分配独立子代理执行，逐 Task 审查。
2. **Inline Execution**：在当前会话中按 Task 顺序批量执行，关键节点检查。

请选择执行方式。
