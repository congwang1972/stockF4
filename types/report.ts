export type Market = "US" | "HK" | "CN" | "UNKNOWN";

export type ReportStatus = "pending" | "completed" | "failed";

export interface ReportContent {
  business_model: string;
  financial_analysis: string;
  competitive_advantage: string;
  valuation: string;
  risk_analysis: string;
  growth_potential: string;
  institutional_perspective: string;
  bull_bear_debate: string;
}

export interface Report {
  id: string;
  ticker: string;
  market: Market;
  companyName: string | null;
  status: ReportStatus;
  content: ReportContent | null;
  dataSources: string[] | null;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportRequest {
  ticker: string;
}

export interface CreateReportResponse {
  id: string;
  ticker: string;
  status: ReportStatus;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
  meta: {
    timestamp: string;
    requestId: string;
  };
}
