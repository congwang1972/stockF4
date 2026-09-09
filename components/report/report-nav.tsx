"use client";

import { ReportContent } from "@/types/report";

const sectionLabels: (keyof ReportContent)[] = [
  "business_model",
  "financial_analysis",
  "competitive_advantage",
  "valuation",
  "risk_analysis",
  "growth_potential",
  "institutional_perspective",
  "bull_bear_debate",
];

const sectionTitles: Record<keyof ReportContent, string> = {
  business_model: "商业模式",
  financial_analysis: "财务分析",
  competitive_advantage: "竞争优势",
  valuation: "估值分析",
  risk_analysis: "风险分析",
  growth_potential: "增长潜力",
  institutional_perspective: "机构视角",
  bull_bear_debate: "多空辩论",
};

export function ReportNav() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <nav className="sticky top-4 rounded-xl bg-white p-4 shadow">
      <h3 className="mb-3 font-semibold text-text-primary">章节导航</h3>
      <ul className="space-y-2">
        {sectionLabels.map((key) => (
          <li key={key}>
            <button
              onClick={() => scrollToSection(key)}
              className="text-left text-sm text-text-secondary transition hover:text-accent"
            >
              {sectionTitles[key]}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
