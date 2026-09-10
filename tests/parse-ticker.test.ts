import { parseTicker } from "@/services/stock/parse-ticker";

describe("parseTicker", () => {
  it("should parse US ticker", () => {
    const result = parseTicker("AAPL");
    expect(result.ticker).toBe("AAPL");
    expect(result.market).toBe("US");
  });

  it("should parse HK ticker with suffix", () => {
    const result = parseTicker("00700.HK");
    expect(result.ticker).toBe("00700");
    expect(result.market).toBe("HK");
  });

  it("should parse HK ticker without suffix", () => {
    const result = parseTicker("00700");
    expect(result.ticker).toBe("00700");
    expect(result.market).toBe("HK");
  });

  it("should parse CN ticker", () => {
    const result = parseTicker("600519");
    expect(result.ticker).toBe("600519");
    expect(result.market).toBe("CN");
  });

  it("should return UNKNOWN for invalid ticker", () => {
    const result = parseTicker("@@@");
    expect(result.market).toBe("UNKNOWN");
  });

  it.each([
    ["600519.SH", "600519"],
    ["000001.SZ", "000001"],
  ])("should parse %s as a CN ticker", (input, ticker) => {
    expect(parseTicker(input)).toEqual({ ticker, market: "CN" });
  });
});
