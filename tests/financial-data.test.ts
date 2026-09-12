import { fetchFinancialData } from "@/services/stock/financial-data";

const tencentQuoteCN = 'v_sh600519="1~贵州茅台~600519~1275.16~1285.13~1285.15~34801~16486~18315~1275.16~9~1275.13~1~1275.12~1~1275.10~4~1275.05~1~1276.00~14~1276.13~1~1276.15~2~1276.23~1~1276.46~1~~20260911161500~-9.97~-0.78~1286.15~1263.01~1275.16/34801/4430841445~34801~443084~0.28~19.57~~1286.15~1263.01~1.80~15940.54~15940.54~6.34~1413.64~1156.62~1.25~-3~1273.18~17.90~19.36~~~0.08~443084.1445~191.2740~15~   A~GP-A~-5.48~-4.12~4.08~32.41~27.30~1539.98~1151.01~-1.71~-4.98~7.43~1250081601~1250081601~-8.57~-6.92~1250081601~~~-13.34~-0.10~~CNY~0~___D__F__N~1275.00~123~";';

const tencentQuoteUS = 'v_usAAPL="51~Apple Inc~AAPL~210.5~209.0~209.5~12345~1000~2000~210.5~9~210.0~1~210.0~1~210.0~4~210.0~1~211.0~14~211.0~1~211.0~2~211.0~1~211.0~1~~20260911160000~1.5~0.72~211.0~208.0~210.5/12345/1234567~12345~123456~0.5~30.2~~211.0~208.0~1.5~28000.0~28000.0~6.34~180.0~150.0~1.25~-3~209.0~17.90~19.36~~~0.08~123456.7~191.2740~15~~~GP-A~~~32.41~27.30~~~-1.71~-4.98~7.43~1250081601~1250081601~~~1250081601~~~-13.34~-0.10~~USD~0~";';

const tencentQuoteHK = 'v_hk00700="1~腾讯控股~00700~380.0~378.0~379.0~5000~100~200~380.0~9~379.0~1~379.0~1~379.0~4~379.0~1~381.0~14~381.0~1~381.0~2~381.0~1~381.0~1~~20260911160000~2.0~0.53~382.0~376.0~380.0/5000/500000~5000~50000~0.5~25.0~~382.0~376.0~1.5~36000.0~36000.0~6.34~320.0~280.0~1.25~-3~378.0~17.90~19.36~~~0.08~50000.0~191.2740~15~~~GP-A~~~32.41~27.30~~~-1.71~-4.98~7.43~1250081601~1250081601~~~1250081601~~~-13.34~-0.10~~HKD~0~";';

const eastMoneyFinancialResponse = {
  success: true,
  result: {
    data: [
      {
        REPORT_DATE: "2025-03-31",
        TOTAL_ASSETS: 250000000000,
        TOTAL_LIABILITIES: 80000000000,
        NETPROFIT_MARGIN: 52.3,
        ROE_WEIGHT: 28.5,
      },
    ],
  },
};

const eastMoneyIncomeResponse = {
  success: true,
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

function textResponse(text: string): Response {
  return new Response(text, { status: 200 });
}

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

  it("maps Tencent quote and East Money financials for A-share", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse(tencentQuoteCN));
      }
      if (url.includes("RPT_LICO_FN_CPD")) {
        return Promise.resolve(jsonResponse(eastMoneyFinancialResponse));
      }
      if (url.includes("RPT_DMSK_FN_INCOME")) {
        return Promise.resolve(jsonResponse(eastMoneyIncomeResponse));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    const result = await fetchFinancialData("600519", "CN");

    expect(result.profile.name).toBe("贵州茅台");
    expect(result.quote).toMatchObject({ price: 1275.16, currency: "CNY" });
    expect(result.metrics.peRatio).toBe(19.57);
    expect(result.metrics.roe).toBe(0.285);
    expect(result.metrics.profitMargin).toBe(0.523);
    expect(result.metrics.debtLevel).toBeCloseTo(80000000000 / 250000000000);
    expect(result.sources).toContain("qt.gtimg.cn:quote");
    expect(result.sources).toContain("eastmoney:financials");
    expect(result.sources).toContain("eastmoney:income");
  });

  it("converts Shanghai ticker to correct Tencent symbol", async () => {
    const requestedUrls: string[] = [];
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse(tencentQuoteCN));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    await fetchFinancialData("600519", "CN");
    expect(requestedUrls.some((url) => url.includes("qt.gtimg.cn/q=sh600519"))).toBe(true);
  });

  it("converts Shenzhen ticker to correct Tencent symbol", async () => {
    const requestedUrls: string[] = [];
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse(tencentQuoteCN));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    await fetchFinancialData("000001", "CN");
    expect(requestedUrls.some((url) => url.includes("qt.gtimg.cn/q=sz000001"))).toBe(true);
  });

  it("converts HK ticker to correct Tencent symbol", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse(tencentQuoteHK));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    const result = await fetchFinancialData("00700", "HK");
    expect(result.profile.name).toBe("腾讯控股");
    expect(result.quote?.currency).toBe("HKD");
  });

  it("converts US ticker to correct Tencent symbol", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse(tencentQuoteUS));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    const result = await fetchFinancialData("AAPL", "US");
    expect(result.profile.name).toBe("Apple Inc");
    expect(result.quote?.currency).toBe("USD");
  });

  it("calculates revenue growth correctly", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse(tencentQuoteCN));
      }
      if (url.includes("RPT_DMSK_FN_INCOME")) {
        return Promise.resolve(jsonResponse(eastMoneyIncomeResponse));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    const result = await fetchFinancialData("600519", "CN");
    expect(result.metrics.revenueGrowth.length).toBe(4);
    expect(result.metrics.revenueGrowth[0]).toBeCloseTo(((125000000000 - 105000000000) / 105000000000) * 100, 2);
    expect(result.metrics.netIncome.length).toBe(5);
  });

  it("throws data not available when Tencent quote has no company name", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse('v_sh600519="";'));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_NOT_AVAILABLE",
    });
  });

  it("returns quote=null when Tencent quote fails but still returns data", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    await expect(fetchFinancialData("600519", "CN")).rejects.toMatchObject({
      code: "DATA_NOT_AVAILABLE",
    });
  });

  it("returns financial data when East Money financials are unavailable", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse(tencentQuoteCN));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [] } }));
    });

    const result = await fetchFinancialData("600519", "CN");
    expect(result.profile.name).toBe("贵州茅台");
    expect(result.quote).toMatchObject({ price: 1275.16, currency: "CNY" });
    expect(result.sources).toEqual(["qt.gtimg.cn:quote"]);
    expect(result.metrics.revenueGrowth).toEqual([]);
    expect(result.metrics.netIncome).toEqual([]);
  });

  it("ignores East Money financial data when success is false", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("qt.gtimg.cn")) {
        return Promise.resolve(textResponse(tencentQuoteCN));
      }
      return Promise.resolve(jsonResponse({ success: false, result: { data: [{ REPORT_DATE: "2025-03-31" }] } }));
    });

    const result = await fetchFinancialData("600519", "CN");
    expect(result.sources).not.toContain("eastmoney:financials");
  });
});
