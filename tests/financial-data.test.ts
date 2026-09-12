import { fetchFinancialData } from "@/services/stock/financial-data";

const yahooQuoteSummaryResponse = {
  quoteSummary: {
    result: [
      {
        price: {
          longName: { raw: "Apple Inc.", fmt: "Apple Inc." },
          shortName: { raw: "Apple", fmt: "Apple" },
          currency: { raw: "USD", fmt: "USD" },
        },
        summaryProfile: {
          sector: { raw: "Technology", fmt: "Technology" },
          longBusinessSummary: { raw: "Consumer electronics company", fmt: "Consumer electronics company" },
        },
        financialData: {
          profitMargins: { raw: 0.25, fmt: "25.00%" },
          returnOnEquity: { raw: 1.5, fmt: "150.00%" },
          trailingPE: { raw: 30.2, fmt: "30.2" },
        },
        defaultKeyStatistics: {
          trailingPE: { raw: 30.2, fmt: "30.2" },
        },
        incomeStatementHistory: {
          incomeStatementHistory: [
            {
              endDate: { raw: 1696032000, fmt: "2023-09-30" },
              totalRevenue: { raw: 100000000, fmt: "100M" },
              netIncome: { raw: 25000000, fmt: "25M" },
            },
            {
              endDate: { raw: 1727654400, fmt: "2024-09-30" },
              totalRevenue: { raw: 125000000, fmt: "125M" },
              netIncome: { raw: 30000000, fmt: "30M" },
            },
            {
              endDate: { raw: 1759190400, fmt: "2025-09-30" },
              totalRevenue: { raw: 150000000, fmt: "150M" },
              netIncome: { raw: 35000000, fmt: "35M" },
            },
          ],
        },
        balanceSheetHistory: {
          balanceSheetStatements: [
            {
              endDate: { raw: 1759190400, fmt: "2025-09-30" },
              totalAssets: { raw: 100000000, fmt: "100M" },
              totalLiab: { raw: 40000000, fmt: "40M" },
            },
          ],
        },
        cashflowStatementHistory: {
          cashflowStatements: [
            {
              endDate: { raw: 1696032000, fmt: "2023-09-30" },
              totalCashFromOperatingActivities: { raw: 40000000, fmt: "40M" },
              capitalExpenditures: { raw: -7000000, fmt: "-7M" },
            },
            {
              endDate: { raw: 1727654400, fmt: "2024-09-30" },
              totalCashFromOperatingActivities: { raw: 45000000, fmt: "45M" },
              capitalExpenditures: { raw: -8000000, fmt: "-8M" },
            },
            {
              endDate: { raw: 1759190400, fmt: "2025-09-30" },
              totalCashFromOperatingActivities: { raw: 50000000, fmt: "50M" },
              capitalExpenditures: { raw: -10000000, fmt: "-10M" },
            },
          ],
        },
      },
    ],
  },
};

const yahooChartResponse = {
  chart: {
    result: [
      {
        meta: {
          regularMarketPrice: { raw: 210.5 },
          currency: "USD",
        },
      },
    ],
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("fetchFinancialData", () => {
  let originalFetch: typeof fetch;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps Yahoo Finance US fundamentals and quote", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v10/finance/quoteSummary/")) {
        return Promise.resolve(jsonResponse(yahooQuoteSummaryResponse));
      }
      if (url.includes("/v8/finance/chart/")) {
        return Promise.resolve(jsonResponse(yahooChartResponse));
      }
      return Promise.reject(new Error("Unexpected URL"));
    });

    const result = await fetchFinancialData("AAPL", "US");

    expect(result.profile).toEqual({
      name: "Apple Inc.",
      sector: "Technology",
      description: "Consumer electronics company",
    });
    expect(result.metrics.revenueGrowth).toEqual([25, 20]);
    expect(result.metrics.netIncome).toEqual([25000000, 30000000, 35000000]);
    expect(result.metrics.profitMargin).toBe(0.25);
    expect(result.metrics.debtLevel).toBe(0.4);
    expect(result.metrics.roe).toBe(1.5);
    expect(result.metrics.peRatio).toBe(30.2);
    expect(result.quote).toMatchObject({ price: 210.5, currency: "USD" });
    expect(result.sources).toEqual(["yahoo-finance:fundamentals", "yahoo-finance:quote"]);
  });

  it("converts A-share ticker to Yahoo format (Shanghai)", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("600519.SS");
      if (url.includes("/v10/finance/quoteSummary/")) {
        return Promise.resolve(jsonResponse(yahooQuoteSummaryResponse));
      }
      return Promise.resolve(jsonResponse(yahooChartResponse));
    });

    await fetchFinancialData("600519", "CN");
  });

  it("converts A-share ticker to Yahoo format (Shenzhen)", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("000001.SZ");
      if (url.includes("/v10/finance/quoteSummary/")) {
        return Promise.resolve(jsonResponse(yahooQuoteSummaryResponse));
      }
      return Promise.resolve(jsonResponse(yahooChartResponse));
    });

    await fetchFinancialData("000001", "CN");
  });

  it("converts HK ticker to Yahoo format", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("0700.HK");
      if (url.includes("/v10/finance/quoteSummary/")) {
        return Promise.resolve(jsonResponse(yahooQuoteSummaryResponse));
      }
      return Promise.resolve(jsonResponse(yahooChartResponse));
    });

    await fetchFinancialData("00700", "HK");
  });

  it("returns fundamentals when quote retrieval fails", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v10/finance/quoteSummary/")) {
        return Promise.resolve(jsonResponse(yahooQuoteSummaryResponse));
      }
      return Promise.reject(new Error("Quote service unavailable"));
    });

    const result = await fetchFinancialData("AAPL", "US");

    expect(result.quote).toBeNull();
    expect(result.sources).toEqual(["yahoo-finance:fundamentals"]);
  });

  it("maps Yahoo Finance non-success response to provider unavailable error", async () => {
    fetchMock.mockResolvedValue(new Response("Service unavailable", { status: 503 }));

    await expect(fetchFinancialData("AAPL", "US")).rejects.toMatchObject({
      code: "DATA_PROVIDER_UNAVAILABLE",
    });
  });

  it("maps empty Yahoo Finance result to data not available error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      quoteSummary: { result: [] },
    }));

    await expect(fetchFinancialData("INVALID", "US")).rejects.toMatchObject({
      code: "DATA_NOT_AVAILABLE",
    });
  });

  it("maps missing company name to data not available error", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v10/finance/quoteSummary/")) {
        return Promise.resolve(jsonResponse({
          quoteSummary: {
            result: [{
              price: {},
              summaryProfile: {},
              financialData: {},
              incomeStatementHistory: { incomeStatementHistory: [] },
              balanceSheetHistory: { balanceSheetStatements: [] },
              cashflowStatementHistory: { cashflowStatements: [] },
            }],
          },
        }));
      }
      return Promise.resolve(jsonResponse(yahooChartResponse));
    });

    await expect(fetchFinancialData("UNKNOWN", "US")).rejects.toMatchObject({
      code: "DATA_NOT_AVAILABLE",
    });
  });
});
