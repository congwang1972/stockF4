import { notFound } from "next/navigation";
import { ReportNav } from "@/components/report/report-nav";
import { ReportSection } from "@/components/report/report-section";
import { ApiResponse, Report, ReportContent } from "@/types/report";

interface ReportPageProps {
  params: { id: string };
}

const sectionTitles: Record<keyof ReportContent, string> = {
  business_model: "1. 商业模式和收入来源",
  financial_analysis: "2. 财务健康状况",
  competitive_advantage: "3. 竞争优势与护城河",
  valuation: "4. 估值分析",
  risk_analysis: "5. 风险分析",
  growth_potential: "6. 增长潜力",
  institutional_perspective: "7. 机构投资者视角",
  bull_bear_debate: "8. 多空辩论与展望",
};

async function fetchReport(id: string): Promise<Report | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/reports/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) return null;

  const result = (await response.json()) as ApiResponse<Report | null>;
  return result.data;
}

export default async function ReportPage({ params }: ReportPageProps) {
  const report = await fetchReport(params.id);

  if (!report || !report.content) {
    notFound();
  }

  const content = report.content;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-primary">
          {report.companyName ?? report.ticker} ({report.ticker})
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          市场：{report.market} · 生成时间：{new Date(report.createdAt).toLocaleString("zh-CN")}
        </p>
        <p className="mt-3 text-xs text-text-secondary">
          本报告仅供参考，不构成投资建议。
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <ReportNav />
        </aside>

        <div className="space-y-6">
          {(Object.keys(sectionTitles) as (keyof ReportContent)[]).map((key) => (
            <ReportSection
              key={key}
              id={key}
              title={sectionTitles[key]}
              content={content[key]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
