# 股票分析功能高层设计文档（HLD）

> **版本**：v1.1<br>
> **日期**：2026-09-10<br>
> **状态**：Implemented<br>
> **作者**：Dev Agent

---

## 1. 架构概述

股票分析功能采用 Next.js App Router 全栈架构：

- **前端**：Next.js App Router + React + TypeScript + TailwindCSS + shadcn/ui。
- **后端**：Next.js API Routes（Node.js runtime）。
- **数据层**：PostgreSQL（报告与历史记录持久化）；Redis 连接配置已预留，本版本未启用缓存。
- **金融数据**：美股基本面使用 Alpha Vantage；A 股基本面使用 Tushare；腾讯 `qt.gtimg.cn` 仅作为非阻塞实时行情补充；港股保留代码识别，基本面暂不支持。
- **AI 编排**：服务端把结构化公司资料与财务指标传给阿里云百炼 DashScope 的 OpenAI 兼容 Chat Completions 接口，由默认模型 `qwen-plus` 生成八章节报告 JSON，并以 Zod 严格校验后持久化。

数据流向：

```
用户输入股票代码
  ↓
前端校验 → POST /api/reports
  ↓
API Route 校验并解析市场
  ↓
创建 pending 报告
  ↓
并发请求 Alpha Vantage（美股）或 Tushare（A 股）基本面与腾讯报价
  ↓
基本面完成时仅采纳已返回的腾讯报价；慢行情或失败时降级为 null
  ↓
DashScope 生成并返回八章节 JSON
  ↓
Zod 严格校验 → 更新 completed 报告并写入数据来源
  ↓
返回报告 ID → 前端跳转 /report/[id]
  ↓
前端通过 GET /api/reports/[id] 获取报告并渲染
```

若在创建报告后发生外部服务错误，API 会将该报告标记为 `failed`，再返回受控错误码。

---

## 2. 模块划分

| 模块 | 职责 | 依赖 |
| :--- | :--- | :--- |
| `app/` | Next.js 页面、布局、路由 | React, TailwindCSS, shadcn/ui |
| `components/report/` | 报告展示相关 UI 组件 | shadcn/ui, Recharts |
| `components/home/` | 首页输入、历史记录组件 | shadcn/ui |
| `lib/api/` | API 客户端与类型定义 | - |
| `lib/utils/` | 工具函数、校验、格式化 | - |
| `app/api/reports/route.ts` | 创建报告、失败状态编排与受控错误响应 | stock, LLM, report services |
| `app/api/reports/[id]/route.ts` | 获取报告接口 | report service |
| `services/stock/parse-ticker.ts` | 股票代码与市场解析 | - |
| `services/stock/financial-data.ts` | Alpha Vantage、Tushare 和腾讯报价适配 | 原生 `fetch`、外部金融 API |
| `services/llm/report-generator.ts` | DashScope 调用、八章节 JSON 校验 | Zod、DashScope OpenAI-compatible API |
| `services/external-service-error.ts` | 外部服务错误码及 HTTP 状态映射 | - |
| `services/report/` | 报告组装、状态更新、存储、查询 | PostgreSQL |
| `prisma/` | 数据库 Schema 与 ORM | PostgreSQL |
| `types/` | 全局 TypeScript 类型 | - |

---

## 3. 数据模型

### 3.1 Report（分析报告）

| 字段 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK | 主键 |
| ticker | varchar(32) | not null, index | 股票代码 |
| market | varchar(16) | not null | 市场（US/HK/CN） |
| company_name | varchar(128) | - | 外部数据源返回的公司名称 |
| status | varchar(16) | not null | `pending` / `completed` / `failed` |
| content | JSONB | - | 经 Zod 校验的八章节报告内容 |
| data_sources | JSONB | - | 实际参与生成的供应商标识 |
| share_token | varchar(64) | unique | 分享令牌 |
| created_at | timestamp | not null | 创建时间 |
| updated_at | timestamp | not null | 更新时间 |
| is_deleted | boolean | default false | 逻辑删除标志 |

### 3.2 AnalysisHistory（用户分析历史）

| 字段 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| id | UUID | PK | 主键 |
| report_id | UUID | FK → Report | 关联报告 |
| user_id | varchar(64) | index | 用户标识（匿名或登录） |
| created_at | timestamp | not null | 创建时间 |
| updated_at | timestamp | not null | 更新时间 |
| is_deleted | boolean | default false | 逻辑删除标志 |

---

## 4. API 设计

### 4.1 创建报告

- **方法**：`POST /api/reports`
- **描述**：接收股票代码，同步获取基本面、生成报告并持久化后返回报告 ID。
- **请求参数**：
  - `ticker` (string, required)：股票代码，例如 `AAPL`、`600519` 或 `00700.HK`。
- **成功响应**：
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "ticker": "AAPL",
      "status": "completed"
    },
    "error": null,
    "meta": {
      "timestamp": "2026-09-10T00:00:00Z",
      "requestId": "uuid"
    }
  }
  ```
- **受控错误码**：
  - `INVALID_TICKER`、`UNKNOWN_MARKET`：HTTP 400。
  - `MARKET_NOT_SUPPORTED`、`DATA_NOT_AVAILABLE`：HTTP 422。
  - `DATA_PROVIDER_NOT_CONFIGURED`、`DATA_PROVIDER_UNAVAILABLE`、`LLM_NOT_CONFIGURED`、`LLM_UNAVAILABLE`：HTTP 503。
  - `LLM_INVALID_RESPONSE`：HTTP 502。
  - 其他未预期错误：`INTERNAL_ERROR`，HTTP 500。

### 4.2 获取报告

- **方法**：`GET /api/reports/:id`
- **描述**：根据报告 ID 获取完整报告内容。
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "ticker": "AAPL",
      "market": "US",
      "company_name": "Apple Inc.",
      "status": "completed",
      "content": { "business_model": "...", "financial_analysis": "..." },
      "data_sources": ["alpha-vantage:fundamentals"],
      "created_at": "2026-09-10T00:00:00Z"
    },
    "error": null,
    "meta": { "timestamp": "2026-09-10T00:00:00Z", "requestId": "uuid" }
  }
  ```

### 4.3 导出报告

- **方法**：`GET /api/reports/:id/export?format=pdf|markdown`
- **描述**：导出报告为 PDF 或 Markdown（P1，尚未实现）。

---

## 5. 外部服务与错误处理

- Alpha Vantage 并行查询 `OVERVIEW`、`INCOME_STATEMENT`、`CASH_FLOW` 与 `BALANCE_SHEET`，仅使用年报数据计算趋势指标。
- Tushare 并行查询股票资料、三张报表、财务指标和日度估值；仅使用年度 `end_date` 数据计算财务趋势，ROE 从供应商百分比转换为比率。
- 腾讯报价与基本面并发请求，最大超时 3 秒；仅采纳基本面完成时已返回的报价，慢行情、请求或解析失败均降级为 `null`，不阻塞报告生成。
- Alpha Vantage 与 Tushare 请求最大超时 10 秒；供应商非成功响应、限流提示、结构不合法或网络异常统一映射为受控数据服务错误。
- DashScope 请求最大超时 30 秒，并要求 `response_format: { "type": "json_object" }`；网络、非 2xx 或外层响应不可读映射为 `LLM_UNAVAILABLE`，章节 JSON 缺键、额外键、空白或超长内容映射为 `LLM_INVALID_RESPONSE`。
- 港股 `HK` 的基本面请求返回 `MARKET_NOT_SUPPORTED`；不会调用金融数据供应商。
- 所有 API 错误使用统一响应格式返回，不向前端暴露堆栈、SQL 或密钥。

---

## 6. 安全考虑

- `TUSHARE_TOKEN`、`ALPHA_VANTAGE_API_KEY`、`DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL` 与可选 `DASHSCOPE_MODEL` 均通过环境变量注入，禁止硬编码。
- 股票代码在 API 层经长度和字符白名单校验，防止注入。
- LLM 系统提示仅允许使用结构化财务输入，明确禁止编造事实、数值和来源；模型输出必须通过严格 Zod schema 验证后才能写入数据库。
- 报告分享链接使用随机 token，默认 30 天过期。
- CORS 仅允许同源请求；分享链接的允许域名可配置。

---

## 7. 性能考虑

- Alpha Vantage 的四个基本面请求及 Tushare 的六个数据请求分别并行执行，以缩短报告生成等待时间。
- 腾讯报价与基本面请求并发执行；基本面完成时不等待未结算行情，避免实时行情延长报告生成关键路径。
- Redis 配置已预留但本版本未启用；后续接入缓存时需为每类数据明确 TTL 和失效策略。
- 报告页可按需采用 ISR / SSG 渲染已完成报告，减少数据库查询压力。
- 大数据量图表使用虚拟化或分页，避免一次性渲染全部历史数据。

---

## 8. 部署/运维考虑

- 环境变量：`DATABASE_URL`、`REDIS_URL`、`TUSHARE_TOKEN`、`ALPHA_VANTAGE_API_KEY`、`DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL`、`DASHSCOPE_MODEL`、`NEXT_PUBLIC_APP_URL`。
- 数据库迁移通过 Prisma Migrate 管理。
- 监控点：报告生成成功率、报告生成耗时、各金融数据供应商错误率、DashScope 调用延迟与 `LLM_INVALID_RESPONSE` 发生率。
- 回滚策略：保留上一版本 Docker 镜像，数据库迁移支持 down 脚本。

---

## 9. 待确认事项

- 港股基本面数据供应商的选择、免费额度与数据稳定性。
- 报告生成是否改为异步队列，以降低同步 API 的等待时间。
