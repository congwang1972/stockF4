import { FinancialMetrics, CompanyProfile } from "@/services/stock/financial-data";
import { ReportContent } from "@/types/report";

export interface ReportGenerationInput {
  ticker: string;
  market: string;
  profile: CompanyProfile;
  metrics: FinancialMetrics;
}

export async function generateReportContent(input: ReportGenerationInput): Promise<ReportContent> {
  // TODO: replace with actual LLM API call using parameterized prompts
  const { ticker, profile, metrics } = input;

  return {
    business_model: `${profile.name}(${ticker}) 主要从事 ${profile.sector} 业务，收入来源于产品销售与服务。`,
    financial_analysis: `最近五年收入趋势为 ${metrics.revenueGrowth.join(", ")}%，净利润稳步增长，自由现金流健康。`,
    competitive_advantage: `公司拥有品牌实力与成本优势，护城河评分 7/10。`,
    valuation: `当前 P/E 为 ${metrics.peRatio}，行业平均为 ${metrics.industryAvgPe}，估值处于合理区间。`,
    risk_analysis: `主要风险包括宏观经济波动、行业竞争加剧与监管政策变化。`,
    growth_potential: `未来 5-10 年有望受益于市场规模扩大与新产品发布，增长潜力中等偏上。`,
    institutional_perspective: `机构可能关注其稳定的现金流与行业龙头地位，但也担忧估值压力。`,
    bull_bear_debate: `看涨观点：基本面稳健、现金流强劲；看跌观点：增长放缓、估值偏高。综合判断为中性偏多。`,
  };
}
