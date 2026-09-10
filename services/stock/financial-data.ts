import { ExternalServiceError } from "@/services/external-service-error";
import type { Market } from "@/types/report";

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

type JsonObject = Record<string, unknown>;
type SupportedMarket = Exclude<Market, "UNKNOWN">;

type DatedRecord = {
  date: string;
  values: JsonObject;
};

type MetricFields = {
  revenue: string;
  netIncome: string;
  operatingCashflow: string;
  capitalExpenditures: string;
  totalAssets: string;
  totalLiabilities: string;
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return isUnknownArray(value) && value.every((item) => typeof item === "string");
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function unavailable(message: string): ExternalServiceError {
  return new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", message);
}

function dataNotAvailable(): ExternalServiceError {
  return new ExternalServiceError("DATA_NOT_AVAILABLE", "未获取到可用的财务数据");
}

function datedRecords(rows: JsonObject[], dateField: string): DatedRecord[] {
  const records: DatedRecord[] = [];
  for (const values of rows) {
    const date = stringOrNull(values[dateField]);
    if (date !== null) records.push({ date, values });
  }
  return records.sort((left, right) => left.date.localeCompare(right.date));
}

function annualDatedRecords(rows: JsonObject[], dateField: string): DatedRecord[] {
  return datedRecords(rows, dateField).filter((record) => record.date.replace(/\D/g, "").endsWith("1231"));
}

function percentageToRatio(value: number | null): number | null {
  return value === null ? null : value / 100;
}

function alphaAnnualRecords(payload: JsonObject): DatedRecord[] {
  const reports = payload.annualReports;
  if (!isUnknownArray(reports)) throw unavailable("美股数据服务暂不可用");
  return datedRecords(reports.filter(isJsonObject), "fiscalDateEnding");
}

function latestNumber(records: DatedRecord[], field: string): number | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record === undefined) continue;
    const value = numberOrNull(record.values[field]);
    if (value !== null) return value;
  }
  return null;
}

function roundedPercentage(current: number, previous: number): number {
  return Math.round((((current - previous) / Math.abs(previous)) * 100 + Number.EPSILON) * 100) / 100;
}

function buildMetrics(
  income: DatedRecord[],
  cashFlow: DatedRecord[],
  balanceSheet: DatedRecord[],
  fields: MetricFields,
  profitMargin: number | null,
  roe: number | null,
  peRatio: number | null
): FinancialMetrics {
  const lastFive = income.slice(-5);
  if (lastFive.length === 0) throw dataNotAvailable();

  const revenueGrowth: number[] = [];
  const netIncome: number[] = [];
  const freeCashFlow: number[] = [];
  const cashFlowByDate = new Map<string, DatedRecord>();
  for (const record of cashFlow) cashFlowByDate.set(record.date, record);

  for (let index = 0; index < lastFive.length; index += 1) {
    const record = lastFive[index];
    if (record === undefined) continue;
    const netIncomeValue = numberOrNull(record.values[fields.netIncome]);
    if (netIncomeValue !== null) netIncome.push(netIncomeValue);

    const cashRecord = cashFlowByDate.get(record.date);
    const operatingCashflow = cashRecord === undefined
      ? null
      : numberOrNull(cashRecord.values[fields.operatingCashflow]);
    const capitalExpenditures = cashRecord === undefined
      ? null
      : numberOrNull(cashRecord.values[fields.capitalExpenditures]);
    if (operatingCashflow !== null && capitalExpenditures !== null) {
      freeCashFlow.push(operatingCashflow - Math.abs(capitalExpenditures));
    }

    const previous = lastFive[index - 1];
    if (previous === undefined) continue;
    const currentRevenue = numberOrNull(record.values[fields.revenue]);
    const previousRevenue = numberOrNull(previous.values[fields.revenue]);
    if (currentRevenue !== null && previousRevenue !== null && previousRevenue !== 0) {
      revenueGrowth.push(roundedPercentage(currentRevenue, previousRevenue));
    }
  }

  const latestBalance = balanceSheet[balanceSheet.length - 1];
  const assets = latestBalance === undefined
    ? null
    : numberOrNull(latestBalance.values[fields.totalAssets]);
  const liabilities = latestBalance === undefined
    ? null
    : numberOrNull(latestBalance.values[fields.totalLiabilities]);

  return {
    revenueGrowth,
    netIncome,
    freeCashFlow,
    profitMargin,
    debtLevel: assets === null || liabilities === null || assets === 0 ? null : liabilities / assets,
    roe,
    peRatio,
    industryAvgPe: null,
  };
}

async function alphaVantageRequest(
  functionName: string,
  ticker: string,
  apiKey: string
): Promise<JsonObject> {
  const parameters = new URLSearchParams({
    function: functionName,
    symbol: ticker,
    apikey: apiKey,
  });
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?${parameters.toString()}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) throw unavailable("美股数据服务暂不可用");
    const payload: unknown = await response.json();
    if (
      !isJsonObject(payload) ||
      "Note" in payload ||
      "Information" in payload ||
      "Error Message" in payload
    ) {
      throw unavailable("美股数据服务暂不可用");
    }
    return payload;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    throw unavailable("美股数据服务暂不可用");
  }
}

async function fetchTencentQuote(
  ticker: string,
  market: "US" | "CN"
): Promise<StockQuote | null> {
  const symbol = market === "US"
    ? `us${ticker}`
    : ticker.startsWith("6") ? `sh${ticker}` : `sz${ticker}`;
  try {
    const response = await fetch(`https://qt.gtimg.cn/q=${symbol}`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    const match = text.match(/="([^"]*)"/);
    const value = match === null ? undefined : match[1];
    const price = value === undefined ? null : numberOrNull(value.split("~")[3]);
    return price === null
      ? null
      : { price, currency: market === "US" ? "USD" : "CNY", updatedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

async function fetchUsFinancialData(ticker: string): Promise<FinancialData> {
  const apiKey = stringOrNull(process.env.ALPHA_VANTAGE_API_KEY);
  if (apiKey === null) {
    throw new ExternalServiceError("DATA_PROVIDER_NOT_CONFIGURED", "美股数据服务未配置");
  }
  const quotePromise = fetchTencentQuote(ticker, "US");
  const [overview, income, cashFlow, balanceSheet] = await Promise.all([
    alphaVantageRequest("OVERVIEW", ticker, apiKey),
    alphaVantageRequest("INCOME_STATEMENT", ticker, apiKey),
    alphaVantageRequest("CASH_FLOW", ticker, apiKey),
    alphaVantageRequest("BALANCE_SHEET", ticker, apiKey),
  ]);
  const name = stringOrNull(overview.Name);
  if (name === null) throw dataNotAvailable();
  const metrics = buildMetrics(
    alphaAnnualRecords(income),
    alphaAnnualRecords(cashFlow),
    alphaAnnualRecords(balanceSheet),
    {
      revenue: "totalRevenue",
      netIncome: "netIncome",
      operatingCashflow: "operatingCashflow",
      capitalExpenditures: "capitalExpenditures",
      totalAssets: "totalAssets",
      totalLiabilities: "totalLiabilities",
    },
    numberOrNull(overview.ProfitMargin),
    numberOrNull(overview.ReturnOnEquityTTM),
    numberOrNull(overview.PERatio)
  );
  const quote = await Promise.race([quotePromise, Promise.resolve<StockQuote | null>(null)]);
  const sources = ["alpha-vantage:fundamentals"];
  if (quote !== null) sources.push("qt.gtimg.cn:quote");
  return {
    profile: {
      name,
      sector: stringOrNull(overview.Sector),
      description: stringOrNull(overview.Description),
    },
    metrics,
    quote,
    sources,
  };
}

async function tushareRows(
  apiName: string,
  token: string,
  params: JsonObject
): Promise<JsonObject[]> {
  try {
    const response = await fetch("https://api.tushare.pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_name: apiName, token, params }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw unavailable("A股数据服务暂不可用");
    const payload: unknown = await response.json();
    if (!isJsonObject(payload) || numberOrNull(payload.code) !== 0 || !isJsonObject(payload.data)) {
      throw unavailable("A股数据服务暂不可用");
    }
    const fields = payload.data.fields;
    const items = payload.data.items;
    if (!isStringArray(fields) || !isUnknownArray(items)) {
      throw unavailable("A股数据服务暂不可用");
    }
    const rows: JsonObject[] = [];
    for (const item of items) {
      if (!isUnknownArray(item) || item.length !== fields.length) {
        throw unavailable("A股数据服务暂不可用");
      }
      const row: JsonObject = {};
      for (let index = 0; index < fields.length; index += 1) {
        const field = fields[index];
        if (field !== undefined) row[field] = item[index];
      }
      rows.push(row);
    }
    if (rows.length === 0) throw dataNotAvailable();
    return rows;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    throw unavailable("A股数据服务暂不可用");
  }
}

async function fetchCnFinancialData(ticker: string): Promise<FinancialData> {
  const token = stringOrNull(process.env.TUSHARE_TOKEN);
  if (token === null) {
    throw new ExternalServiceError("DATA_PROVIDER_NOT_CONFIGURED", "A股数据服务未配置");
  }
  const tsCode = ticker.startsWith("6") ? `${ticker}.SH` : `${ticker}.SZ`;
  const quotePromise = fetchTencentQuote(ticker, "CN");
  const [stockBasic, income, cashFlow, balanceSheet, finaIndicator, dailyBasic] = await Promise.all([
    tushareRows("stock_basic", token, { ts_code: tsCode, fields: "ts_code,name,industry" }),
    tushareRows("income", token, { ts_code: tsCode, fields: "end_date,total_revenue,n_income" }),
    tushareRows("cashflow", token, { ts_code: tsCode, fields: "end_date,n_cashflow_act,c_pay_acq_const_fiolta" }),
    tushareRows("balancesheet", token, { ts_code: tsCode, fields: "end_date,total_assets,total_liab" }),
    tushareRows("fina_indicator", token, { ts_code: tsCode, fields: "end_date,roe" }),
    tushareRows("daily_basic", token, { ts_code: tsCode, fields: "trade_date,pe_ttm" }),
  ]);
  const company = stockBasic[0];
  if (company === undefined) throw dataNotAvailable();
  const name = stringOrNull(company.name);
  if (name === null) throw dataNotAvailable();
  const metrics = buildMetrics(
    annualDatedRecords(income, "end_date"),
    annualDatedRecords(cashFlow, "end_date"),
    annualDatedRecords(balanceSheet, "end_date"),
    {
      revenue: "total_revenue",
      netIncome: "n_income",
      operatingCashflow: "n_cashflow_act",
      capitalExpenditures: "c_pay_acq_const_fiolta",
      totalAssets: "total_assets",
      totalLiabilities: "total_liab",
    },
    null,
    percentageToRatio(latestNumber(annualDatedRecords(finaIndicator, "end_date"), "roe")),
    latestNumber(datedRecords(dailyBasic, "trade_date"), "pe_ttm")
  );
  const quote = await Promise.race([quotePromise, Promise.resolve<StockQuote | null>(null)]);
  const sources = ["tushare:fundamentals"];
  if (quote !== null) sources.push("qt.gtimg.cn:quote");
  return {
    profile: { name, sector: stringOrNull(company.industry), description: null },
    metrics,
    quote,
    sources,
  };
}

export async function fetchFinancialData(
  ticker: string,
  market: Exclude<Market, "UNKNOWN">
): Promise<FinancialData> {
  if (market === "HK") {
    throw new ExternalServiceError("MARKET_NOT_SUPPORTED", "港股基本面数据暂未接入");
  }
  return market === "US" ? fetchUsFinancialData(ticker) : fetchCnFinancialData(ticker);
}

function supportedMarket(market: Market): SupportedMarket {
  if (market === "UNKNOWN") {
    throw new ExternalServiceError("MARKET_NOT_SUPPORTED", "不支持的市场");
  }
  return market;
}

export async function fetchCompanyProfile(
  ticker: string,
  market: Market
): Promise<CompanyProfile> {
  return (await fetchFinancialData(ticker, supportedMarket(market))).profile;
}

export async function fetchFinancialMetrics(
  ticker: string,
  market: Market
): Promise<FinancialMetrics> {
  return (await fetchFinancialData(ticker, supportedMarket(market))).metrics;
}
