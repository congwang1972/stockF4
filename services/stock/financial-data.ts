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
  currency: "CNY" | "USD" | "HKD";
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

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
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

function yahooValue(value: unknown): unknown {
  if (isJsonObject(value) && "raw" in value) return value.raw;
  if (isJsonObject(value) && "fmt" in value) return value.fmt;
  return value;
}

function yahooNumber(value: unknown): number | null {
  return numberOrNull(yahooValue(value));
}

function yahooString(value: unknown): string | null {
  const raw = yahooValue(value);
  return stringOrNull(raw);
}

function toYahooSymbol(ticker: string, market: Market): string {
  if (market === "US") return ticker;
  if (market === "HK") {
    const clean = ticker.replace(/\.HK$/i, "");
    return `${clean.padStart(4, "0")}.HK`;
  }
  if (market === "CN") {
    const clean = ticker.replace(/\.(SH|SZ)$/i, "");
    return ticker.startsWith("6") ? `${clean}.SS` : `${clean}.SZ`;
  }
  return ticker;
}

function roundedPercentage(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round((((current - previous) / Math.abs(previous)) * 100 + Number.EPSILON) * 100) / 100;
}

const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

async function yahooQuoteSummary(symbol: string, modules: string[]): Promise<JsonObject> {
  const params = new URLSearchParams({ modules: modules.join(",") });
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?${params}`;

  try {
    const response = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw unavailable(`Yahoo Finance 返回 ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isJsonObject(payload)) throw unavailable("Yahoo Finance 响应格式错误");

    const quoteSummary = payload.quoteSummary;
    if (!isJsonObject(quoteSummary)) throw unavailable("Yahoo Finance 响应格式错误");

    const result = quoteSummary.result;
    if (!isUnknownArray(result) || result.length === 0) {
      throw dataNotAvailable();
    }

    const first = result[0];
    if (!isJsonObject(first)) throw dataNotAvailable();

    return first;
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    throw unavailable("Yahoo Finance 服务暂不可用");
  }
}

async function yahooChart(symbol: string): Promise<StockQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

  try {
    const response = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (!isJsonObject(payload)) return null;

    const chart = payload.chart;
    if (!isJsonObject(chart)) return null;

    const result = chart.result;
    if (!isUnknownArray(result) || result.length === 0) return null;

    const first = result[0];
    if (!isJsonObject(first)) return null;

    const meta = first.meta;
    if (!isJsonObject(meta)) return null;

    const price = yahooNumber(meta.regularMarketPrice);
    const currency = yahooString(meta.currency);

    if (price === null) return null;

    const currencyMap: Record<string, "CNY" | "USD" | "HKD"> = {
      CNY: "CNY",
      USD: "USD",
      HKD: "HKD",
    };

    return {
      price,
      currency: currencyMap[currency ?? "USD"] ?? "USD",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function extractIncomeStatements(data: JsonObject): JsonObject[] {
  const history = data.incomeStatementHistory;
  if (!isJsonObject(history)) return [];
  const statements = history.incomeStatementHistory;
  if (!isUnknownArray(statements)) return [];
  return statements.filter(isJsonObject);
}

function extractBalanceSheets(data: JsonObject): JsonObject[] {
  const history = data.balanceSheetHistory;
  if (!isJsonObject(history)) return [];
  const statements = history.balanceSheetStatements;
  if (!isUnknownArray(statements)) return [];
  return statements.filter(isJsonObject);
}

function extractCashFlowStatements(data: JsonObject): JsonObject[] {
  const history = data.cashflowStatementHistory;
  if (!isJsonObject(history)) return [];
  const statements = history.cashflowStatements;
  if (!isUnknownArray(statements)) return [];
  return statements.filter(isJsonObject);
}

function buildMetricsFromYahoo(data: JsonObject): FinancialMetrics {
  const incomeStatements = extractIncomeStatements(data);
  const balanceSheets = extractBalanceSheets(data);
  const cashFlowStatements = extractCashFlowStatements(data);

  const revenueGrowth: number[] = [];
  const netIncome: number[] = [];
  const freeCashFlow: number[] = [];

  const revenues: (number | null)[] = [];
  for (const stmt of incomeStatements.slice(-5)) {
    const revenue = yahooNumber(stmt.totalRevenue);
    revenues.push(revenue);
    const net = yahooNumber(stmt.netIncome);
    if (net !== null) netIncome.push(net);
  }

  for (let i = 1; i < revenues.length; i++) {
    const current = revenues[i];
    const previous = revenues[i - 1];
    if (current !== null && previous !== null && previous !== 0) {
      revenueGrowth.push(roundedPercentage(current, previous));
    }
  }

  const cashFlowByDate = new Map<string, JsonObject>();
  for (const stmt of cashFlowStatements) {
    const endDate = yahooString(stmt.endDate);
    if (endDate !== null) cashFlowByDate.set(endDate, stmt);
  }

  for (const stmt of incomeStatements.slice(-5)) {
    const endDate = yahooString(stmt.endDate);
    if (endDate === null) continue;
    const cashStmt = cashFlowByDate.get(endDate);
    if (cashStmt === undefined) continue;
    const operating = yahooNumber(cashStmt.totalCashFromOperatingActivities);
    const capex = yahooNumber(cashStmt.capitalExpenditures);
    if (operating !== null && capex !== null) {
      freeCashFlow.push(operating - Math.abs(capex));
    }
  }

  const financialData = isJsonObject(data.financialData) ? data.financialData : {};
  const keyStats = isJsonObject(data.defaultKeyStatistics) ? data.defaultKeyStatistics : {};

  const profitMargin = yahooNumber(financialData.profitMargins);
  const roe = yahooNumber(financialData.returnOnEquity);
  const peRatio = yahooNumber(keyStats.trailingPE) ?? yahooNumber(financialData.trailingPE);

  const latestBalance = balanceSheets[balanceSheets.length - 1];
  const assets = latestBalance === undefined ? null : yahooNumber(latestBalance.totalAssets);
  const liabilities = latestBalance === undefined ? null : yahooNumber(latestBalance.totalLiab);

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

function extractProfile(data: JsonObject): CompanyProfile {
  const profile = isJsonObject(data.summaryProfile) ? data.summaryProfile : {};
  const price = isJsonObject(data.price) ? data.price : {};

  const name = yahooString(price.longName) ?? yahooString(price.shortName) ?? yahooString(profile.companyName);
  if (name === null) throw dataNotAvailable();

  return {
    name,
    sector: yahooString(profile.sector),
    description: yahooString(profile.longBusinessSummary),
  };
}

async function fetchFinancialDataFromYahoo(
  ticker: string,
  market: SupportedMarket
): Promise<FinancialData> {
  const symbol = toYahooSymbol(ticker, market);

  const modules = [
    "summaryProfile",
    "financialData",
    "defaultKeyStatistics",
    "incomeStatementHistory",
    "balanceSheetHistory",
    "cashflowStatementHistory",
    "price",
  ];

  const [summaryData, quote] = await Promise.all([
    yahooQuoteSummary(symbol, modules),
    yahooChart(symbol),
  ]);

  const profile = extractProfile(summaryData);
  const metrics = buildMetricsFromYahoo(summaryData);

  const sources = ["yahoo-finance:fundamentals"];
  if (quote !== null) sources.push("yahoo-finance:quote");

  return { profile, metrics, quote, sources };
}

export async function fetchFinancialData(
  ticker: string,
  market: Exclude<Market, "UNKNOWN">
): Promise<FinancialData> {
  return fetchFinancialDataFromYahoo(ticker, market);
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
