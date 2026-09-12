import { fetchFinancialData } from "@/services/stock/financial-data";

const eastMoneyStockResponse = {
  data: {
    f43: 1800.5,
    f44: 1850.0,
    f45: 1780.0,
    f46: 1820.0,
    f47: 12345678,
    f48: 22500000000,
    f50: 1.5,
    f57: "600519",
    f58: "贵州茅台",
    f84: 1256197800,
    f85: 1256197800,
    f116: 2200000000000,
    f117: 2200000000000,
    f162: 35.2,
    f167: 28.5,
    f168: 0.8,
    f169: 20.5,
    f170: 1.15,
    f171: 0.02,
    f172: 0.03,
    f173: 0.04,
    f183: 250000000000,
    f184: 80000000000,
    f185: 170000000000,
    f186: 52.3,
    f187: 0.25,
    f188: 0.35,
    f189: 0.45,
    f190: 0.55,
    f191: 0.65,
    f192: 0.75,
    f127: "白酒",
  },
};

const eastMoneyIncomeResponse = {
  result: {
    data: [
      {
        REPORT_DATE: "2025-03-31",
        TOTAL_OPERATE_INCOME: 45000000000,
        NETPROFIT: 22000000000,
        NETCASH_OPERATE: 25000000000,
        BUY_FINANCE_PRODUCT: -2000000000,
      },
      {
        REPORT_DATE: "2024-12-31",
        TOTAL_OPERATE_INCOME: 170000000000,
        NETPROFIT: 85000000000,
        NETCASH_OPERATE: 90000000000,
        BUY_FINANCE_PRODUCT: -5000000000,
      },
      {
        REPORT_DATE: "2023-12-31",
        TOTAL_OPERATE_INCOME: 150000000000,
        NETPROFIT: 75000000000,
        NETCASH_OPERATE: 80000000000,
        BUY_FINANCE_PRODUCT: -4000000000,
      },
      {
        REPORT_DATE: "2022-12-31",
        TOTAL_OPERATE_INCOME: 125000000000,
        NETPROFIT: 62000000000,
        NETCASH_OPERATE: 70000000000,
        BUY_FINANCE_PRODUCT: -3500000000,
      },
      {
        REPORT_DATE: "2021-12-31",
        TOTAL_OPERATE_INCOME: 105000000000,
        NETPROFIT: 52000000000,
        NETCASH_OPERATE: 60000000000,
        BUY_FINANCE_PRODUCT: -3000000000,
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

  it("maps East Money A-share data correctly", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("push2.eastmoney.com")) {
        return Promise.resolve(jsonResponse(eastMoneyStockResponse));
      }
      if (url.includes("RPT_DMSK_FN_INCOME")) {
        return Promise.resolve(jsonResponse(eastMoneyIncomeResponse));
      }
      return Promise.resolve(jsonResponse({ result: { data: [] } }));
    });

    const result = await fetchFinancialData("600519", "CN");

    expect(result.profile.name).toBe("贵州茅台");
    expect(result.profile.sector).toBe("白酒");
    expect(result.quote).toMatchObject({ price: 1800.5, currency: "CNY" });
    expect(result.metrics.peRatio).toBe(35.2);
    expect(result.metrics.roe).toBe(0.285);
    expect(result.sources).toContain("eastmoney:stock");
  });

  it("converts Shanghai ticker to correct secid format", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("secid=1.600519");
      if (url.includes("push2.eastmoney.com")) {
        return Promise.resolve(jsonResponse(eastMoneyStockResponse));
      }
      return Promise.resolve(jsonResponse({ result: { data: [] } }));
    });

    await fetchFinancialData("600519", "CN");
  });

  it("converts Shenzhen ticker to correct secid format", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("secid=0.000001");
      if (url.includes("push2.eastmoney.com")) {
        return Promise.resolve(jsonResponse(eastMoneyStockResponse));
      }
      return Promise.resolve(jsonResponse({ result: { data: [] } }));
    });

    await fetchFinancialData("000001", "CN");
  });

  it("converts HK ticker to correct secid format", async () => {
    const hkResponse = {
      data: {
        ...eastMoneyStockResponse.data,
        f57: "00700",
        f58: "腾讯控股",
        f43: 380.0,
      },
    };

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("secid=116.00700");
      if (url.includes("push2.eastmoney.com")) {
        return Promise.resolve(jsonResponse(hkResponse));
      }
      return Promise.resolve(jsonResponse({ result: { data: [] } }));
    });

    const result = await fetchFinancialData("00700", "HK");
    expect(result.profile.name).toBe("腾讯控股");
    expect(result.quote?.currency).toBe("HKD");
  });

  it("converts US ticker to correct secid format", async () => {
    const usResponse = {
      data: {
        ...eastMoneyStockResponse.data,
        f57: "AAPL",
        f58: "苹果",
        f43: 210.5,
      },
    };

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("secid=105.AAPL");
      if (url.includes("push2.eastmoney.com")) {
        return Promise.resolve(jsonResponse(usResponse));
      }
      return Promise.resolve(jsonResponse({ result: { data: [] } }));
    });

    const result = await fetchFinancialData("AAPL", "US");
    expect(result.profile.name).toBe("苹果");
    expect(result.quote?.currency).toBe("USD");
  });

  it("calculates revenue growth correctly", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("push2.eastmoney.com")) {
        return Promise.resolve(jsonResponse(eastMoneyStockResponse));
      }
      if (url.includes("RPT_DMSK_FN_INCOME")) {
        return Promise.resolve(jsonResponse(eastMoneyIncomeResponse));
      }
      return Promise.resolve(jsonResponse({ result: { data: [] } }));
    });

    const result = await fetchFinancialData("600519", "CN");
    expect(result.metrics.revenueGrowth.length).toBeGreaterThan(0);
    expect(result.metrics.netIncome.length).toBeGreaterThan(0);
  });

  it("maps East Money non-success response to provider unavailable error", async () => {
    fetchMock.mockResolvedValue(new Response("Service unavailable", { status: 503 }));

    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_PROVIDER_UNAVAILABLE",
    });
  });

  it("maps empty East Money data to data not available error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: null }));

    await expect(fetchFinancialData("INVALID", "CN")).rejects.toMatchObject({
      code: "DATA_NOT_AVAILABLE",
    });
  });

  it("maps missing company name to data not available error", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("push2.eastmoney.com")) {
        return Promise.resolve(jsonResponse({ data: { f57: "600519" } }));
      }
      return Promise.resolve(jsonResponse({ result: { data: [] } }));
    });

    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_NOT_AVAILABLE",
    });
  });

  it("returns stock data when financial statements are unavailable", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("push2.eastmoney.com")) {
        return Promise.resolve(jsonResponse(eastMoneyStockResponse));
      }
      return Promise.resolve(jsonResponse({ result: { data: [] } }));
    });

    const result = await fetchFinancialData("600519", "CN");
    expect(result.profile.name).toBe("贵州茅台");
    expect(result.sources).toEqual(["eastmoney:stock"]);
  });
});
