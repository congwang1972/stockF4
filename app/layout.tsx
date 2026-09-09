import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "股票分析 - 华尔街式完整研究报告",
  description: "输入股票代码，获取专业、系统的公司研究报告",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-surface text-text-primary min-h-screen">{children}</body>
    </html>
  );
}
