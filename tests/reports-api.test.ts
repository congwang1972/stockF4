jest.mock("@/services/report/report-service", () => ({
  createReport: jest.fn(),
  updateReportContent: jest.fn(),
  markReportAsFailed: jest.fn(),
}));

jest.mock("@/services/stock/financial-data", () => ({
  fetchFinancialData: jest.fn(),
}));

jest.mock("@/services/llm/report-generator", () => ({
  generateReportContent: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/reports/route";
import { ExternalServiceError } from "@/services/external-service-error";
import { fetchFinancialData, type FinancialData } from "@/services/stock/financial-data";
import { generateReportContent } from "@/services/llm/report-generator";
import {
  createReport,
  markReportAsFailed,
  updateReportContent,
} from "@/services/report/report-service";
import type { Report, ReportContent } from "@/types/report";

const reportContent: ReportContent = {
  business_model: "业务模式分析",
  financial_analysis: "财务分析",
  competitive_advantage: "竞争优势",
  valuation: "估值分析",
  risk_analysis: "风险分析",
  growth_potential: "增长潜力",
  institutional_perspective: "机构视角",
  bull_bear_debate: "多空讨论",
};

const financialData: FinancialData = {
  profile: {
    name: "Apple Inc",
    sector: "Technology",
    description: "Consumer electronics company",
  },
  metrics: {
    revenueGrowth: [12.5],
    netIncome: [100],
    freeCashFlow: [80],
    profitMargin: 0.2,
    debtLevel: 0.35,
    roe: 0.18,
    peRatio: 25,
    industryAvgPe: null,
  },
  quote: {
    price: 210.5,
    currency: "USD",
    updatedAt: "2026-09-10T00:00:00.000Z",
  },
  sources: ["alpha-vantage:fundamentals", "qt.gtimg.cn:quote"],
};

function createPendingReport(id: string): Report {
  return {
    id,
    ticker: "AAPL",
    market: "US",
    companyName: null,
    status: "pending",
    content: null,
    dataSources: null,
    shareToken: null,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  };
}

function createReportRequest(ticker: string): NextRequest {
  return new NextRequest("http://localhost/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });
}

describe("POST /api/reports", () => {
  const createReportMock = jest.mocked(createReport);
  const updateReportContentMock = jest.mocked(updateReportContent);
  const markReportAsFailedMock = jest.mocked(markReportAsFailed);
  const fetchFinancialDataMock = jest.mocked(fetchFinancialData);
  const generateReportContentMock = jest.mocked(generateReportContent);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persists the real data sources and company name after generating a report", async () => {
    createReportMock.mockResolvedValue(createPendingReport("report-1"));
    fetchFinancialDataMock.mockResolvedValue(financialData);
    generateReportContentMock.mockResolvedValue(reportContent);

    const response = await POST(createReportRequest("AAPL"));

    expect(response.status).toBe(201);
    expect(generateReportContentMock).toHaveBeenCalledWith({
      ticker: "AAPL",
      market: "US",
      profile: financialData.profile,
      metrics: financialData.metrics,
      quote: financialData.quote,
    });
    expect(updateReportContentMock).toHaveBeenCalledWith(
      "report-1",
      expect.any(Object),
      ["alpha-vantage:fundamentals", "qt.gtimg.cn:quote"],
      "Apple Inc"
    );
  });

  it("marks a created report failed and returns the external service status", async () => {
    createReportMock.mockResolvedValue(createPendingReport("report-2"));
    fetchFinancialDataMock.mockRejectedValue(
      new ExternalServiceError("DATA_PROVIDER_UNAVAILABLE", "美股数据服务暂不可用")
    );

    const response = await POST(createReportRequest("AAPL"));
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(markReportAsFailedMock).toHaveBeenCalledWith("report-2");
    expect(body).toMatchObject({
      success: false,
      error: { code: "DATA_PROVIDER_UNAVAILABLE" },
    });
  });
});
