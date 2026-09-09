# 项目开发规范与 Agent 行为约束

> **文件用途**：定义本项目所有 Agent（PM、UI/UX、Dev、QA）及人类开发者的通用行为、代码规范与架构约束。
> **适用范围**：`D:\Code\Qoder\stockF4` 全栈产品研发项目。
> **优先级**：当本文件与 Agent 默认行为冲突时，以本文件为准。

---

## 1. 通用原则 (Core Principles)

1. **模块化与低耦合**
   - 前后端解耦，模块间通过定义良好的接口通信。
   - 严禁跨层直接调用（如 Controller 直接访问 Repository，UI 直接调用数据库）。

2. **配置与代码分离**
   - 所有敏感数据（API Key、数据库密码、Token、私钥等）严禁硬编码。
   - 统一通过环境变量（`.env`）或密钥管理服务注入，`.env*` 文件必须加入 `.gitignore`。

3. **自动化优先**
   - 所有核心逻辑与 API 接口必须包含单元测试与集成测试。
   - 测试覆盖率目标：核心 API/业务逻辑 ≥ 80%。

4. **文档即代码**
   - 代码变更必须同步更新相关接口文档、数据库 Schema、架构说明及 API 文档。
   - 新增模块需同时补充 README 或架构说明片段。

5. **最小可行变更 (MVC)**
   - 每次变更只解决一个明确问题，避免大范围重构与无关改动混在同一个 PR/提交中。

---

## 2. 标准技术栈规范 (Tech Stack)

| 层级 | 选用技术 / 工具 | 规范要求 |
| :--- | :--- | :--- |
| **前端框架** | Next.js / React (TypeScript) | 使用 App Router 架构；优先选用 TailwindCSS + shadcn/ui；禁止在服务端组件中直接调用浏览器 API。 |
| **后端框架** | Node.js (NestJS / Express) 或 Python (FastAPI) | 强类型/声明式校验；所有 API 端点必须提供 OpenAPI/Swagger 定义。 |
| **数据库** | PostgreSQL + ORM (Prisma / SQLAlchemy) | 数据表需包含 `created_at`、`updated_at`、`is_deleted` 标准字段；删除默认使用逻辑删除。 |
| **缓存/消息** | Redis / RabbitMQ / Kafka（按场景选用） | 缓存需设置过期时间；消息消费需保证幂等性。 |
| **测试框架** | Jest / Vitest（单元测试）、Playwright（E2E） | 核心 API/逻辑覆盖率 ≥ 80%；E2E 覆盖关键用户路径。 |
| **代码质量** | ESLint、Prettier、TypeScript Strict / ruff、mypy | 提交前必须通过 lint 与类型检查。 |

---

## 3. 代码风格规范 (Coding Standards)

### 3.1 命名规范

- **文件与目录**：小写 kebab-case，例如 `user-profile.controller.ts`、`api-client.ts`。
- **变量与函数**：camelCase，例如 `getUserById`、`handleSubmit`。
- **类与接口**：PascalCase，例如 `UserService`、`UserProfileResponse`。
- **常量与环境变量**：UPPER_SNAKE_CASE，例如 `MAX_RETRY_COUNT`、`DATABASE_URL`。
- **数据库表/字段**：snake_case，例如 `user_profiles`、`created_at`。
- **React 组件**：PascalCase 文件名 + 组件名一致，例如 `UserCard.tsx` 导出 `UserCard`。

### 3.2 类型与校验

- TypeScript 全栈代码严格禁止使用 `any`。
- 必须提供显式类型定义；无法推断时使用 `unknown` 并做类型收窄。
- API 输入/输出必须经过 Schema 校验：TypeScript 搭配 Zod，Python 搭配 Pydantic。
- 禁止使用非空断言（`!`）绕过类型检查，除非有明确的守卫注释。

### 3.3 格式与结构

- 使用项目统一的 Prettier / ESLint 配置，提交前自动格式化。
- 单函数职责单一，圈复杂度过高（>10）必须拆分。
- 避免嵌套过深（>3 层），优先使用提前返回（guard clauses）。
- 日志输出使用结构化日志，严禁使用 `console.log` 提交到主分支。

---

## 4. 架构约束 (Architecture Constraints)

### 4.1 分层架构

```
客户端 (Next.js App Router / React)
    ↓ HTTP / REST / GraphQL
API 网关 / BFF
    ↓
应用层 (Controller / Router / Service)
    ↓
领域层 (Domain Service / Entity / DTO)
    ↓
基础设施层 (Repository / ORM / Cache / Message Queue / External API)
```

- **应用层**：负责请求接入、参数校验、权限检查、调用领域层。
- **领域层**：承载核心业务逻辑，不依赖框架与基础设施。
- **基础设施层**：负责数据持久化、外部调用、消息发送等，通过接口/依赖注入供领域层使用。

### 4.2 依赖规则

- 上层可以依赖下层，下层禁止反向依赖上层。
- 同层模块间通过明确的公共接口通信，禁止直接访问内部实现。
- 所有外部依赖（数据库、缓存、第三方 API）必须抽象为接口，便于测试与替换。

### 4.3 数据流约束

- 前端状态管理优先使用服务端状态（Server State）与 URL 状态，避免过度使用全局客户端状态。
- 服务端 API 必须是无状态的；会话信息通过 Token/JWT 传递。
- 异步操作统一使用 `async/await`，禁止使用回调地狱。

### 4.4 错误处理

- 所有异常必须通过统一的错误中间件/边界处理，转换为标准响应格式。
- 禁止在业务代码中吞掉异常；需要捕获时记录上下文并重新抛出明确错误。
- 用户可见错误信息必须脱敏，不得暴露堆栈、SQL、内部路径等敏感信息。

---

## 5. 接口与数据交互规范 (API & Data Rules)

### 5.1 RESTful 命名风格

| 方法 | 路径 | 含义 |
| :--- | :--- | :--- |
| GET | `/api/v1/users` | 获取用户列表 |
| POST | `/api/v1/users` | 创建用户 |
| GET | `/api/v1/users/:id` | 获取用户详情 |
| PUT / PATCH | `/api/v1/users/:id` | 全量/部分更新用户 |
| DELETE | `/api/v1/users/:id` | 删除用户（逻辑删除） |

### 5.2 统一 HTTP 响应格式

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "timestamp": "2026-09-09T00:00:00Z",
    "requestId": "uuid"
  }
}
```

- 失败时 `success: false`，`error` 包含 `code` 与 `message`。
- 列表接口 `meta` 包含分页信息：`page`、`pageSize`、`total`、`totalPages`。

### 5.3 数据库设计

- 所有表必须包含：`id`（UUID 或自增主键）、`created_at`、`updated_at`、`is_deleted`。
- 外键必须建立索引；软删除表查询默认过滤 `is_deleted = false`。
- 复杂查询优先使用数据库视图/物化视图或 ORM 查询构建器，避免手写裸 SQL（性能场景除外，需评审）。

---

## 6. 测试规范 (Testing Standards)

- **单元测试**：覆盖纯函数、领域服务、工具函数；mock 外部依赖。
- **集成测试**：覆盖 Repository、Service、API 端到端流程；使用测试数据库或事务回滚。
- **E2E 测试**：覆盖关键用户路径（登录、创建、查询、删除）。
- 测试命名需说明被测行为：`should return 401 when token is invalid`。
- 禁止为了覆盖率而写无意义的测试。

---

## 7. 安全规范 (Security)

- 所有用户输入必须校验与转义，防止 XSS、SQL 注入、命令注入。
- 认证使用 JWT/Session，敏感 Cookie 设置 `HttpOnly`、`Secure`、`SameSite`。
- 接口必须基于最小权限原则进行授权校验。
- 依赖包定期扫描漏洞（`npm audit`、`pip-audit`），高危漏洞必须修复。
- 禁止在日志、错误信息、前端代码中输出密钥、密码、Token。

---

## 8. 文档与 Git 规范

### 8.1 文档

- 每个模块包含 README，说明职责、依赖、启动方式、测试命令。
- API 变更必须同步更新 Swagger/OpenAPI 文档。
- 架构决策使用 `docs/adr/YYYY-MM-DD-title.md` 记录。

### 8.2 Git 提交

- 使用语义化提交消息：
  - `feat:` 新功能
  - `fix:` 修复
  - `docs:` 文档
  - `style:` 格式（不影响代码逻辑）
  - `refactor:` 重构
  - `test:` 测试
  - `chore:` 构建/工具
- 提交信息格式：`<type>(<scope>): <subject>`，例如 `feat(user): add login endpoint`。
- 单次提交只包含一个逻辑变更，禁止混合不相关改动。

---

## 9. 各 Agent 职责与行为约束

| Agent 类型 | 主要职责 | 行为约束 |
| :--- | :--- | :--- |
| **PM** | 需求拆解、优先级排序、PRD 输出 | 不直接修改代码；需求必须包含验收标准。 |
| **UI/UX** | 设计系统、交互原型、视觉规范 | 输出需符合设计 tokens；优先使用 shadcn/ui 组件。 |
| **Dev** | 编码、测试、文档、代码评审 | 必须遵循本文件所有规范；完成前跑通 lint/test/build。 |
| **QA** | 测试用例、自动化测试、验收 | 核心路径必须有自动化覆盖；缺陷需附带复现步骤。 |

---

## 10. 禁止事项 (Hard No)

- 禁止在代码中硬编码密钥、密码、Token。
- 禁止使用 `any`、裸 SQL（性能场景除外）、`console.log` 提交。
- 禁止跨层直接调用、循环依赖、直接修改生产数据库。
- 禁止未经验证就对外发布、推送或合并代码。
- 禁止在未经用户确认的情况下执行删除、重置、强制推送等破坏性操作。

---

## 11. 生效与更新

- 本文件自创建之日起生效，所有 Agent 与人类开发者须遵守。
- 当技术栈、架构或流程发生重大变化时，需同步更新本文件，并通过团队评审。
