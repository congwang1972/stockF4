"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StockTickerInput } from "@/components/home/stock-ticker-input";
import { CreateReportResponse } from "@/types/report";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (ticker: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message ?? "生成报告失败");
        return;
      }

      const data = result.data as CreateReportResponse;
      router.push(`/report/${data.id}`);
    } catch (err) {
      setError("网络错误，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="mb-3 text-3xl font-bold text-primary md:text-4xl">
          华尔街式股票分析
        </h1>
        <p className="text-text-secondary">
          输入股票代码，获取专业、系统的公司研究报告
        </p>
      </div>

      <StockTickerInput onSubmit={handleSubmit} isLoading={isLoading} />

      {error && (
        <div className="mt-4 rounded-lg bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white/90 p-3 text-center text-xs text-text-secondary backdrop-blur">
        本报告仅供参考，不构成投资建议。投资有风险，决策需谨慎。
      </div>
    </main>
  );
}
