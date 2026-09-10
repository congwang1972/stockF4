import { fetchFinancialData } from "@/services/stock/financial-data";

const overview = {
  Name: "Apple Inc",
  Sector: "TECHNOLOGY",
  Description: "Consumer electronics company",
  ProfitMargin: "0.25",
  ReturnOnEquityTTM: "1.50",
  PERatio: "30.2",
};
const income = {
  annualReports: [
    { fiscalDateEnding: "2025-09-30", totalRevenue: "150", netIncome: "35" },
    { fiscalDateEnding: "2024-09-30", totalRevenue: "125", netIncome: "30" },
    { fiscalDateEnding: "2023-09-30", totalRevenue: "100", netIncome: "25" },
  ],
};
const cashFlow = {
  annualReports: [
    { fiscalDateEnding: "2025-09-30", operatingCashflow: "50", capitalExpenditures: "-10" },
    { fiscalDateEnding: "2024-09-30", operatingCashflow: "45", capitalExpenditures: "-8" },
    { fiscalDateEnding: "2023-09-30", operatingCashflow: "40", capitalExpenditures: "-7" },
  ],
};
const balanceSheet = {
  annualReports: [
    { fiscalDateEnding: "2025-09-30", totalAssets: "100", totalLiabilities: "40" },
  ],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("fetchFinancialData", () => {
  let originalFetch: typeof fetch;
  let originalAlphaVantageApiKey: string | undefined;
  let originalTushareToken: string | undefined;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalAlphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;
    originalTushareToken = process.env.TUSHARE_TOKEN;
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    global.fetch = fetchMock;
    delete process.env.ALPHA_VANTAGE_API_KEY;
    delete process.env.TUSHARE_TOKEN;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalAlphaVantageApiKey === undefined) {
      delete process.env.ALPHA_VANTAGE_API_KEY;
    } else {
      process.env.ALPHA_VANTAGE_API_KEY = originalAlphaVantageApiKey;
    }
    if (originalTushareToken === undefined) {
      delete process.env.TUSHARE_TOKEN;
    } else {
      process.env.TUSHARE_TOKEN = originalTushareToken;
    }
  });

  it("maps Alpha Vantage US fundamentals and an optional Tencent quote", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-alpha-key";
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const functionName = new URL(String(input)).searchParams.get("function");
      if (functionName === "OVERVIEW") return Promise.resolve(jsonResponse(overview));
      if (functionName === "INCOME_STATEMENT") return Promise.resolve(jsonResponse(income));
      if (functionName === "CASH_FLOW") return Promise.resolve(jsonResponse(cashFlow));
      if (functionName === "BALANCE_SHEET") return Promise.resolve(jsonResponse(balanceSheet));
      return Promise.resolve(new Response('v_usAAPL="51~Apple Inc~AAPL~210.5~";', { status: 200 }));
    });

    const result = await fetchFinancialData("AAPL", "US");

    expect(result.profile).toEqual({
      name: "Apple Inc", sector: "TECHNOLOGY", description: "Consumer electronics company",
    });
    expect(result.metrics).toEqual({
      revenueGrowth: [25, 20], netIncome: [25, 30, 35], freeCashFlow: [33, 37, 40],
      profitMargin: 0.25, debtLevel: 0.4, roe: 1.5, peRatio: 30.2, industryAvgPe: null,
    });
    expect(result.quote).toMatchObject({ price: 210.5, currency: "USD" });
    expect(result.sources).toEqual(["alpha-vantage:fundamentals", "qt.gtimg.cn:quote"]);
  });

  it("maps an Alpha Vantage rate limit response to a provider unavailable error", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-alpha-key";
    fetchMock.mockResolvedValue(jsonResponse({ Note: "API call frequency exceeded" }));

    await expect(fetchFinancialData("AAPL", "US")).rejects.toMatchObject({
      code: "DATA_PROVIDER_UNAVAILABLE",
      message: "美股数据服务暂不可用",
    });
  });

  it("maps an Alpha Vantage non-success response to a provider unavailable error", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-alpha-key";
    fetchMock.mockResolvedValue(new Response("Service unavailable", { status: 503 }));

    await expect(fetchFinancialData("AAPL", "US")).rejects.toMatchObject({
      code: "DATA_PROVIDER_UNAVAILABLE",
      message: "美股数据服务暂不可用",
    });
  });

  it("maps malformed Alpha Vantage annual reports to a provider unavailable error", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-alpha-key";
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const functionName = new URL(String(input)).searchParams.get("function");
      if (functionName === "OVERVIEW") return Promise.resolve(jsonResponse(overview));
      if (functionName === "INCOME_STATEMENT") return Promise.resolve(jsonResponse({}));
      if (functionName === "CASH_FLOW") return Promise.resolve(jsonResponse(cashFlow));
      if (functionName === "BALANCE_SHEET") return Promise.resolve(jsonResponse(balanceSheet));
      return Promise.resolve(new Response('v_usAAPL="51~Apple Inc~AAPL~210.5~";', { status: 200 }));
    });

    await expect(fetchFinancialData("AAPL", "US")).rejects.toMatchObject({
      code: "DATA_PROVIDER_UNAVAILABLE",
      message: "美股数据服务暂不可用",
    });
  });

  it("does not await a slow Tencent quote after US fundamentals finish", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-alpha-key";
    const pendingResponses = new Map<string, (response: Response) => void>();
    let resolveQuote: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const functionName = new URL(String(input)).searchParams.get("function");
      if (functionName !== null) {
        return new Promise<Response>((resolve) => {
          pendingResponses.set(functionName, resolve);
        });
      }
      return new Promise<Response>((resolve) => {
        resolveQuote = resolve;
      });
    });

    const request = fetchFinancialData("AAPL", "US");
    const quoteStartedBeforeFundamentals = fetchMock.mock.calls.some(([input]) => (
      String(input).startsWith("https://qt.gtimg.cn/q=usAAPL")
    ));

    function resolveFundamental(functionName: string, payload: unknown): void {
      const resolve = pendingResponses.get(functionName);
      if (resolve === undefined) throw new Error(`缺少 ${functionName} 请求`);
      resolve(jsonResponse(payload));
    }

    resolveFundamental("OVERVIEW", overview);
    resolveFundamental("INCOME_STATEMENT", income);
    resolveFundamental("CASH_FLOW", cashFlow);
    resolveFundamental("BALANCE_SHEET", balanceSheet);

    let completedBeforeQuote = false;
    void request.then(() => {
      completedBeforeQuote = true;
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    expect(quoteStartedBeforeFundamentals).toBe(true);
    expect(completedBeforeQuote).toBe(true);

    const resolveSlowQuote = resolveQuote;
    if (resolveSlowQuote === undefined) throw new Error("缺少腾讯行情请求");
    resolveSlowQuote(new Response('v_usAAPL="51~Apple Inc~AAPL~210.5~";', { status: 200 }));
    const result = await request;

    expect(result.quote).toBeNull();
  });

  it("rejects unsupported Hong Kong fundamentals", async () => {
    await expect(fetchFinancialData("00700", "HK")).rejects.toMatchObject({
      code: "MARKET_NOT_SUPPORTED",
    });
  });

  it("rejects CN data requests when Tushare is not configured", async () => {
    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_PROVIDER_NOT_CONFIGURED",
    });
  });

  it("maps a Tushare provider error response to a provider unavailable error", async () => {
    process.env.TUSHARE_TOKEN = "test-tushare-token";
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({
      code: -2001,
      msg: "权限不足",
    })));

    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_PROVIDER_UNAVAILABLE",
      message: "A股数据服务暂不可用",
    });
  });

  it("maps a Tushare non-success response to a provider unavailable error", async () => {
    process.env.TUSHARE_TOKEN = "test-tushare-token";
    fetchMock.mockResolvedValue(new Response("Service unavailable", { status: 503 }));

    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_PROVIDER_UNAVAILABLE",
      message: "A股数据服务暂不可用",
    });
  });

  it("returns US fundamentals when Tencent quote retrieval fails", async () => {
    process.env.ALPHA_VANTAGE_API_KEY = "test-alpha-key";
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const functionName = new URL(String(input)).searchParams.get("function");
      if (functionName === "OVERVIEW") return Promise.resolve(jsonResponse(overview));
      if (functionName === "INCOME_STATEMENT") return Promise.resolve(jsonResponse(income));
      if (functionName === "CASH_FLOW") return Promise.resolve(jsonResponse(cashFlow));
      if (functionName === "BALANCE_SHEET") return Promise.resolve(jsonResponse(balanceSheet));
      return Promise.reject(new Error("Quote service unavailable"));
    });

    const result = await fetchFinancialData("AAPL", "US");

    expect(result.quote).toBeNull();
    expect(result.sources).toEqual(["alpha-vantage:fundamentals"]);
  });

  it("maps annual Tushare CN fundamentals, normalizes ROE, and ignores an unparseable Tencent quote", async () => {
    process.env.TUSHARE_TOKEN = "test-tushare-token";
    const tushareRequestBodies: string[] = [];
    const tusharePayloads: Record<string, unknown> = {
      stock_basic: {
        code: 0,
        data: {
          fields: ["ts_code", "name", "industry"],
          items: [["600519.SH", "贵州茅台", "白酒"]],
        },
      },
      income: {
        code: 0,
        data: {
          fields: ["end_date", "total_revenue", "n_income"],
          items: [
            ["2025-12-31", 150, 35],
            ["2025-09-30", 110, 26],
            ["2025-06-30", 70, 20],
            ["2025-03-31", 40, 10],
            ["2023-12-31", 100, 25],
            ["2024-12-31", 125, 30],
          ],
        },
      },
      cashflow: {
        code: 0,
        data: {
          fields: ["end_date", "n_cashflow_act", "c_pay_acq_const_fiolta"],
          items: [
            ["2025-12-31", 50, -10],
            ["2025-09-30", 22, -4],
            ["2025-06-30", 17, -3],
            ["2025-03-31", 12, -2],
            ["2023-12-31", 40, -7],
            ["2024-12-31", 45, -8],
          ],
        },
      },
      balancesheet: {
        code: 0,
        data: {
          fields: ["end_date", "total_assets", "total_liab"],
          items: [["2025-12-31", 100, 40]],
        },
      },
      fina_indicator: {
        code: 0,
        data: {
          fields: ["end_date", "roe"],
          items: [["2025-12-31", 25]],
        },
      },
      daily_basic: {
        code: 0,
        data: {
          fields: ["trade_date", "pe_ttm"],
          items: [["2025-12-31", 20]],
        },
      },
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.url === "https://api.tushare.pro/") {
        const body: unknown = await request.json();
        const serializedBody = JSON.stringify(body);
        if (serializedBody !== undefined) tushareRequestBodies.push(serializedBody);
        const apiName = typeof body === "object"
          && body !== null
          && "api_name" in body
          && typeof body.api_name === "string"
          ? body.api_name
          : null;
        const payload = apiName === null ? undefined : tusharePayloads[apiName];
        return payload === undefined
          ? new Response("Unexpected Tushare endpoint", { status: 400 })
          : jsonResponse(payload);
      }
      return new Response("This is not a parseable Tencent quote", { status: 200 });
    });

    const result = await fetchFinancialData("600519", "CN");

    expect(result.profile).toEqual({ name: "贵州茅台", sector: "白酒", description: null });
    expect(result.metrics).toEqual({
      revenueGrowth: [25, 20],
      netIncome: [25, 30, 35],
      freeCashFlow: [33, 37, 40],
      profitMargin: null,
      debtLevel: 0.4,
      roe: 0.25,
      peRatio: 20,
      industryAvgPe: null,
    });
    expect(result.quote).toBeNull();
    expect(result.sources).toEqual(["tushare:fundamentals"]);
    expect(tushareRequestBodies.some(
      (body) => body.includes('"api_name":"income"') && body.includes('"ts_code":"600519.SH"')
    )).toBe(true);
  });

  it("maps malformed Tushare rows to a provider unavailable error", async () => {
    process.env.TUSHARE_TOKEN = "test-tushare-token";
    const tusharePayloads: Record<string, unknown> = {
      stock_basic: {
        code: 0,
        data: { fields: ["ts_code", "name", "industry"], items: [["600519.SH", "贵州茅台", "白酒"]] },
      },
      income: {
        code: 0,
        data: {
          fields: ["end_date", "total_revenue", "n_income"],
          items: [["2025-12-31", 150, 35, "unexpected"]],
        },
      },
      cashflow: {
        code: 0,
        data: { fields: ["end_date", "n_cashflow_act", "c_pay_acq_const_fiolta"], items: [["2025-12-31", 50, -10]] },
      },
      balancesheet: {
        code: 0,
        data: { fields: ["end_date", "total_assets", "total_liab"], items: [["2025-12-31", 100, 40]] },
      },
      fina_indicator: {
        code: 0,
        data: { fields: ["end_date", "roe"], items: [["2025-12-31", 0.25]] },
      },
      daily_basic: {
        code: 0,
        data: { fields: ["trade_date", "pe_ttm"], items: [["2025-12-31", 20]] },
      },
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const body: unknown = await request.json();
      const apiName = typeof body === "object"
        && body !== null
        && "api_name" in body
        && typeof body.api_name === "string"
        ? body.api_name
        : null;
      const payload = apiName === null ? undefined : tusharePayloads[apiName];
      return payload === undefined
        ? new Response("Unexpected Tushare endpoint", { status: 400 })
        : jsonResponse(payload);
    });

    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_PROVIDER_UNAVAILABLE",
    });
  });
});
