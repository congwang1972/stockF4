export type ExternalServiceErrorCode =
  | "DATA_PROVIDER_NOT_CONFIGURED"
  | "DATA_PROVIDER_UNAVAILABLE"
  | "DATA_NOT_AVAILABLE"
  | "MARKET_NOT_SUPPORTED"
  | "LLM_NOT_CONFIGURED"
  | "LLM_UNAVAILABLE"
  | "LLM_INVALID_RESPONSE";

const statusByCode: Record<ExternalServiceErrorCode, number> = {
  DATA_PROVIDER_NOT_CONFIGURED: 503,
  DATA_PROVIDER_UNAVAILABLE: 503,
  DATA_NOT_AVAILABLE: 422,
  MARKET_NOT_SUPPORTED: 422,
  LLM_NOT_CONFIGURED: 503,
  LLM_UNAVAILABLE: 503,
  LLM_INVALID_RESPONSE: 502,
};

export class ExternalServiceError extends Error {
  public readonly status: number;

  constructor(
    public readonly code: ExternalServiceErrorCode,
    message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
    this.name = "ExternalServiceError";
    this.status = statusByCode[code];
  }
}
