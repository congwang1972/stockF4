"use client";

import { useState } from "react";

interface StockTickerInputProps {
  onSubmit: (ticker: string) => void;
  isLoading: boolean;
}

export function StockTickerInput({ onSubmit, isLoading }: StockTickerInputProps) {
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = ticker.trim();

    if (!trimmed) {
      setError("请输入股票代码");
      return;
    }

    if (!/^[A-Za-z0-9\.\-]+$/.test(trimmed)) {
      setError("股票代码包含非法字符");
      return;
    }

    setError(null);
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="flex gap-2">
        <input
          type="text"
          value={ticker}
          onChange={(event) => setTicker(event.target.value)}
          placeholder="如 AAPL / 00700.HK / 600519"
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          {isLoading ? "生成中..." : "分析"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
