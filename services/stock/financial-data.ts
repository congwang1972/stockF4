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

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  errorMessage: string
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      if (response.status >= 500) {
        lastError = unavailable(`${errorMessage}（HTTP ${response.status}）`);
        if (attempt < MAX_RETRIES - 1) await delay(RETRY_DELAY_MS);
        continue;
      }
      throw unavailable(`${errorMessage}（HTTP ${response.status}）`);
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      lastError = unavailable(errorMessage);
      if (attempt < MAX_RETRIES - 1) await delay(RETRY_DELAY_MS);
    }
  }
  throw lastError instanceof ExternalServiceError
    ? lastError
    : unavailable(errorMessage);
}

function toEastMoneySecId(ticker: string, market: Market): string {
  const clean = ticker.replace(/\.(SH|SZ|SS|HK)$/i, "");

  if (market === "US") {
    return `105.${clean}`;
  }
  if (market === "HK") {
    return `116.${clean.padStart(5, "0")}`;
  }
  if (market === "CN") {
    return clean.startsWith("6") ? `1.${clean}` : `0.${clean}`;
  }
  return `1.${clean}`;
}

function toEastMoneyCode(ticker: string, market: Market): string {
  const clean = ticker.replace(/\.(SH|SZ|SS|HK)$/i, "");
  if (market === "US") return clean;
  if (market === "HK") return clean.padStart(5, "0");
  return clean;
}

const EASTMONEY_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://quote.eastmoney.com/",
};

async function eastMoneyStockGet(secid: string): Promise<JsonObject> {
  const fields = "f43,f44,f45,f46,f47,f48,f50,f57,f58,f84,f85,f116,f117,f162,f167,f168,f169,f170,f171,f172,f173,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192";
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&fltt=2&invt=2`;

  const response = await fetchWithRetry(url, {
    headers: EASTMONEY_HEADERS,
    signal: AbortSignal.timeout(10_000),
  }, "东方财富行情服务暂不可用");

  const payload: unknown = await response.json();
  if (!isJsonObject(payload)) throw unavailable("东方财富响应格式错误");

  const data = payload.data;
  if (!isJsonObject(data)) throw dataNotAvailable();

  return data;
}

async function eastMoneyFinancialData(code: string, market: Market): Promise<JsonObject[]> {
  if (market !== "CN") return [];

  const reportName = "RPT_LICO_FN_CPD";
  const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=${reportName}&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageNumber=1&pageSize=5&sortTypes=-1&sortColumns=REPORT_DATE`;

  try {
    const response = await fetchWithRetry(url, {
      headers: EASTMONEY_HEADERS,
      signal: AbortSignal.timeout(10_000),
    }, "东方财富财务数据服务暂不可用");

    const payload: unknown = await response.json();
    if (!isJsonObject(payload)) return [];

    const result = payload.result;
    if (!isJsonObject(result)) return [];

    const data = result.data;
    if (!isUnknownArray(data)) return [];

    return data.filter(isJsonObject);
  } catch {
    return [];
  }
}

async function eastMoneyIncomeStatement(code: string, market: Market): Promise<JsonObject[]> {
  if (market !== "CN") return [];

  const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageNumber=1&pageSize=5&sortTypes=-1&sortColumns=REPORT_DATE`;

  try {
    const response = await fetchWithRetry(url, {
      headers: EASTMONEY_HEADERS,
      signal: AbortSignal.timeout(10_000),
    }, "东方财富利润表服务暂不可用");

    const payload: unknown = await response.json();
    if (!isJsonObject(payload)) return [];

    const result = payload.result;
    if (!isJsonObject(result)) return [];

    const data = result.data;
    if (!isUnknownArray(data)) return [];

    return data.filter(isJsonObject);
  } catch {
    return [];
  }
}

function buildMetricsFromEastMoney(
  stockData: JsonObject,
  financialData: JsonObject[],
  incomeData: JsonObject[]
): FinancialMetrics {
  const peRatio = numberOrNull(stockData.f162);
  const roe = numberOrNull(stockData.f167);
  const profitMargin = numberOrNull(stockData.f186);

  const revenueGrowth: number[] = [];
  const netIncome: number[] = [];
  const freeCashFlow: number[] = [];

  const sortedIncome = [...incomeData].sort((a, b) => {
    const dateA = stringOrNull(a.REPORT_DATE) ?? "";
    const dateB = stringOrNull(b.REPORT_DATE) ?? "";
    return dateA.localeCompare(dateB);
  });

  const revenues: (number | null)[] = [];
  for (const stmt of sortedIncome.slice(-5)) {
    const revenue = numberOrNull(stmt.TOTAL_OPERATE_INCOME);
    revenues.push(revenue);
    const net = numberOrNull(stmt.NETPROFIT);
    if (net !== null) netIncome.push(net);
  }

  for (let i = 1; i < revenues.length; i++) {
    const current = revenues[i];
    const previous = revenues[i - 1];
    if (current !== null && previous !== null && previous !== 0) {
      revenueGrowth.push(Math.round((((current - previous) / Math.abs(previous)) * 100 + Number.EPSILON) * 100) / 100);
    }
  }

  for (const stmt of sortedIncome.slice(-5)) {
    const operating = numberOrNull(stmt.NETCASH_OPERATE);
    const capex = numberOrNull(stmt.BUY_FINANCE_PRODUCT);
    if (operating !== null) {
      freeCashFlow.push(capex !== null ? operating - Math.abs(capex) : operating);
    }
  }

  const totalAssets = numberOrNull(stockData.f183);
  const totalLiabilities = numberOrNull(stockData.f184);
  const debtLevel = totalAssets !== null && totalLiabilities !== null && totalAssets !== 0
    ? totalLiabilities / totalAssets
    : null;

  return {
    revenueGrowth,
    netIncome,
    freeCashFlow,
    profitMargin: profitMargin !== null ? profitMargin / 100 : null,
    debtLevel,
    roe: roe !== null ? roe / 100 : null,
    peRatio,
    industryAvgPe: null,
  };
}

function extractProfile(stockData: JsonObject, market: Market): CompanyProfile {
  const name = stringOrNull(stockData.f58);
  if (name === null) throw dataNotAvailable();

  let sector: string | null = null;
  if (market === "CN") {
    sector = stringOrNull(stockData.f127);
  }

  return {
    name,
    sector,
    description: null,
  };
}

function extractQuote(stockData: JsonObject, market: Market): StockQuote | null {
  const price = numberOrNull(stockData.f43);
  if (price === null) return null;

  const currencyMap: Record<Market, "CNY" | "USD" | "HKD"> = {
    CN: "CNY",
    US: "USD",
    HK: "HKD",
    UNKNOWN: "CNY",
  };

  return {
    price,
    currency: currencyMap[market],
    updatedAt: new Date().toISOString(),
  };
}

async function fetchFinancialDataFromEastMoney(
  ticker: string,
  market: SupportedMarket
): Promise<FinancialData> {
  const secid = toEastMoneySecId(ticker, market);
  const code = toEastMoneyCode(ticker, market);

  const [stockData, financialData, incomeData] = await Promise.all([
    eastMoneyStockGet(secid),
    eastMoneyFinancialData(code, market),
    eastMoneyIncomeStatement(code, market),
  ]);

  const profile = extractProfile(stockData, market);
  const metrics = buildMetricsFromEastMoney(stockData, financialData, incomeData);
  const quote = extractQuote(stockData, market);

  const sources = ["eastmoney:stock"];
  if (incomeData.length > 0) sources.push("eastmoney:financials");

  return { profile, metrics, quote, sources };
}

export async function fetchFinancialData(
  ticker: string,
  market: Exclude<Market, "UNKNOWN">
): Promise<FinancialData> {
  return fetchFinancialDataFromEastMoney(ticker, market);
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
