# 真实金融数据与通义报告生成集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将固定的股票数据与报告文本 mock 替换为 A 股 Tushare、美股 Alpha Vantage、可选腾讯实时行情和阿里云通义千问的真实服务端集成。

**Architecture:** `services/stock/financial-data.ts` 作为单一的市场数据门面，根据市场选择 Tushare 或 Alpha Vantage，统一映射为内部财务模型；`qt.gtimg.cn` 仅作为不影响报告成败的实时报价补充。`services/llm/report-generator.ts` 通过百炼 OpenAI 兼容 Chat Completions 接口生成严格的八章节 JSON，并在服务端用 Zod 验证。API 路由保留报告状态，在任一外部服务失败时将报告标为 `failed`，并返回不泄露内部信息的标准错误响应。

**Tech Stack:** Next.js 14 App Router、TypeScript strict、原生 `fetch`、Zod、Jest、Prisma、Tushare HTTP API、Alpha Vantage HTTP API、阿里云百炼 OpenAI 兼容接口。

---

## 已锁定的范围与约束

- **A 股**：支持 `600519`、`600519.SH` 和 `000001.SZ`；使用 Tushare 的 `stock_basic`、`income`、`cashflow`、`balancesheet`、`fina_indicator`、`daily_basic`。
- **美股**：支持现有的 1–5 位字母代码；使用 Alpha Vantage 的 `OVERVIEW`、`INCOME_STATEMENT`、`CASH_FLOW` 与 `BALANCE_SHEET`。
- **港股**：保留解析能力，但本次不生成报告。服务返回 `MARKET_NOT_SUPPORTED`（HTTP 422），绝不使用 mock 或编造财报数据。
- **腾讯行情**：仅请求 `qt.gtimg.cn` 的报价快照；请求超时、格式变更或不可用时忽略该报价，核心财报和报告仍可完成。报价不参与财务指标计算。
- **数据完整性**：供应商未提供的 `description`、行业、市盈率、ROE 或行业平均市盈率使用 `null`；不使用默认数值。模型提示词必须将 `null` 明确表述为“数据不足，不能判断”。
- **LLM**：默认 `qwen-plus`，模型与兼容模式基础 URL 从环境变量读取。模型只能根据传入的结构化数据分析，必须只输出八个英文键的 JSON 对象。
- **密钥与网络**：仅在服务器端读取环境变量；请求 URL 中的 API Key 必须用 `URLSearchParams` 编码；日志、API 响应、数据库内容及前端不得包含密钥。
- **缓存**：本次不接 Redis。现有 Redis 未配置运行方式，且引入缓存连接管理会扩大改动范围；供应商限流、不可用和缺失配置会返回明确的可恢复错误。后续在配置好 Redis 后，单独实现财报 24 小时与行情 5 分钟缓存。

## 文件结构

| 路径 | 责任 |
| --- | --- |
| `services/external-service-error.ts` | 外部供应商及模型的受控错误类型与 HTTP 状态映射。 |
| `services/stock/financial-data.ts` | 供应商请求、响应校验、指标映射和腾讯报价补充。 |
| `services/llm/report-generator.ts` | 百炼请求、严格 JSON 解析与 `ReportContent` Zod 校验。 |
| `services/stock/parse-ticker.ts` | 将 `.SH`/`.SZ` A 股后缀规范化为内部 6 位代码。 |
| `services/report/report-service.ts` | 写入最终公司名称/数据来源，并将失败报告标记为 `failed`。 |
| `app/api/reports/route.ts` | 编排真实服务、分类返回外部服务错误。 |
| `tests/financial-data.test.ts` | 供应商响应映射、市场拒绝和腾讯报价降级测试。 |
| `tests/report-generator.test.ts` | 通义请求与模型输出边界测试。 |
| `tests/reports-api.test.ts` | 报告创建成功、外部故障和失败状态测试。 |
| `tests/parse-ticker.test.ts` | A 股交易所后缀解析测试。 |
| `.env.example` | 无密钥的服务端配置说明。 |
| `docs/hld/2026-09-09-stock-analysis-hld.md` | 同步真实供应商、端点和缓存边界。 |
| `docs/test/2026-09-09-stock-analysis-test-plan.md` | 同步真实适配器的自动化测试范围与未验证项。 |

### Task 1: 建立受控错误和真实数据类型

**Files:**
- Create: `services/external-service-error.ts`
- Modify: `services/stock/financial-data.ts:3-18`
- Modify: `tests/parse-ticker.test.ts:3-32`
- Modify: `services/stock/parse-ticker.ts:8-25`

- [ ] **Step 1: 写出 A 股后缀解析的失败测试**

在 `tests/parse-ticker.test.ts` 的现有用例后加入：

```ts
it.each([
  ["600519.SH", "600519"],
  ["000001.SZ", "000001"],
])("should parse %s as a CN ticker", (input, ticker) => {
  expect(parseTicker(input)).toEqual({ ticker, market: "CN" });
});
```

- [ ] **Step 2: 运行测试并确认失败**

运行：`npm test -- --runInBand tests/parse-ticker.test.ts`

预期：新增两例失败，当前解析结果为 `UNKNOWN`。

- [ ] **Step 3: 定义外部服务错误类型**

创建 `services/external-service-error.ts`：

```ts
export type ExternalServiceErrorCode =
  | "DATA_PROVIDER_NOT_CONFIGURED"
  | "DATA_PROVIDER_UNAVAILABLE"
  | "DATA_NOT_AVAILABLE"
  | "MARKET_NOT_SUPPORTED"
  | "LLM_NOT_CONFIGURED"
  | "LLM_UNAVAILABLE"
  | "LLM_INVALID_RESPONSE";

const statusByCode: Record<ExternalServiceErrorCode, number> = {
  DATA_PROVIDER_NOT_CONFIGURED: 503,
  DATA_PROVIDER_UNAVAILABLE: 503,
  DATA_NOT_AVAILABLE: 422,
  MARKET_NOT_SUPPORTED: 422,
  LLM_NOT_CONFIGURED: 503,
  LLM_UNAVAILABLE: 503,
  LLM_INVALID_RESPONSE: 502,
};

export class ExternalServiceError extends Error {
  public readonly status: number;

  constructor(
    public readonly code: ExternalServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ExternalServiceError";
    this.status = statusByCode[code];
  }
}
```

将 `services/stock/financial-data.ts` 中的接口替换为以下定义；实现将在任务 2 写入：

```ts
export interface FinancialMetrics {
  revenueGrowth: number[];
  netIncome: number[];
  freeCashFlow: number[];
  profitMargin: number | null;
  debtLevel: number | null;
  roe: number | null;
  peRatio: number | null;
  industryAvgPe: number | null;
}

export interface CompanyProfile {
  name: string;
  sector: string | null;
  description: string | null;
}

export interface StockQuote {
  price: number;
  currency: "CNY" | "USD";
  updatedAt: string;
}

export interface FinancialData {
  profile: CompanyProfile;
  metrics: FinancialMetrics;
  quote: StockQuote | null;
  sources: string[];
}
```

- [ ] **Step 4: 规范化上交所和深交所后缀**

将 `parseTicker` 替换为：

```ts
export function parseTicker(input: string): ParsedTicker {
  const normalized = input.trim().toUpperCase();
  const cnMatch = normalized.match(/^(\d{6})(?:\.(SH|SZ))?$/);

  if (cnMatch) {
    return { ticker: cnMatch[1], market: "CN" };
  }

  if (/^\d{4,5}(\.HK)?$/.test(normalized)) {
    return { ticker: normalized.replace(/\.HK$/, ""), market: "HK" };
  }

  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return { ticker: normalized, market: "US" };
  }

  return { ticker: normalized, market: "UNKNOWN" };
}
```

- [ ] **Step 5: 运行解析测试**

运行：`npm test -- --runInBand tests/parse-ticker.test.ts`

预期：全部通过，包含 `600519.SH` 和 `000001.SZ` 两个新增用例。

- [ ] **Step 6: 暂不创建 Git 提交**

根据项目协作约束，未经明确请求不提交；保留已验证的工作区变更，待用户要求提交时再按逻辑拆分提交。

### Task 2: 用可验证的供应商适配器替换金融数据 mock

**Files:**
- Modify: `services/stock/financial-data.ts:1-48`
- Create: `tests/financial-data.test.ts`

- [ ] **Step 1: 写出 Alpha Vantage 映射、A 股拒绝配置和报价降级测试**

创建 `tests/financial-data.test.ts`。测试使用原生 `Response`，不访问网络：

```ts
import { ExternalServiceError } from "@/services/external-service-error";
import { fetchFinancialData } from "@/services/stock/financial-data";

const alphaOverview = {
  Name: "Apple Inc",
  Sector: "TECHNOLOGY",
  Description: "Consumer electronics company",
  ProfitMargin: "0.25",
  ReturnOnEquityTTM: "1.50",
  PERatio: "30.2",
};

const alphaIncome = {
  annualReports: [
    { fiscalDateEnding: "2025-09-30", totalRevenue: "150", netIncome: "35" },
    { fiscalDateEnding: "2024-09-30", totalRevenue: "125", netIncome: "30" },
    { fiscalDateEnding: "2023-09-30", totalRevenue: "100", netIncome: "25" },
  ],
};

const alphaCashFlow = {
  annualReports: [
    { fiscalDateEnding: "2025-09-30", operatingCashflow: "50", capitalExpenditures: "-10" },
    { fiscalDateEnding: "2024-09-30", operatingCashflow: "45", capitalExpenditures: "-8" },
    { fiscalDateEnding: "2023-09-30", operatingCashflow: "40", capitalExpenditures: "-7" },
  ],
};

const alphaBalanceSheet = {
  annualReports: [
    { fiscalDateEnding: "2025-09-30", totalAssets: "100", totalLiabilities: "40" },
  ],
};

describe("fetchFinancialData", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-alpha-key";
    delete process.env.TUSHARE_TOKEN;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ALPHA_VANTAGE_API_KEY;
    delete process.env.TUSHARE_TOKEN;
  });

  it("should map Alpha Vantage fundamentals without inventing an industry P/E", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      const functionName = url.searchParams.get("function");
      const body =
        functionName === "OVERVIEW" ? alphaOverview :
        functionName === "INCOME_STATEMENT" ? alphaIncome :
        functionName === "CASH_FLOW" ? alphaCashFlow :
        functionName === "BALANCE_SHEET" ? alphaBalanceSheet :
        'v_usAAPL="51~Apple Inc~AAPL~200.00";';
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    const result = await fetchFinancialData("AAPL", "US");

    expect(result.profile).toEqual({
      name: "Apple Inc",
      sector: "TECHNOLOGY",
      description: "Consumer electronics company",
    });
    expect(result.metrics).toMatchObject({
      revenueGrowth: [25, 20],
      netIncome: [25, 30, 35],
      freeCashFlow: [33, 37, 40],
      profitMargin: 0.25,
      debtLevel: 0.4,
      roe: 1.5,
      peRatio: 30.2,
      industryAvgPe: null,
    });
    expect(result.sources).toContain("alpha-vantage:fundamentals");
  });

  it("should reject a market without a selected fundamentals provider", async () => {
    await expect(fetchFinancialData("00700", "HK")).rejects.toMatchObject({
      code: "MARKET_NOT_SUPPORTED",
    } satisfies Partial<ExternalServiceError>);
  });

  it("should reject an unconfigured A-share provider", async () => {
    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_PROVIDER_NOT_CONFIGURED",
    } satisfies Partial<ExternalServiceError>);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

运行：`npm test -- --runInBand tests/financial-data.test.ts`

预期：失败，原因是 `fetchFinancialData` 尚未导出。

- [ ] **Step 3: 实现供应商门面和公共响应转换**

删除当前两个 mock 函数，导出以下门面和共用辅助函数。所有供应商响应先作为 `unknown` 处理，所有数字都经过 `numberOrNull`，禁止将供应商字符串直接断言为数值：

```ts
import { ExternalServiceError } from "@/services/external-service-error";
import { Market } from "@/types/report";

const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
const TUSHARE_URL = "https://api.tushare.pro";
const TENCENT_QUOTE_URL = "https://qt.gtimg.cn/q=";

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(value: unknown, field: string): string {
  const normalized = stringOrNull(value);
  if (!normalized) {
    throw new ExternalServiceError("DATA_NOT_AVAILABLE", `缺少${field}数据`);
  }
  return normalized;
}

function sortByFiscalDate<T extends { fiscalDateEnding: string }>(reports: T[]): T[] {
  return [...reports].sort((left, right) => left.fiscalDateEnding.localeCompare(right.fiscalDateEnding));
}

function lastFive(values: number[]): number[] {
  return values.slice(-5);
}

function calculateGrowth(revenues: number[]): number[] {
  return revenues.slice(1).flatMap((revenue, index) => {
    const previous = revenues[index];
    return previous === 0 ? [] : [Number((((revenue - previous) / Math.abs(previous)) * 100).toFixed(2))];
  });
}

export async function fetchFinancialData(ticker: string, market: Exclude<Market, "UNKNOWN">): Promise<FinancialData> {
  if (market === "HK") {
    throw new ExternalServiceError("MARKET_NOT_SUPPORTED", "港股基本面数据暂未接入");
  }

  const fundamentals = market === "US"
    ? await fetchAlphaVantageFundamentals(ticker)
    : await fetchTushareFundamentals(ticker);
  const quote = await fetchTencentQuote(ticker, market);

  return {
    ...fundamentals,
    quote,
    sources: quote
      ? [...fundamentals.sources, "qt.gtimg.cn:quote"]
      : fundamentals.sources,
  };
}
```

- [ ] **Step 4: 实现 Alpha Vantage 适配器**

在同一文件中实现以下请求和映射。`requestAlphaVantage` 必须用 `URLSearchParams` 写入 `apikey`，若响应包含 `Note`、`Information`、`Error Message` 或非 2xx 状态，抛出 `DATA_PROVIDER_UNAVAILABLE`；不得将供应商错误文本返回给客户端。

```ts
async function requestAlphaVantage(functionName: string, ticker: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new ExternalServiceError("DATA_PROVIDER_NOT_CONFIGURED", "美股数据服务未配置");
  }

  const query = new URLSearchParams({ function: functionName, symbol: ticker, apikey: apiKey });
  let response: Response;
  try {
    response = await fetch(`${ALPHA_VANTAGE_URL}?${query.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "美股数据服务暂不可用");
  }

  if (!response.ok) {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "美股数据服务暂不可用");
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "美股数据服务返回无效结果");
  }

  const record = payload as Record<string, unknown>;
  if (record.Note || record.Information || record["Error Message"]) {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "美股数据服务暂不可用");
  }
  return record;
}

function annualReports(payload: Record<string, unknown>): Array<Record<string, unknown> & { fiscalDateEnding: string }> {
  const reports = payload.annualReports;
  if (!Array.isArray(reports)) {
    throw new ExternalServiceError("DATA_NOT_AVAILABLE", "缺少年度财务数据");
  }

  const normalized = reports.flatMap((report) => {
    if (!report || typeof report !== "object" || Array.isArray(report)) return [];
    const record = report as Record<string, unknown>;
    const fiscalDateEnding = stringOrNull(record.fiscalDateEnding);
    return fiscalDateEnding ? [{ ...record, fiscalDateEnding }] : [];
  });

  if (normalized.length === 0) {
    throw new ExternalServiceError("DATA_NOT_AVAILABLE", "缺少年度财务数据");
  }
  return sortByFiscalDate(normalized);
}

async function fetchAlphaVantageFundamentals(ticker: string): Promise<Omit<FinancialData, "quote">> {
  const [overview, income, cashFlow, balanceSheet] = await Promise.all([
    requestAlphaVantage("OVERVIEW", ticker),
    requestAlphaVantage("INCOME_STATEMENT", ticker),
    requestAlphaVantage("CASH_FLOW", ticker),
    requestAlphaVantage("BALANCE_SHEET", ticker),
  ]);
  const incomeReports = annualReports(income);
  const cashFlowByDate = new Map(
    annualReports(cashFlow).map((report) => [report.fiscalDateEnding, report])
  );
  const balanceReports = annualReports(balanceSheet);
  const revenues = incomeReports.flatMap((report) => {
    const revenue = numberOrNull(report.totalRevenue);
    return revenue === null ? [] : [revenue];
  });
  const netIncome = incomeReports.flatMap((report) => {
    const value = numberOrNull(report.netIncome);
    return value === null ? [] : [value];
  });
  const freeCashFlow = incomeReports.flatMap((report) => {
    const cashFlow = cashFlowByDate.get(report.fiscalDateEnding);
    const operatingCashflow = cashFlow ? numberOrNull(cashFlow.operatingCashflow) : null;
    const capitalExpenditures = cashFlow ? numberOrNull(cashFlow.capitalExpenditures) : null;
    return operatingCashflow === null || capitalExpenditures === null
      ? []
      : [operatingCashflow - Math.abs(capitalExpenditures)];
  });
  const latestBalance = balanceReports.at(-1);
  const assets = latestBalance ? numberOrNull(latestBalance.totalAssets) : null;
  const liabilities = latestBalance ? numberOrNull(latestBalance.totalLiabilities) : null;

  return {
    profile: {
      name: requiredString(overview.Name, "公司名称"),
      sector: stringOrNull(overview.Sector),
      description: stringOrNull(overview.Description),
    },
    metrics: {
      revenueGrowth: calculateGrowth(revenues),
      netIncome: lastFive(netIncome),
      freeCashFlow: lastFive(freeCashFlow),
      profitMargin: numberOrNull(overview.ProfitMargin),
      debtLevel: assets !== null && assets !== 0 && liabilities !== null ? liabilities / assets : null,
      roe: numberOrNull(overview.ReturnOnEquityTTM),
      peRatio: numberOrNull(overview.PERatio),
      industryAvgPe: null,
    },
    sources: ["alpha-vantage:fundamentals"],
  };
}
```

- [ ] **Step 5: 实现 Tushare 适配器和腾讯可选报价**

在同一文件中加入以下完整实现。Tushare 的供应商错误、字段错配和网络异常不得泄露原始响应；腾讯行情始终是可忽略的补充：

```ts
async function requestTushare(
  apiName: string,
  params: Record<string, string>
): Promise<Array<Record<string, unknown>>> {
  const token = process.env.TUSHARE_TOKEN;
  if (!token) {
    throw new ExternalServiceError("DATA_PROVIDER_NOT_CONFIGURED", "A股数据服务未配置");
  }

  let response: Response;
  try {
    response = await fetch(TUSHARE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_name: apiName, token, params }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "A股数据服务暂不可用");
  }

  if (!response.ok) {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "A股数据服务暂不可用");
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "A股数据服务返回无效结果");
  }
  const result = payload as { code?: unknown; data?: unknown };
  if (result.code !== 0) {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "A股数据服务暂不可用");
  }
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw new ExternalServiceError("DATA_NOT_AVAILABLE", "缺少财务数据");
  }

  const data = result.data as { fields?: unknown; items?: unknown };
  const fields = data.fields;
  const items = data.items;
  if (!Array.isArray(fields) || !fields.every((field) => typeof field === "string") || !Array.isArray(items)) {
    throw new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "A股数据服务返回无效结果");
  }

  const rows = items.flatMap((item) => {
    if (!Array.isArray(item) || item.length !== fields.length) return [];
    return [Object.fromEntries(fields.map((field, index) => [field, item[index]]))];
  });
  if (rows.length === 0) {
    throw new ExternalServiceError("DATA_NOT_AVAILABLE", "缺少财务数据");
  }
  return rows;
}

function sortRowsByDate(rows: Array<Record<string, unknown>>, field: "end_date" | "trade_date"): Array<Record<string, unknown>> {
  return [...rows].sort((left, right) => {
    const leftDate = stringOrNull(left[field]) ?? "";
    const rightDate = stringOrNull(right[field]) ?? "";
    return leftDate.localeCompare(rightDate);
  });
}

function latestNumber(rows: Array<Record<string, unknown>>, dateField: "end_date" | "trade_date", valueField: string): number | null {
  const sorted = sortRowsByDate(rows, dateField);
  for (const row of [...sorted].reverse()) {
    const value = numberOrNull(row[valueField]);
    if (value !== null) return value;
  }
  return null;
}

async function fetchTushareFundamentals(ticker: string): Promise<Omit<FinancialData, "quote">> {
  const tsCode = `${ticker}.${ticker.startsWith("6") ? "SH" : "SZ"}`;
  const [basic, income, cashflow, balance, indicator, daily] = await Promise.all([
    requestTushare("stock_basic", { ts_code: tsCode, fields: "ts_code,name,industry" }),
    requestTushare("income", { ts_code: tsCode, fields: "end_date,total_revenue,n_income" }),
    requestTushare("cashflow", { ts_code: tsCode, fields: "end_date,n_cashflow_act,c_pay_acq_const_fiolta" }),
    requestTushare("balancesheet", { ts_code: tsCode, fields: "end_date,total_assets,total_liab" }),
    requestTushare("fina_indicator", { ts_code: tsCode, fields: "end_date,roe" }),
    requestTushare("daily_basic", { ts_code: tsCode, fields: "trade_date,pe_ttm" }),
  ]);
  const incomeRows = sortRowsByDate(income, "end_date");
  const cashflowByDate = new Map(
    cashflow.flatMap((row) => {
      const endDate = stringOrNull(row.end_date);
      return endDate ? [[endDate, row] as const] : [];
    })
  );
  const revenues = incomeRows.flatMap((row) => {
    const revenue = numberOrNull(row.total_revenue);
    return revenue === null ? [] : [revenue];
  });
  const netIncome = incomeRows.flatMap((row) => {
    const value = numberOrNull(row.n_income);
    return value === null ? [] : [value];
  });
  const freeCashFlow = incomeRows.flatMap((row) => {
    const endDate = stringOrNull(row.end_date);
    const cashflowRow = endDate ? cashflowByDate.get(endDate) : undefined;
    const operatingCashflow = cashflowRow ? numberOrNull(cashflowRow.n_cashflow_act) : null;
    const capitalExpenditures = cashflowRow ? numberOrNull(cashflowRow.c_pay_acq_const_fiolta) : null;
    return operatingCashflow === null || capitalExpenditures === null
      ? []
      : [operatingCashflow - Math.abs(capitalExpenditures)];
  });
  const assets = latestNumber(balance, "end_date", "total_assets");
  const liabilities = latestNumber(balance, "end_date", "total_liab");

  return {
    profile: {
      name: requiredString(basic[0]?.name, "公司名称"),
      sector: stringOrNull(basic[0]?.industry),
      description: null,
    },
    metrics: {
      revenueGrowth: calculateGrowth(revenues),
      netIncome: lastFive(netIncome),
      freeCashFlow: lastFive(freeCashFlow),
      profitMargin: null,
      debtLevel: assets !== null && assets !== 0 && liabilities !== null ? liabilities / assets : null,
      roe: latestNumber(indicator, "end_date", "roe"),
      peRatio: latestNumber(daily, "trade_date", "pe_ttm"),
      industryAvgPe: null,
    },
    sources: ["tushare:fundamentals"],
  };
}

async function fetchTencentQuote(ticker: string, market: "CN" | "US"): Promise<StockQuote | null> {
  const symbol = market === "CN"
    ? `${ticker.startsWith("6") ? "sh" : "sz"}${ticker}`
    : `us${ticker}`;
  try {
    const response = await fetch(`${TENCENT_QUOTE_URL}${encodeURIComponent(symbol)}`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return null;
    const payload = await response.text();
    const match = payload.match(/="([^"]+)"/);
    const price = match ? numberOrNull(match[1].split("~")[3]) : null;
    return price === null
      ? null
      : {
          price,
          currency: market === "CN" ? "CNY" : "USD",
          updatedAt: new Date().toISOString(),
        };
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: 运行适配器测试**

运行：`npm test -- --runInBand tests/financial-data.test.ts`

预期：三个用例通过，且测试不产生真实网络请求。

- [ ] **Step 7: 暂不创建 Git 提交**

保持未提交状态；不把真实密钥、供应商响应样本或本地 `.env` 加入暂存区。

### Task 3: 用通义千问替换报告文本 mock，并验证严格 JSON

**Files:**
- Modify: `services/llm/report-generator.ts:1-25`
- Create: `tests/report-generator.test.ts`

- [ ] **Step 1: 写出通义兼容接口和非法模型输出的失败测试**

创建 `tests/report-generator.test.ts`：

```ts
import { ExternalServiceError } from "@/services/external-service-error";
import { generateReportContent } from "@/services/llm/report-generator";

const reportContent = {
  business_model: "业务模式基于已提供的公司资料。",
  financial_analysis: "财务趋势仅依据输入指标。",
  competitive_advantage: "竞争优势需要结合公开资料判断。",
  valuation: "估值结论仅基于输入市盈率。",
  risk_analysis: "风险包括数据未覆盖的因素。",
  growth_potential: "增长判断受数据覆盖范围限制。",
  institutional_perspective: "机构视角为一般性分析。",
  bull_bear_debate: "多空观点均以提供数据为边界。",
};

const input = {
  ticker: "AAPL",
  market: "US",
  profile: { name: "Apple Inc", sector: "Technology", description: null },
  metrics: {
    revenueGrowth: [10], netIncome: [100], freeCashFlow: [80], profitMargin: 0.25,
    debtLevel: 0.4, roe: 1.5, peRatio: 30, industryAvgPe: null,
  },
};

describe("generateReportContent", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://example.test/compatible-mode/v1";
    process.env.DASHSCOPE_MODEL = "qwen-plus";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_BASE_URL;
    delete process.env.DASHSCOPE_MODEL;
  });

  it("should request JSON output and return all eight validated sections", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(reportContent) } }],
    }), { status: 200 })) as typeof fetch;

    await expect(generateReportContent(input)).resolves.toEqual(reportContent);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.test/compatible-mode/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-dashscope-key" }),
        body: expect.stringContaining('"response_format":{"type":"json_object"}'),
      })
    );
  });

  it("should reject a model response with missing report sections", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ business_model: "only one" }) } }],
    }), { status: 200 })) as typeof fetch;

    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_INVALID_RESPONSE",
    } satisfies Partial<ExternalServiceError>);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

运行：`npm test -- --runInBand tests/report-generator.test.ts`

预期：失败，因为当前实现没有发出请求，也没有读取环境变量。

- [ ] **Step 3: 实现通义请求和 Zod 输出校验**

将 `services/llm/report-generator.ts` 替换为以下结构。系统提示必须禁止模型补造数据、投资建议及 Markdown 包裹；用户内容只能是 `JSON.stringify` 的结构化对象，而不是将股票代码或供应商字段插入指令文本：

```ts
import { z } from "zod";
import { ExternalServiceError } from "@/services/external-service-error";
import { CompanyProfile, FinancialMetrics } from "@/services/stock/financial-data";
import { Market, ReportContent } from "@/types/report";

const reportContentSchema = z.object({
  business_model: z.string().min(1).max(2_000),
  financial_analysis: z.string().min(1).max(2_000),
  competitive_advantage: z.string().min(1).max(2_000),
  valuation: z.string().min(1).max(2_000),
  risk_analysis: z.string().min(1).max(2_000),
  growth_potential: z.string().min(1).max(2_000),
  institutional_perspective: z.string().min(1).max(2_000),
  bull_bear_debate: z.string().min(1).max(2_000),
});

export interface ReportGenerationInput {
  ticker: string;
  market: Exclude<Market, "UNKNOWN">;
  profile: CompanyProfile;
  metrics: FinancialMetrics;
}

const systemPrompt = [
  "你是审慎的股票研究分析助手。",
  "只可使用用户消息中的结构化数据，不得补造公司事实、财务数字、同业平均数或引用。",
  "任何 null、空数组或缺失数据必须写明数据不足，不能据此判断。",
  "报告仅作信息分析，不构成投资建议。",
  "只返回一个 JSON 对象，键必须且只能是八个指定英文键，值必须为简体中文字符串。",
].join("\n");

export async function generateReportContent(input: ReportGenerationInput): Promise<ReportContent> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.DASHSCOPE_BASE_URL;
  const model = process.env.DASHSCOPE_MODEL ?? "qwen-plus";
  if (!apiKey || !baseUrl) {
    throw new ExternalServiceError("LLM_NOT_CONFIGURED", "通义模型服务未配置");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ExternalServiceError("LLM_UNAVAILABLE", "通义模型服务暂不可用");
  }

  if (!response.ok) {
    throw new ExternalServiceError("LLM_UNAVAILABLE", "通义模型服务暂不可用");
  }

  const payload: unknown = await response.json();
  const content = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
    : undefined;
  if (typeof content !== "string") {
    throw new ExternalServiceError("LLM_INVALID_RESPONSE", "通义模型返回格式无效");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ExternalServiceError("LLM_INVALID_RESPONSE", "通义模型返回格式无效");
  }

  const validation = reportContentSchema.safeParse(parsed);
  if (!validation.success) {
    throw new ExternalServiceError("LLM_INVALID_RESPONSE", "通义模型返回格式无效");
  }
  return validation.data;
}
```

- [ ] **Step 4: 运行模型适配器测试**

运行：`npm test -- --runInBand tests/report-generator.test.ts`

预期：两个测试通过；测试断言请求 `response_format`，且模型缺字段时拒绝。

- [ ] **Step 5: 暂不创建 Git 提交**

不提交；特别检查测试中的虚拟密钥不是生产密钥，且 `.env` 仍被 `.gitignore` 忽略。

### Task 4: 在报告 API 中保存真实来源并显式处理失败状态

**Files:**
- Modify: `services/report/report-service.ts:6-38`
- Modify: `app/api/reports/route.ts:1-79`
- Create: `tests/reports-api.test.ts`

- [ ] **Step 1: 写出 API 成功和外部数据失败的测试**

创建 `tests/reports-api.test.ts`，在导入路由前 mock 外部模块：

```ts
jest.mock("@/services/report/report-service", () => ({
  createReport: jest.fn(),
  updateReportContent: jest.fn(),
  markReportAsFailed: jest.fn(),
}));
jest.mock("@/services/stock/financial-data", () => ({ fetchFinancialData: jest.fn() }));
jest.mock("@/services/llm/report-generator", () => ({ generateReportContent: jest.fn() }));

import { NextRequest } from "next/server";
import { ExternalServiceError } from "@/services/external-service-error";
import { POST } from "@/app/api/reports/route";
import { createReport, markReportAsFailed, updateReportContent } from "@/services/report/report-service";
import { fetchFinancialData } from "@/services/stock/financial-data";
import { generateReportContent } from "@/services/llm/report-generator";

const mockedCreateReport = jest.mocked(createReport);
const mockedFetchFinancialData = jest.mocked(fetchFinancialData);
const mockedGenerateReportContent = jest.mocked(generateReportContent);

describe("POST /api/reports", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should persist real data sources and the resolved company name", async () => {
    mockedCreateReport.mockResolvedValue({ id: "report-1" } as Awaited<ReturnType<typeof createReport>>);
    mockedFetchFinancialData.mockResolvedValue({
      profile: { name: "Apple Inc", sector: "Technology", description: null },
      metrics: { revenueGrowth: [], netIncome: [], freeCashFlow: [], profitMargin: null, debtLevel: null, roe: null, peRatio: null, industryAvgPe: null },
      quote: null,
      sources: ["alpha-vantage:fundamentals"],
    });
    mockedGenerateReportContent.mockResolvedValue({
      business_model: "a", financial_analysis: "b", competitive_advantage: "c", valuation: "d",
      risk_analysis: "e", growth_potential: "f", institutional_perspective: "g", bull_bear_debate: "h",
    });

    const response = await POST(new NextRequest("http://localhost/api/reports", {
      method: "POST", body: JSON.stringify({ ticker: "AAPL" }),
    }));

    expect(response.status).toBe(201);
    expect(updateReportContent).toHaveBeenCalledWith(
      "report-1", expect.any(Object), ["alpha-vantage:fundamentals"], "Apple Inc"
    );
  });

  it("should mark the report failed and return the provider status", async () => {
    mockedCreateReport.mockResolvedValue({ id: "report-2" } as Awaited<ReturnType<typeof createReport>>);
    mockedFetchFinancialData.mockRejectedValue(new ExternalServiceError(
      "DATA_PROVIDER_UNAVAILABLE", "美股数据服务暂不可用"
    ));

    const response = await POST(new NextRequest("http://localhost/api/reports", {
      method: "POST", body: JSON.stringify({ ticker: "AAPL" }),
    }));

    expect(response.status).toBe(503);
    expect(markReportAsFailed).toHaveBeenCalledWith("report-2");
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "DATA_PROVIDER_UNAVAILABLE" },
    });
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

运行：`npm test -- --runInBand tests/reports-api.test.ts`

预期：失败，因为路由仍调用已删除的 mock 函数，且 `markReportAsFailed` 未实现。

- [ ] **Step 3: 扩展报告写入服务**

将 `updateReportContent` 的签名改为接收公司名称，并新增失败状态更新：

```ts
export async function updateReportContent(
  id: string,
  content: Report["content"],
  dataSources: string[],
  companyName: string
): Promise<Report> {
  const report = await prisma.report.update({
    where: { id },
    data: {
      status: "completed",
      companyName,
      content: (content as unknown as Prisma.InputJsonValue) ?? undefined,
      dataSources,
    },
  });
  return mapReport(report);
}

export async function markReportAsFailed(id: string): Promise<Report> {
  const report = await prisma.report.update({
    where: { id },
    data: { status: "failed" },
  });
  return mapReport(report);
}
```

- [ ] **Step 4: 替换 API 编排并分类错误响应**

将 `app/api/reports/route.ts` 替换为以下实现。验证和未知市场维持现有 400 语义；任何已创建报告的外部调用失败都会先写入 `failed`，且响应中不包含供应商 URL、原始响应或异常堆栈：

```ts
import { NextRequest, NextResponse } from "next/server";
import { validateTicker } from "@/lib/utils/validation";
import { parseTicker } from "@/services/stock/parse-ticker";
import { fetchFinancialData } from "@/services/stock/financial-data";
import { generateReportContent } from "@/services/llm/report-generator";
import {
  createReport,
  markReportAsFailed,
  updateReportContent,
} from "@/services/report/report-service";
import { ExternalServiceError } from "@/services/external-service-error";
import { ApiResponse, CreateReportResponse } from "@/types/report";

function failureResponse(
  requestId: string,
  code: string,
  message: string,
  status: number
): NextResponse<ApiResponse<CreateReportResponse>> {
  return NextResponse.json(
    {
      success: false,
      data: null as unknown as CreateReportResponse,
      error: { code, message },
      meta: { timestamp: new Date().toISOString(), requestId },
    },
    { status }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<CreateReportResponse>>> {
  const requestId = crypto.randomUUID();
  let createdReportId: string | null = null;

  try {
    const body = (await request.json()) as { ticker?: unknown };
    const validation = validateTicker(body.ticker);
    if (!validation.success) {
      return failureResponse(requestId, "INVALID_TICKER", validation.error, 400);
    }

    const parsed = parseTicker(validation.ticker);
    if (parsed.market === "UNKNOWN") {
      return failureResponse(requestId, "UNKNOWN_MARKET", "无法识别该股票代码所属市场", 400);
    }

    const report = await createReport({ ticker: parsed.ticker, market: parsed.market });
    createdReportId = report.id;
    const financialData = await fetchFinancialData(parsed.ticker, parsed.market);
    const content = await generateReportContent({
      ticker: parsed.ticker,
      market: parsed.market,
      profile: financialData.profile,
      metrics: financialData.metrics,
    });
    await updateReportContent(
      report.id,
      content,
      financialData.sources,
      financialData.profile.name
    );

    return NextResponse.json(
      {
        success: true,
        data: { id: report.id, ticker: parsed.ticker, status: "completed" },
        error: null,
        meta: { timestamp: new Date().toISOString(), requestId },
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdReportId) {
      try {
        await markReportAsFailed(createdReportId);
      } catch {
        return failureResponse(requestId, "INTERNAL_ERROR", "服务器内部错误", 500);
      }
    }
    if (error instanceof ExternalServiceError) {
      return failureResponse(requestId, error.code, error.message, error.status);
    }
    return failureResponse(requestId, "INTERNAL_ERROR", "服务器内部错误", 500);
  }
}
```

- [ ] **Step 5: 运行 API 测试**

运行：`npm test -- --runInBand tests/reports-api.test.ts`

预期：两个测试通过；成功路径写入 `alpha-vantage:fundamentals` 与公司名，失败路径写入 `failed` 并返回 503。

- [ ] **Step 6: 暂不创建 Git 提交**

不提交当前工作区的既有 `package-lock.json` 改动或未跟踪的 `股票分析需求.md`；它们不属于此次集成范围。

### Task 5: 同步配置、文档并完成静态验证

**Files:**
- Modify: `.env.example:1-12`
- Modify: `docs/hld/2026-09-09-stock-analysis-hld.md`
- Modify: `docs/test/2026-09-09-stock-analysis-test-plan.md`

- [ ] **Step 1: 更新无密钥环境变量模板**

将 `.env.example` 中通用的 `FINANCIAL_DATA_API_KEY` 和 `LLM_API_KEY` 替换为：

```env
# Financial data providers
TUSHARE_TOKEN=your_tushare_token
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key

# Alibaba Cloud Model Studio (OpenAI-compatible mode)
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_BASE_URL=https://your-model-studio-endpoint/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

保留既有 `DATABASE_URL`、`REDIS_URL` 和 `NEXT_PUBLIC_APP_URL`；不在模板中填入任何实际 URL 中含工作空间标识、Token 或密码的值。

- [ ] **Step 2: 同步 HLD 实现状态**

在 HLD 中作出以下精确同步：

1. 将所有 `/api/v1/reports` 改为实际的 `/api/reports`。
2. 将外部依赖改为“US：Alpha Vantage；CN：Tushare；行情补充：qt.gtimg.cn；HK：本版本返回不支持”。
3. 将 LLM 改为“阿里云百炼 OpenAI 兼容 Chat Completions，默认 qwen-plus，Zod 校验八章节 JSON”。
4. 将 Redis 改为“已预留，未在本版本启用”；不要再声称已有 5 分钟/24 小时缓存。
5. 将第 9 节的供应商与 LLM 选型待确认项删除，保留后续“港股可靠基本面供应商”和“异步队列”的待确认项。

- [ ] **Step 3: 同步测试计划**

在测试计划中：

1. 将真实供应商测试改为“使用 HTTP mock 覆盖映射、异常和限流语义；真实 Key 验证为手工环境检查”。
2. 新增金融适配器、通义 JSON 校验、报告 API 失败状态的单元测试条目。
3. 更新测试执行统计前，运行完整测试后按实际结果填写，不能预填“通过”。
4. 将 BUG-002 标记为已修复；保留 BUG-003（同步生成）和“未配置 PostgreSQL/真实 Key 时无法完成真实环境 E2E”的限制。

- [ ] **Step 4: 运行全量自动化检查**

依次运行：

```bash
npm test -- --runInBand
npm run type-check
npm run lint
npm run build
```

预期：四个命令全部以退出码 0 结束。若任一命令失败，先修复实现或测试，不使用 `--no-verify`、跳过测试或宽松 TypeScript 配置。

- [ ] **Step 5: 真实环境和浏览器验证边界**

在用户已提供 PostgreSQL、Tushare Token、Alpha Vantage Key 和百炼 Key 的本地 `.env` 后：

1. 运行 `npm run dev`。
2. 在浏览器提交 `AAPL`，确认返回 completed 报告、八个章节和 `alpha-vantage:fundamentals` 数据来源。
3. 在浏览器提交 `600519.SH`，确认代码规范化为 `600519` 并按 Tushare 返回报告。
4. 提交 `00700.HK`，确认显示公开的“不支持港股基本面数据”错误且不跳转到报告页。
5. 记录上述结果；在缺少任一真实服务或数据库配置时，明确标记 E2E 为未执行，而不声称通过。

- [ ] **Step 6: 暂不创建 Git 提交**

在用户明确要求提交前，只报告验证结果和实际变更文件；提交时仅添加本计划列出的文件，排除既有 `package-lock.json` 与 `股票分析需求.md`，除非用户另行确认它们属于同一次提交。

## 计划自检

- **需求覆盖：** Task 1 处理真实输入市场代码；Task 2 替换金融 mock 并限制港股；Task 3 替换 LLM mock 并执行 JSON/Zod 校验；Task 4 保存真实来源和失败状态；Task 5 配置、架构、测试与验证全部同步。
- **无占位：** 所有供应商、环境变量、字段、错误代码、测试命令和可验证输出均已指定；未使用 TBD/TODO。
- **类型一致：** `FinancialData` 同时提供 `profile`、`metrics`、`quote`、`sources`；路由只将前两者交给 `ReportGenerationInput`，并将 `sources` 与 `profile.name` 写入报告。`FinancialMetrics` 的未知标量均为 `number | null`，LLM 提示词明确约束 `null` 的表述。
