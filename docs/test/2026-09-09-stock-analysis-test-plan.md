# 股票分析功能测试计划与报告

> **版本**：v1.0  
> **日期**：2026-09-09  
> **状态**：Completed  
> **作者**：QA Agent

---

## 1. 测试范围

### 1.1 覆盖范围

- 股票代码输入与格式校验
- 市场识别逻辑（US / HK / CN）
- 报告创建 API（POST /api/reports）
- 报告获取 API（GET /api/reports/:id）
- 首页 UI 交互（输入、提交、错误提示）
- 报告页渲染与章节导航
- 单元测试覆盖的核心工具函数

### 1.2 不测试范围

- 真实外部金融数据 API 的稳定性与数据准确性（依赖 mock/stub）。
- LLM 生成文本的质量评估（由产品/业务人工抽检）。
- PDF / Markdown 导出功能（P1，后续迭代补充）。
- 历史记录管理（P1，后续迭代补充）。
- 性能压测与并发测试（本版本不做）。

---

## 2. 测试环境

- **前端环境**：Next.js 14.2.0，本地开发服务器 http://localhost:3000
- **后端环境**：Next.js API Routes（Node.js runtime）
- **数据库**：PostgreSQL 15（通过 Prisma ORM 连接）
- **缓存**：Redis 7（可选，本版本未深度使用）
- **浏览器**：Chrome 120+
- **测试框架**：Jest 29 + ts-jest

---

## 3. 测试策略

- **单元测试**：覆盖 `validateTicker`、`parseTicker` 等纯函数与工具函数，mock 外部依赖。
- **集成测试**：通过直接调用 service 函数验证报告创建与查询流程，使用内存/测试数据库隔离数据。
- **E2E 测试**：本版本暂以手动验证为主，关键路径（首页输入 → 报告页渲染）通过浏览器手动执行。
- **静态检查**：运行 TypeScript 类型检查与 ESLint，确保代码质量。

---

## 4. 静态检查结果

| 检查项 | 命令 | 结果 |
| :--- | :--- | :--- |
| TypeScript 类型检查 | `npm run type-check` | 通过 |
| ESLint | `npm run lint` | 通过 |

---

## 5. 单元测试用例

| 模块 | 用例描述 | 前置条件 | 步骤 | 预期结果 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| validation | 校验合法美股代码 | 无 | 1. 输入 "AAPL"<br>2. 调用 validateTicker | 返回 success=true，ticker="AAPL" | Pass |
| validation | 校验合法港股代码 | 无 | 1. 输入 "00700.HK"<br>2. 调用 validateTicker | 返回 success=true，ticker 转为大写 | Pass |
| validation | 校验空字符串 | 无 | 1. 输入 ""<br>2. 调用 validateTicker | 返回 success=false，提示不能为空 | Pass |
| validation | 校验非法字符 | 无 | 1. 输入 "AAPL<script>"<br>2. 调用 validateTicker | 返回 success=false，提示非法字符 | Pass |
| parseTicker | 识别美股 | 无 | 1. 输入 "AAPL" | 返回 market="US" | Pass |
| parseTicker | 识别港股（含后缀） | 无 | 1. 输入 "00700.HK" | 返回 market="HK"，ticker="00700" | Pass |
| parseTicker | 识别 A 股 | 无 | 1. 输入 "600519" | 返回 market="CN" | Pass |
| parseTicker | 未知代码 | 无 | 1. 输入 "@@@" | 返回 market="UNKNOWN" | Pass |

---

## 6. 集成测试用例

| 接口/模块 | 用例描述 | 前置条件 | 步骤 | 预期结果 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| POST /api/reports | 创建有效报告 | 数据库可连接 | 1. POST ticker=AAPL | 返回 201，data 包含 id 与 status=completed | N/A |
| POST /api/reports | 无效代码 | 无 | 1. POST ticker="" | 返回 400，error.code=INVALID_TICKER | N/A |
| POST /api/reports | 无法识别市场 | 无 | 1. POST ticker="@@@" | 返回 400，error.code=UNKNOWN_MARKET | N/A |
| GET /api/reports/:id | 获取存在报告 | 已创建报告 | 1. GET 报告 ID | 返回 200，data 包含完整报告内容 | N/A |
| GET /api/reports/:id | 获取不存在报告 | 无 | 1. GET 随机 UUID | 返回 404，error.code=REPORT_NOT_FOUND | N/A |
| report-service | 创建并查询报告 | 数据库可连接 | 1. createReport<br>2. getReportById | 查询结果与创建数据一致 | N/A |

---

## 7. E2E 测试用例

| 场景 | 用例描述 | 前置条件 | 步骤 | 预期结果 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 用户分析股票 | 首页输入股票代码并生成报告 | 服务已启动 | 1. 访问首页<br>2. 输入 AAPL<br>3. 点击分析 | 跳转至报告页，展示 8 个章节 | N/A |
| 错误提示 | 输入非法代码 | 服务已启动 | 1. 输入空或非法字符<br>2. 点击分析 | 页面显示错误提示，不跳转 | N/A |
| 章节导航 | 报告页导航跳转 | 报告页已加载 | 1. 点击左侧章节链接 | 平滑滚动至对应章节 | N/A |

---

## 8. 执行结果汇总

| 测试类型 | 总用例数 | 通过 | 失败 | 跳过 | 通过率 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 单元测试 | 8 | 8 | 0 | 0 | 100% |
| 集成测试 | 6 | 0 | 0 | 6 | 0% |
| E2E 测试 | 3 | 0 | 0 | 3 | 0% |

> 注：集成测试与 E2E 测试需要数据库与服务启动，本版本因环境未完全就绪暂跳过，计划在环境就绪后补充执行。

---

## 9. 缺陷汇总

| ID | 描述 | 严重程度 | 状态 | 负责人 |
| :--- | :--- | :--- | :--- | :--- |
| BUG-001 | API 路由中临时使用 crypto.randomUUID，需确认运行环境兼容性 | 轻微 | Open | Dev Agent |
| BUG-002 | LLM 与外部金融数据服务当前为 mock 实现，需接入真实 API | 严重 | Open | Dev Agent |
| BUG-003 | 报告创建 API 同步等待 LLM 生成，后续应改为异步队列 | 一般 | Open | Dev Agent |

---

## 10. 测试结论与上线建议

**结论**：本版本完成了股票分析功能的基础骨架，包括 PRD、设计文档、HLD、核心页面、API 路由、服务层与单元测试。单元测试全部通过，但集成测试与 E2E 测试因数据库/外部服务环境未就绪尚未执行，且 LLM 与金融数据服务仍为 mock 实现。

**建议**：暂缓上线。待完成以下事项后再进入发布流程：

1. 接入真实金融数据 API 与 LLM 服务。
2. 完成数据库迁移并执行集成测试。
3. 启动完整服务并执行 E2E 手动/自动化验证。
4. 修复 BUG-002（mock 服务替换）与 BUG-003（异步化报告生成）。
