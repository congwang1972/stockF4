import { NextRequest, NextResponse } from "next/server";
import { validateTicker } from "@/lib/utils/validation";
import { parseTicker } from "@/services/stock/parse-ticker";
import { fetchFinancialData } from "@/services/stock/financial-data";
import { generateReportContent } from "@/services/llm/report-generator";
import {
  createReport,
  markReportAsFailed,
  updateReportContent,
} from "@/services/report/report-service";
import { ExternalServiceError } from "@/services/external-service-error";
import { ApiResponse, CreateReportResponse } from "@/types/report";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<CreateReportResponse>>> {
  const requestId = crypto.randomUUID();
  let createdReportId: string | null = null;

  try {
    const body = (await request.json()) as { ticker?: unknown };
    const validation = validateTicker(body.ticker);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          data: null as unknown as CreateReportResponse,
          error: { code: "INVALID_TICKER", message: validation.error },
          meta: { timestamp: new Date().toISOString(), requestId },
        },
        { status: 400 }
      );
    }

    const parsed = parseTicker(validation.ticker);

    if (parsed.market === "UNKNOWN") {
      return NextResponse.json(
        {
          success: false,
          data: null as unknown as CreateReportResponse,
          error: { code: "UNKNOWN_MARKET", message: "无法识别该股票代码所属市场" },
          meta: { timestamp: new Date().toISOString(), requestId },
        },
        { status: 400 }
      );
    }

    const report = await createReport({
      ticker: parsed.ticker,
      market: parsed.market,
    });
    createdReportId = report.id;

    const financialData = await fetchFinancialData(parsed.ticker, parsed.market);
    const content = await generateReportContent({
      ticker: parsed.ticker,
      market: parsed.market,
      profile: financialData.profile,
      metrics: financialData.metrics,
      quote: financialData.quote,
    });

    await updateReportContent(
      report.id,
      content,
      financialData.sources,
      financialData.profile.name
    );

    return NextResponse.json(
      {
        success: true,
        data: { id: report.id, ticker: parsed.ticker, status: "completed" },
        error: null,
        meta: { timestamp: new Date().toISOString(), requestId },
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdReportId !== null) {
      try {
        await markReportAsFailed(createdReportId);
      } catch {
        return NextResponse.json(
          {
            success: false,
            data: null as unknown as CreateReportResponse,
            error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
            meta: { timestamp: new Date().toISOString(), requestId },
          },
          { status: 500 }
        );
      }
    }

    if (error instanceof ExternalServiceError) {
      return NextResponse.json(
        {
          success: false,
          data: null as unknown as CreateReportResponse,
          error: { code: error.code, message: error.message },
          meta: { timestamp: new Date().toISOString(), requestId },
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        data: null as unknown as CreateReportResponse,
        error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
        meta: { timestamp: new Date().toISOString(), requestId },
      },
      { status: 500 }
    );
  }
}
