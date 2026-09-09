# 股票分析功能高层设计文档（HLD）

> **版本**：v1.0  
> **日期**：2026-09-09  
> **状态**：Draft  
> **作者**：Dev Agent

---

## 1. 架构概述

股票分析功能采用 Next.js App Router 全栈架构：

- **前端**：Next.js App Router + React + TypeScript + TailwindCSS + shadcn/ui
- **后端**：Next.js API Routes（Serverless Functions）
- **数据层**：PostgreSQL（报告与历史记录持久化）+ Redis（缓存外部金融数据）
- **外部依赖**：金融数据 API（如 Yahoo Finance / Alpha Vantage / 自选数据源）+ LLM API（用于生成分析文本）
- **AI 编排**：通过后端服务聚合结构化财务数据与文本分析请求，调用 LLM 生成报告章节

数据流向：

```
用户输入股票代码
  ↓
前端校验 → POST /api/reports
  ↓
API Route 接收请求
  ↓
股票代码解析服务（识别市场）
  ↓
外部金融数据获取服务（带 Redis 缓存）
  ↓
LLM 编排服务（按章节生成分析）
  ↓
报告组装服务 → 存入 PostgreSQL
  ↓
返回报告 ID → 前端跳转 /report/[id]
  ↓
前端通过 GET /api/reports/[id] 获取报告并渲染
```

---

## 2. 模块划分

| 模块 | 职责 | 依赖 |
| :--- | :--- | :--- |
| `app/` | Next.js 页面、布局、路由 | React, TailwindCSS, shadcn/ui |
| `components/report/` | 报告展示相关 UI 组件 | shadcn/ui, Recharts |
| `components/home/` | 首页输入、历史记录组件 | shadcn/ui |
| `lib/api/` | API 客户端与类型定义 | - |
| `lib/utils/` | 工具函数、校验、格式化 | - |
| `app/api/reports/route.ts` | 创建报告接口 | stock-service, report-service |
| `app/api/reports/[id]/route.ts` | 获取报告接口 | report-service |
| `services/stock/` | 股票代码解析、外部数据获取 | Redis, 外部金融 API |
| `services/llm/` | LLM 调用、提示词管理、章节生成 | LLM API |
| `services/report/` | 报告组装、存储、查询 | PostgreSQL |
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
| company_name | varchar(128) | - | 公司名称 |
| status | varchar(16) | not null | pending / completed / failed |
| content | JSONB | - | 报告内容（8 个章节） |
| data_sources | JSONB | - | 数据来源记录 |
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

- **方法**：`POST /api/v1/reports`
- **描述**：接收股票代码，异步生成分析报告并返回报告 ID。
- **请求参数**：
  - `ticker` (string, required): 股票代码，如 `AAPL`
- **响应**：
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "ticker": "AAPL",
      "status": "pending"
    },
    "error": null,
    "meta": {
      "timestamp": "2026-09-09T00:00:00Z",
      "requestId": "uuid"
    }
  }
  ```
- **错误码**：
  - `400`：参数错误（股票代码格式无效）
  - `401`：未授权
  - `500`：服务器内部错误

### 4.2 获取报告

- **方法**：`GET /api/v1/reports/:id`
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
      "data_sources": ["yahoo-finance"],
      "created_at": "2026-09-09T00:00:00Z"
    },
    "error": null,
    "meta": { "timestamp": "2026-09-09T00:00:00Z", "requestId": "uuid" }
  }
  ```

### 4.3 导出报告

- **方法**：`GET /api/v1/reports/:id/export?format=pdf|markdown`
- **描述**：导出报告为 PDF 或 Markdown。

---

## 5. 错误处理

- 所有 API 错误通过统一响应格式返回，`success: false`，`error` 包含 `code` 与 `message`。
- 服务端异常记录结构化日志，不向前端暴露堆栈或 SQL 信息。
- 外部 API 失败时降级：使用缓存数据或返回部分报告，并在 `data_sources` 中标注缺失数据。
- 前端使用 Error Boundary 捕获渲染错误，展示友好错误页。

---

## 6. 安全考虑

- 所有外部 API Key 通过环境变量注入，禁止硬编码。
- 股票代码输入做长度与字符白名单校验，防止注入。
- 报告分享链接使用随机 token，默认 30 天过期。
- 用户输入不直接拼接到 LLM 提示词中，使用参数化模板与转义。
- CORS 仅允许同源请求（分享链接除外，可配置允许域名）。

---

## 7. 性能考虑

- 外部金融数据缓存至 Redis，TTL 根据数据类型设置（日内数据 5 分钟，财报数据 24 小时）。
- LLM 调用可并发执行独立章节，最后组装成完整报告。
- 报告页使用 ISR / SSG 按需渲染已完成的报告，减少数据库查询压力。
- 大数据量图表使用虚拟化或分页，避免一次性渲染全部历史数据。

---

## 8. 部署/运维考虑

- 环境变量：`DATABASE_URL`, `REDIS_URL`, `LLM_API_KEY`, `FINANCIAL_DATA_API_KEY`, `NEXT_PUBLIC_APP_URL`
- 数据库迁移通过 Prisma Migrate 管理。
- 监控点：报告生成成功率、平均生成耗时、外部 API 错误率、LLM 调用延迟。
- 回滚策略：保留上一版本 Docker 镜像，数据库迁移支持 down 脚本。

---

## 9. 待确认事项

- 外部金融数据源最终选型（免费额度、覆盖市场、数据稳定性）。
- LLM 服务选型（OpenAI / Claude / 国产大模型）及成本评估。
- 是否需要用户登录系统，还是完全匿名使用。
- PDF 导出采用浏览器打印方案还是服务端生成方案。
