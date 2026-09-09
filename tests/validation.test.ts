import { validateTicker } from "@/lib/utils/validation";

describe("validateTicker", () => {
  it("should accept valid US stock ticker", () => {
    const result = validateTicker("AAPL");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticker).toBe("AAPL");
    }
  });

  it("should accept valid HK stock ticker", () => {
    const result = validateTicker("00700.HK");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticker).toBe("00700.HK");
    }
  });

  it("should reject empty ticker", () => {
    const result = validateTicker("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("不能为空");
    }
  });

  it("should reject ticker with illegal characters", () => {
    const result = validateTicker("AAPL<script>");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("非法字符");
    }
  });

  it("should convert lowercase ticker to uppercase", () => {
    const result = validateTicker("aapl");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticker).toBe("AAPL");
    }
  });
});
