import { z } from "zod";
import { ExternalServiceError } from "@/services/external-service-error";
import type {
  CompanyProfile,
  FinancialMetrics,
  StockQuote,
} from "@/services/stock/financial-data";
import type { Market, ReportContent } from "@/types/report";

const reportSectionSchema = z.string()
  .max(2_000)
  .refine((value) => value.trim().length > 0);

const reportContentSchema = z.object({
  business_model: reportSectionSchema,
  financial_analysis: reportSectionSchema,
  competitive_advantage: reportSectionSchema,
  valuation: reportSectionSchema,
  risk_analysis: reportSectionSchema,
  growth_potential: reportSectionSchema,
  institutional_perspective: reportSectionSchema,
  bull_bear_debate: reportSectionSchema,
}).strict();

const systemPrompt = `你是一名股票研究报告撰写助手。仅使用用户消息中提供的结构化输入；不得编造事实、数值、行业平均值或参考资料。对于 null、空数组、空字符串或缺失的数据，必须明确说明数据不足。不得提供投资建议。只返回一个 JSON 对象，不要包含 Markdown、解释或其他文本。对象必须且只能包含以下八个键，且每个值必须是简体中文的非空字符串：business_model、financial_analysis、competitive_advantage、valuation、risk_analysis、growth_potential、institutional_perspective、bull_bear_debate。`;

export interface ReportGenerationInput {
  ticker: string;
  market: Exclude<Market, "UNKNOWN">;
  profile: CompanyProfile;
  metrics: FinancialMetrics;
  quote: StockQuote | null;
}

function nonEmptyEnvironmentValue(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function unavailable(): ExternalServiceError {
  return new ExternalServiceError("LLM_UNAVAILABLE", "通义模型服务暂不可用");
}

function invalidResponse(): ExternalServiceError {
  return new ExternalServiceError("LLM_INVALID_RESPONSE", "通义模型服务返回内容无效");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractReportContent(payload: unknown): ReportContent {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) throw invalidResponse();
  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) throw invalidResponse();
  const content = firstChoice.message.content;
  if (typeof content !== "string") throw invalidResponse();

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    throw invalidResponse();
  }

  const result = reportContentSchema.safeParse(parsedContent);
  if (!result.success) throw invalidResponse();
  return result.data;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function fetchWithRetry(
  url: string,
  init: RequestInit
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < MAX_RETRIES - 1) await delay(RETRY_DELAY_MS);
  }
  throw lastError;
}

export async function generateReportContent(input: ReportGenerationInput): Promise<ReportContent> {
  const apiKey = nonEmptyEnvironmentValue(process.env.DASHSCOPE_API_KEY);
  const baseUrl = nonEmptyEnvironmentValue(process.env.DASHSCOPE_BASE_URL);
  if (apiKey === null || baseUrl === null) {
    throw new ExternalServiceError("LLM_NOT_CONFIGURED", "通义模型服务未配置");
  }
  const model = nonEmptyEnvironmentValue(process.env.DASHSCOPE_MODEL) ?? "qwen-plus";

  let response: Response;
  try {
    response = await fetchWithRetry(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw unavailable();
  }

  if (!response.ok) throw unavailable();

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw unavailable();
  }

  return extractReportContent(payload);
}
