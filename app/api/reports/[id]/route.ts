import { NextResponse } from "next/server";
import { getReportById } from "@/services/report/report-service";
import { ApiResponse, Report } from "@/types/report";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse<ApiResponse<Report | null>>> {
  const requestId = crypto.randomUUID();

  try {
    const report = await getReportById(params.id);

    if (!report) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: "REPORT_NOT_FOUND", message: "报告不存在" },
          meta: { timestamp: new Date().toISOString(), requestId },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: report,
        error: null,
        meta: { timestamp: new Date().toISOString(), requestId },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
        meta: { timestamp: new Date().toISOString(), requestId },
      },
      { status: 500 }
    );
  }
}
