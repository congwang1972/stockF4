import {
  generateReportContent,
  type ReportGenerationInput,
} from "@/services/llm/report-generator";

const input: ReportGenerationInput = {
  ticker: "AAPL",
  market: "US",
  profile: {
    name: "测试公司",
    sector: "科技",
    description: "测试用企业描述",
  },
  metrics: {
    revenueGrowth: [12.5, 8.3],
    netIncome: [100, 120],
    freeCashFlow: [80, 95],
    profitMargin: 0.2,
    debtLevel: 0.35,
    roe: 0.18,
    peRatio: 25,
    industryAvgPe: null,
  },
  quote: null,
};

const reportContent = {
  business_model: "业务模式分析",
  financial_analysis: "财务分析",
  competitive_advantage: "竞争优势",
  valuation: "估值分析",
  risk_analysis: "风险分析",
  growth_potential: "增长潜力",
  institutional_perspective: "机构视角",
  bull_bear_debate: "多空讨论",
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("generateReportContent", () => {
  let originalFetch: typeof fetch;
  let originalApiKey: string | undefined;
  let originalBaseUrl: string | undefined;
  let originalModel: string | undefined;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalApiKey = process.env.DASHSCOPE_API_KEY;
    originalBaseUrl = process.env.DASHSCOPE_BASE_URL;
    originalModel = process.env.DASHSCOPE_MODEL;
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    global.fetch = fetchMock;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_BASE_URL;
    delete process.env.DASHSCOPE_MODEL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.DASHSCOPE_API_KEY;
    else process.env.DASHSCOPE_API_KEY = originalApiKey;
    if (originalBaseUrl === undefined) delete process.env.DASHSCOPE_BASE_URL;
    else process.env.DASHSCOPE_BASE_URL = originalBaseUrl;
    if (originalModel === undefined) delete process.env.DASHSCOPE_MODEL;
    else process.env.DASHSCOPE_MODEL = originalModel;
  });

  it("posts structured input to the configured DashScope chat endpoint and returns all report sections", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example/v1///";
    process.env.DASHSCOPE_MODEL = "test-qwen-model";
    fetchMock.mockResolvedValue(jsonResponse({
      choices: [{ message: { content: JSON.stringify(reportContent) } }],
    }));

    await expect(generateReportContent(input)).resolves.toEqual(reportContent);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://dashscope.example/v1/chat/completions");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.signal).toBeDefined();
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer test-dashscope-key");

    const requestBody: unknown = JSON.parse(String(requestInit?.body));
    expect(isRecord(requestBody)).toBe(true);
    if (!isRecord(requestBody)) throw new Error("请求体必须是对象");
    expect(requestBody.model).toBe("test-qwen-model");
    expect(requestBody.temperature).toBe(0.2);
    expect(requestBody.response_format).toEqual({ type: "json_object" });
    expect(requestBody.messages).toEqual(expect.arrayContaining([
      { role: "user", content: JSON.stringify(input) },
    ]));
  });

  it("maps a response missing a report section to LLM_INVALID_RESPONSE", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example/v1";
    const { bull_bear_debate: _, ...incompleteContent } = reportContent;
    fetchMock.mockResolvedValue(jsonResponse({
      choices: [{ message: { content: JSON.stringify(incompleteContent) } }],
    }));

    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_INVALID_RESPONSE",
    });
  });

  it("maps a whitespace-only report section to LLM_INVALID_RESPONSE", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example/v1";
    fetchMock.mockResolvedValue(jsonResponse({
      choices: [{ message: { content: JSON.stringify({
        ...reportContent,
        business_model: " \n ",
      }) } }],
    }));

    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_INVALID_RESPONSE",
      message: "通义模型服务返回内容无效",
    });
  });

  it("maps a response with an extra report section to LLM_INVALID_RESPONSE", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example/v1";
    fetchMock.mockResolvedValue(jsonResponse({
      choices: [{ message: { content: JSON.stringify({ ...reportContent, extra_section: "额外内容" }) } }],
    }));

    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_INVALID_RESPONSE",
    });
  });

  it("maps an overlong report section to LLM_INVALID_RESPONSE", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example/v1";
    fetchMock.mockResolvedValue(jsonResponse({
      choices: [{ message: { content: JSON.stringify({
        ...reportContent,
        business_model: "研".repeat(2_001),
      }) } }],
    }));

    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_INVALID_RESPONSE",
    });
  });

  it("maps a DashScope network failure to LLM_UNAVAILABLE", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example/v1";
    fetchMock.mockRejectedValue(new Error("Network unavailable"));

    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_UNAVAILABLE",
      message: "通义模型服务暂不可用",
    });
  });

  it("maps a DashScope non-success response to LLM_UNAVAILABLE", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example/v1";
    fetchMock.mockResolvedValue(new Response("Service unavailable", { status: 503 }));

    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_UNAVAILABLE",
      message: "通义模型服务暂不可用",
    });
  });

  it("maps an unreadable DashScope response body to LLM_UNAVAILABLE", async () => {
    process.env.DASHSCOPE_API_KEY = "test-dashscope-key";
    process.env.DASHSCOPE_BASE_URL = "https://dashscope.example/v1";
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_UNAVAILABLE",
      message: "通义模型服务暂不可用",
    });
  });

  it("maps missing DashScope configuration to LLM_NOT_CONFIGURED", async () => {
    await expect(generateReportContent(input)).rejects.toMatchObject({
      code: "LLM_NOT_CONFIGURED",
      message: "通义模型服务未配置",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
