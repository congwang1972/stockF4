import { z } from "zod";

const tickerSchema = z
  .string()
  .min(1, "股票代码不能为空")
  .max(32, "股票代码长度不能超过 32 个字符")
  .regex(/^[A-Za-z0-9\.\-]+$/, "股票代码包含非法字符");

export function validateTicker(input: unknown): { success: true; ticker: string } | { success: false; error: string } {
  const result = tickerSchema.safeParse(input);

  if (!result.success) {
    return { success: false, error: result.error.errors[0].message };
  }

  return { success: true, ticker: result.data.toUpperCase() };
}
