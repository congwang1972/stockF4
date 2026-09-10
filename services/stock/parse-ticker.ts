import { Market } from "@/types/report";

export interface ParsedTicker {
  ticker: string;
  market: Market;
}

export function parseTicker(input: string): ParsedTicker {
  const normalized = input.trim().toUpperCase();
  const cnMatch = normalized.match(/^(\d{6})(?:\.(SH|SZ))?$/);

  if (cnMatch) {
    return { ticker: cnMatch[1], market: "CN" };
  }

  if (/^\d{4,5}(\.HK)?$/.test(normalized)) {
    const ticker = normalized.replace(/\.HK$/, "");
    return { ticker, market: "HK" };
  }

  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return { ticker: normalized, market: "US" };
  }

  return { ticker: normalized, market: "UNKNOWN" };
}
