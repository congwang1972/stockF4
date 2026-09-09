import { PrismaClient, Prisma } from "@prisma/client";
import { Report, ReportStatus } from "@/types/report";

const prisma = new PrismaClient();

export async function createReport(input: {
  ticker: string;
  market: string;
  companyName?: string;
}): Promise<Report> {
  const report = await prisma.report.create({
    data: {
      ticker: input.ticker,
      market: input.market,
      companyName: input.companyName ?? null,
      status: "pending",
    },
  });

  return mapReport(report);
}

export async function updateReportContent(
  id: string,
  content: Report["content"],
  dataSources: string[]
): Promise<Report> {
  const report = await prisma.report.update({
    where: { id },
    data: {
      status: "completed",
      content: (content as unknown as Prisma.InputJsonValue) ?? undefined,
      dataSources: dataSources,
    },
  });

  return mapReport(report);
}

export async function getReportById(id: string): Promise<Report | null> {
  const report = await prisma.report.findFirst({
    where: { id, isDeleted: false },
  });

  if (!report) return null;

  return mapReport(report);
}

function mapReport(dbReport: {
  id: string;
  ticker: string;
  market: string;
  companyName: string | null;
  status: string;
  content: unknown;
  dataSources: unknown;
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Report {
  return {
    id: dbReport.id,
    ticker: dbReport.ticker,
    market: dbReport.market as Report["market"],
    companyName: dbReport.companyName,
    status: dbReport.status as ReportStatus,
    content: dbReport.content as Report["content"],
    dataSources: dbReport.dataSources as string[] | null,
    shareToken: dbReport.shareToken,
    createdAt: dbReport.createdAt.toISOString(),
    updatedAt: dbReport.updatedAt.toISOString(),
  };
}
