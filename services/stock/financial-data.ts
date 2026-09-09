import { Market } from "@/types/report";

export interface FinancialMetrics {
  revenueGrowth: number[];
  netIncome: number[];
  freeCashFlow: number[];
  profitMargin: number;
  debtLevel: number;
  roe: number;
  peRatio: number;
  industryAvgPe: number;
}

export interface CompanyProfile {
  name: string;
  sector: string;
  description: string;
}

export async function fetchCompanyProfile(
  ticker: string,
  market: Market
): Promise<CompanyProfile> {
  // TODO: integrate with external financial data API
  return {
    name: `${ticker} Inc.`,
    sector: "Technology",
    description: `A leading company in its sector.`,
  };
}

export async function fetchFinancialMetrics(
  ticker: string,
  market: Market
): Promise<FinancialMetrics> {
  // TODO: integrate with external financial data API
  return {
    revenueGrowth: [10, 12, 8, 15, 11],
    netIncome: [100, 120, 110, 140, 130],
    freeCashFlow: [80, 95, 85, 110, 105],
    profitMargin: 0.25,
    debtLevel: 0.35,
    roe: 0.18,
    peRatio: 22.5,
    industryAvgPe: 25.0,
  };
}
