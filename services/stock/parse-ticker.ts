import { Market } from "@/types/report";

export interface ParsedTicker {
  ticker: string;
  market: Market;
}

export function parseTicker(input: string): ParsedTicker {
  const normalized = input.trim().toUpperCase();

  if (/^\d{6}$/.test(normalized)) {
    return { ticker: normalized, market: "CN" };
  }

  if (/^\d{4,5}(\.HK)?$/i.test(normalized)) {
    const ticker = normalized.replace(/\.HK$/i, "");
    return { ticker, market: "HK" };
  }

  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return { ticker: normalized, market: "US" };
  }

  return { ticker: normalized, market: "UNKNOWN" };
}
