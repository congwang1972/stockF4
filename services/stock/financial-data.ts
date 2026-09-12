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

function toTencentSymbol(ticker: string, market: Market): string {
  const clean = ticker.replace(/\.(SH|SZ|SS|HK)$/i, "");
  if (market === "US") return `us${clean}`;
  if (market === "HK") return `hk${clean.padStart(5, "0")}`;
  return clean.startsWith("6") ? `sh${clean}` : `sz${clean}`;
}

function toEastMoneyCode(ticker: string, market: Market): string {
  const clean = ticker.replace(/\.(SH|SZ|SS|HK)$/i, "");
  if (market === "US") return clean;
  if (market === "HK") return clean.padStart(5, "0");
  return clean;
}

const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
};

interface TencentQuoteData {
  name: string | null;
  price: number | null;
  peRatio: number | null;
  totalMarketCap: number | null;
}

function parseTencentQuote(text: string, market: Market): TencentQuoteData {
  const match = text.match(/="([^"]*)"/);
  if (match === null || match[1] === undefined) return { name: null, price: null, peRatio: null, totalMarketCap: null };
  const value = match[1];
  if (value.length === 0) return { name: null, price: null, peRatio: null, totalMarketCap: null };

  const parts = value.split("~");
  const name = parts[1] !== undefined && parts[1].trim().length > 0 ? parts[1].trim() : null;
  const price = parts[3] !== undefined ? numberOrNull(parts[3]) : null;
  const peRatio = parts[39] !== undefined ? numberOrNull(parts[39]) : null;
  const totalMarketCap = parts[45] !== undefined ? numberOrNull(parts[45]) : null;

  return { name, price, peRatio, totalMarketCap };
}

async function fetchTencentQuote(
  ticker: string,
  market: SupportedMarket
): Promise<{ data: TencentQuoteData; source: string | null }> {
  const symbol = toTencentSymbol(ticker, market);
  try {
    const response = await fetchWithRetry(
      `https://qt.gtimg.cn/q=${symbol}`,
      { headers: COMMON_HEADERS, signal: AbortSignal.timeout(5_000) },
      "腾讯行情服务暂不可用"
    );
    const text = await response.text();
    const data = parseTencentQuote(text, market);
    return { data, source: "qt.gtimg.cn:quote" };
  } catch {
    return { data: { name: null, price: null, peRatio: null, totalMarketCap: null }, source: null };
  }
}

async function eastMoneyFinancialData(code: string, market: Market): Promise<JsonObject[]> {
  if (market !== "CN") return [];

  const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_LICO_FN_CPD&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageNumber=1&pageSize=5&sortTypes=-1&sortColumns=NOTICE_DATE`;

  try {
    const response = await fetchWithRetry(url, {
      headers: { ...COMMON_HEADERS, Referer: "https://data.eastmoney.com/" },
      signal: AbortSignal.timeout(10_000),
    }, "东方财富数据中心暂不可用");

    const payload: unknown = await response.json();
    if (!isJsonObject(payload)) return [];
    if (payload.success !== true) return [];

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

  const url = `https://datacenter.eastmoney.com/securities/api/data/v1/get?reportName=RPT_DMSK_FN_INCOME&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)&pageNumber=1&pageSize=5&sortTypes=-1&sortColumns=NOTICE_DATE`;

  try {
    const response = await fetchWithRetry(url, {
      headers: { ...COMMON_HEADERS, Referer: "https://data.eastmoney.com/" },
      signal: AbortSignal.timeout(10_000),
    }, "东方财富利润表服务暂不可用");

    const payload: unknown = await response.json();
    if (!isJsonObject(payload)) return [];
    if (payload.success !== true) return [];

    const result = payload.result;
    if (!isJsonObject(result)) return [];

    const data = result.data;
    if (!isUnknownArray(data)) return [];

    return data.filter(isJsonObject);
  } catch {
    return [];
  }
}

function buildMetrics(
  tencentData: TencentQuoteData,
  financialData: JsonObject[],
  incomeData: JsonObject[]
): FinancialMetrics {
  const revenueGrowth: number[] = [];
  const netIncome: number[] = [];
  const freeCashFlow: number[] = [];

  const sortedIncome = [...incomeData].sort((a, b) => {
    const dateA = stringOrNull(a.REPORT_DATE) ?? "";
    const dateB = stringOrNull(b.REPORT_DATE) ?? "";
    return dateA.localeCompare(dateB);
  });

  const sortedFinancial = [...financialData].sort((a, b) => {
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

  for (let i = 1; i < revenues.length; i += 1) {
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

  let profitMargin: number | null = null;
  let roe: number | null = null;
  let debtLevel: number | null = null;

  const latestFinancial = sortedFinancial[sortedFinancial.length - 1];
  if (latestFinancial !== undefined) {
    const netProfitMargin = numberOrNull(latestFinancial.NETPROFIT_MARGIN);
    if (netProfitMargin !== null) profitMargin = netProfitMargin / 100;

    const roeValue = numberOrNull(latestFinancial.ROE_WEIGHT);
    if (roeValue !== null) roe = roeValue / 100;

    const totalAssets = numberOrNull(latestFinancial.TOTAL_ASSETS);
    const totalLiabilities = numberOrNull(latestFinancial.TOTAL_LIABILITIES);
    if (totalAssets !== null && totalLiabilities !== null && totalAssets !== 0) {
      debtLevel = totalLiabilities / totalAssets;
    }
  }

  return {
    revenueGrowth,
    netIncome,
    freeCashFlow,
    profitMargin,
    debtLevel,
    roe,
    peRatio: tencentData.peRatio,
    industryAvgPe: null,
  };
}

async function fetchFinancialDataCombined(
  ticker: string,
  market: SupportedMarket
): Promise<FinancialData> {
  const code = toEastMoneyCode(ticker, market);

  const [quoteResult, financialData, incomeData] = await Promise.all([
    fetchTencentQuote(ticker, market),
    eastMoneyFinancialData(code, market),
    eastMoneyIncomeStatement(code, market),
  ]);

  const companyName = quoteResult.data.name;
  if (companyName === null) throw dataNotAvailable();

  const profile: CompanyProfile = {
    name: companyName,
    sector: null,
    description: null,
  };

  const metrics = buildMetrics(quoteResult.data, financialData, incomeData);

  let quote: StockQuote | null = null;
  if (quoteResult.data.price !== null) {
    const currencyMap: Record<SupportedMarket, "CNY" | "USD" | "HKD"> = {
      CN: "CNY",
      US: "USD",
      HK: "HKD",
    };
    quote = {
      price: quoteResult.data.price,
      currency: currencyMap[market],
      updatedAt: new Date().toISOString(),
    };
  }

  const sources: string[] = [];
  if (quoteResult.source !== null) sources.push(quoteResult.source);
  if (financialData.length > 0) sources.push("eastmoney:financials");
  if (incomeData.length > 0) sources.push("eastmoney:income");

  return { profile, metrics, quote, sources };
}

export async function fetchFinancialData(
  ticker: string,
  market: Exclude<Market, "UNKNOWN">
): Promise<FinancialData> {
  return fetchFinancialDataCombined(ticker, market);
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
