# StockF4 — 华尔街式股票分析报告系统

基于 Next.js 14 全栈 TypeScript 构建的智能股票分析平台。用户输入股票代码后，系统自动获取真实财务数据，通过大语言模型（Qwen）生成包含 8 大维度的专业级分析报告。

## 项目说明

### 核心功能

用户在首页输入股票代码（如 `AAPL`、`00700.HK`、`600519`），系统自动完成以下流程：

1. **代码解析** — 识别股票所属市场（美股 / 港股 / A 股）
2. **数据获取** — 调用第三方数据源拉取公司基本面财务数据
3. **AI 报告生成** — 将结构化财务数据交给 Qwen LLM，生成 8 章节中文分析报告
4. **报告持久化** — 报告存入 PostgreSQL，可通过链接随时回看
5. **页面渲染** — 带侧边栏导航的排版化报告页面

### 支持的市场与数据源

| 市场 | 代码格式 | 数据源 | 实时报价 |
| :--- | :--- | :--- | :--- |
| 美股 (US) | 1–5 位字母，如 `AAPL` | 东方财富（`105.AAPL`） | 东方财富 |
| A 股 (CN) | 6 位数字，如 `600519` / `600519.SH` | 东方财富（`1.600519`） | 东方财富 |
| 港股 (HK) | 4–5 位数字，如 `00700.HK` | 东方财富（`116.00700`） | 东方财富 |

### 报告章节

每份报告包含以下 8 个分析维度：

| 序号 | 章节 | 说明 |
| :--: | :--- | :--- |
| 1 | 商业模式与收入来源 | 盈利模式、收入结构、竞争壁垒、行业趋势 |
| 2 | 详细财务分析 | 营收增长、净利润趋势、自由现金流、利润率、债务水平、ROE |
| 3 | 竞争优势分析（护城河） | 品牌、网络效应、转换成本、成本优势，1–10 分评分 |
| 4 | 股票估值（投行风格） | P/E 对比、DCF 估算、行业均值，给出高估/低估结论 |
| 5 | 风险分析 | 经济、行业颠覆、竞争、监管、债务风险，按危险度排序 |
| 6 | 增长潜力分析 | 市场规模、行业增速、扩张机会、新技术/AI 优势 |
| 7 | 机构投资者视角 | 模拟对冲基金经理视角，买入/规避理由与投资逻辑 |
| 8 | 多空辩论 | 多空双方数据驱动的辩论，以均衡结论收尾 |

### 技术栈

| 层级 | 技术 | 版本 |
| :--- | :--- | :--- |
| 前端框架 | Next.js (App Router) + React | 14.2 / 18.2 |
| 编程语言 | TypeScript (Strict) | 5.3 |
| 样式方案 | TailwindCSS | 3.4 |
| UI 组件 | lucide-react、Recharts | — |
| 后端框架 | Next.js API Routes (Node.js) | — |
| 数据库 | PostgreSQL + Prisma ORM | 5.12 |
| 缓存 | Redis / ioredis（预留，当前未启用） | 5.3 |
| LLM 服务 | 阿里云 DashScope（Qwen，OpenAI 兼容接口） | — |
| 财务数据 | 东方财富（美股/A股/港股） | — |
| 校验库 | Zod | 3.22 |
| 测试框架 | Jest + ts-jest | 29.7 |
| 代码质量 | ESLint + Prettier | — |

---

## 系统架构

### 分层架构

```
┌──────────────────────────────────────────────────────────┐
│                    客户端 (Next.js App Router)             │
│  ┌────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  首页 (/)   │  │ 报告页 (/report) │  │  组件库         │  │
│  │  代码输入    │  │  侧边栏导航      │  │  (Ticker/Input) │  │
│  └────────────┘  └────────────────┘  └────────────────┘  │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP / REST
┌────────────────────────┴─────────────────────────────────┐
│                    API 层 (Next.js Route Handlers)        │
│  ┌──────────────────────┐  ┌───────────────────────────┐ │
│  │ POST /api/reports    │  │ GET /api/reports/:id      │ │
│  │ 创建并生成报告         │  │ 查询报告详情               │ │
│  └──────────┬───────────┘  └─────────────┬─────────────┘ │
└─────────────┼────────────────────────────┼──────────────┘
              │                             │
┌─────────────┴─────────────────────────────┴──────────────┐
│                    领域服务层 (services/)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ ReportService│  │FinancialData │  │ReportGenerator │ │
│  │ 报告 CRUD     │  │ 财务数据获取   │  │ LLM 报告生成    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘ │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
┌─────────┴─────────────────┴──────────────────┴──────────┐
│                    基础设施层                             │
│  ┌──────────┐  ┌──────────────────────┐  ┌────────────┐ │
│  │PostgreSQL│  │   东方财富 API        │  │ DashScope  │ │
│  │ (Prisma) │  │   (美股/A股/港股)      │  │  (Qwen)    │ │
│  └──────────┘  └──────────────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 目录结构

```
stockF4/
├── app/                          # Next.js App Router
│   ├── api/reports/              # API 路由
│   │   ├── route.ts              #   POST /api/reports — 创建报告
│   │   └── [id]/route.ts         #   GET /api/reports/:id — 查询报告
│   ├── report/[id]/page.tsx     # 报告查看页（服务端组件）
│   ├── layout.tsx               # 根布局
│   └── page.tsx                 # 首页（代码输入）
├── components/                    # React 组件
│   ├── home/stock-ticker-input.tsx
│   └── report/
│       ├── report-nav.tsx        # 侧边栏导航
│       └── report-section.tsx   # 报告章节卡片
├── services/                     # 领域服务
│   ├── stock/
│   │   ├── parse-ticker.ts      # 股票代码解析（US/HK/CN）
│   │   └── financial-data.ts    # 财务数据获取（多数据源）
│   ├── llm/
│   │   └── report-generator.ts  # Qwen LLM 调用与响应校验
│   ├── report/
│   │   └── report-service.ts    # 报告 CRUD（Prisma）
│   └── external-service-error.ts # 统一错误码与 HTTP 映射
├── lib/utils/                    # 工具函数
│   ├── cn.ts                    # className 合并
│   └── validation.ts            # Zod 输入校验
├── types/
│   └── report.ts                # 核心领域类型定义
├── prisma/
│   └── schema.prisma            # 数据库模型（Report + AnalysisHistory）
├── tests/                        # Jest 测试套件
├── docs/                         # 项目文档（PRD/HLD/Design/Test）
└── .qoder/                       # 多 Agent 研发流水线配置
```

### 数据模型

```
Report (reports)
├── id            UUID 主键
├── ticker        股票代码
├── market        市场 (US/HK/CN)
├── companyName   公司名
├── status        状态 (pending/completed/failed)
├── content       8 章节报告 JSON
├── dataSources   数据源标识列表
├── shareToken    分享令牌（预留）
├── created_at    创建时间
├── updated_at    更新时间
└── is_deleted    逻辑删除标记

AnalysisHistory (analysis_history)
├── id            UUID 主键
├── report_id     外键 → reports.id
├── user_id       用户 ID
├── created_at    创建时间
├── updated_at    更新时间
└── is_deleted    逻辑删除标记
```

### API 接口

#### POST `/api/reports` — 创建并生成报告

**请求体：**
```json
{ "ticker": "AAPL" }
```

**成功响应 (201)：**
```json
{
  "success": true,
  "data": { "id": "uuid", "ticker": "AAPL", "status": "completed" },
  "error": null,
  "meta": { "timestamp": "...", "requestId": "uuid" }
}
```

**错误码：**

| 错误码 | HTTP 状态 | 说明 |
| :--- | :---: | :--- |
| `INVALID_TICKER` | 400 | 股票代码格式无效 |
| `UNKNOWN_MARKET` | 400 | 无法识别股票所属市场 |
| `MARKET_NOT_SUPPORTED` | 422 | 该市场暂不支持（如港股） |
| `DATA_NOT_AVAILABLE` | 422 | 未获取到财务数据 |
| `DATA_PROVIDER_NOT_CONFIGURED` | 503 | 数据源 API Key 未配置 |
| `DATA_PROVIDER_UNAVAILABLE` | 503 | 数据源服务不可用 |
| `LLM_NOT_CONFIGURED` | 503 | LLM API Key 未配置 |
| `LLM_UNAVAILABLE` | 503 | LLM 服务不可用 |
| `LLM_INVALID_RESPONSE` | 502 | LLM 返回内容格式不合规 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

#### GET `/api/reports/:id` — 查询报告详情

返回完整报告内容，含 8 个章节的文本、公司名、市场、数据来源及时间戳。报告不存在或已删除时返回 404。

### 核心流程

```
用户输入 ticker
    │
    ▼
Zod 校验格式 ──(失败)──▶ 400 INVALID_TICKER
    │
    ▼
解析市场 (US/HK/CN) ──(未知)──▶ 400 UNKNOWN_MARKET
    │
    ▼
创建 pending 报告 (DB)
    │
    ▼
获取财务数据 ──(失败)──▶ 标记 failed → 返回对应错误码
    │  └─ 东方财富 (公司概况 + 财务报表 + 实时报价)
    │
    ▼
调用 Qwen LLM 生成报告 ──(失败)──▶ 标记 failed → 返回 LLM 错误码
    │  └─ 严格系统提示词 + JSON 模式 + Zod 校验
    │
    ▼
更新报告为 completed (DB)
    │
    ▼
返回 201 + 报告 ID → 跳转报告页
```

---

## 安装部署

### 环境要求

| 依赖 | 最低版本 |
| :--- | :--- |
| Node.js | 18.17+（推荐 20+） |
| PostgreSQL | 14+ |
| npm | 9+ |

### 1. 克隆项目

```bash
git clone <repository-url>
cd stockF4
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制环境变量模板并填入实际值：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/stock_analysis

# 缓存（预留，当前未启用）
REDIS_URL=redis://localhost:6379

# 阿里云 DashScope（Qwen LLM，OpenAI 兼容接口）
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

# 应用
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **注意：** 财务数据使用东方财富公开接口，无需 API Key。所有密钥请通过 `.env` 文件注入，严禁硬编码到源码中。`.env` 已在 `.gitignore` 中忽略。

### 4. 初始化数据库

确保 PostgreSQL 已运行并创建目标数据库：

```sql
CREATE DATABASE stock_analysis;
```

生成 Prisma Client 并执行数据库迁移：

```bash
npm run db:generate    # 生成 Prisma Client
npm run db:migrate     # 创建数据库表结构
```

### 5. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动。

### 6. 生产构建

```bash
npm run build     # 构建生产包
npm run start     # 启动生产服务器（默认端口 3000）
```

### 可用脚本一览

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产包 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run type-check` | TypeScript 类型检查 |
| `npm test` | 运行 Jest 测试 |
| `npm run test:watch` | 测试监听模式 |
| `npm run db:migrate` | 执行 Prisma 数据库迁移 |
| `npm run db:generate` | 生成 Prisma Client |

---

## 测试

项目包含 5 个测试套件，覆盖核心业务逻辑：

```
tests/
├── validation.test.ts          # 输入校验
├── parse-ticker.test.ts        # 股票代码解析
├── financial-data.test.ts      # 财务数据映射
├── report-generator.test.ts    # LLM 响应处理
└── reports-api.test.ts         # API 编排逻辑
```

运行测试：

```bash
npm test
```

> 单元测试使用 mock 数据，不依赖真实外部服务。涉及真实 API Key 的集成测试需在 `.env` 中配置有效密钥后单独运行。

---

## 项目文档

| 文档 | 路径 | 说明 |
| :--- | :--- | :--- |
| 产品需求文档 | `docs/prd/` | 产品背景、目标用户、功能需求 |
| 高层设计文档 | `docs/hld/` | 架构设计、模块拆分、数据模型、API 设计 |
| UI/UX 设计文档 | `docs/design/` | 信息架构、交互流程、设计规范 |
| 测试计划 | `docs/test/` | 测试用例与验收标准 |
| 开发规范 | `AGENTS.md` | 代码规范、架构约束、Git 提交规范 |

---

## 免责声明

本系统生成的分析报告由 AI 模型基于公开财务数据自动生成，仅供学习和参考，不构成任何投资建议。投资有风险，决策需谨慎。
