# 股票分析功能测试计划与报告

> **版本**：v1.1<br>
> **日期**：2026-09-10<br>
> **状态**：Partially Verified<br>
> **作者**：QA Agent

---

## 1. 测试范围

### 1.1 覆盖范围

- 股票代码输入与格式校验，以及美股、港股、A 股（含 `.SH` / `.SZ` 后缀）市场解析。
- Alpha Vantage 美股基本面适配：资料、报表、指标映射、供应商异常与限流提示。
- Tushare A 股基本面适配：字段/行映射、年度报表过滤、ROE 单位转换与畸形响应。
- 腾讯 `qt.gtimg.cn` 非阻塞行情补充与失败降级。
- 港股基本面未接入时的 `MARKET_NOT_SUPPORTED` 受控错误。
- DashScope OpenAI-compatible Chat Completions 请求构造、八章节 JSON 严格校验与异常映射。
- 报告创建 API 对真实来源、公司名称、完成/失败状态及受控错误响应的编排。
- 报告获取 API、首页输入、报告页展示和章节导航的既有功能。

### 1.2 不测试范围

- 使用真实凭证时第三方供应商的可用性、额度、限流策略与数据准确性；该部分作为部署环境人工检查。
- LLM 生成文本的业务质量与投资结论；由产品/业务进行人工抽检。
- PDF / Markdown 导出、历史记录管理、性能压测与并发测试（均为后续迭代范围）。
- 未配置数据库与真实 API 凭证时的端到端报告生成。

---

## 2. 测试环境

- **前端环境**：Next.js 14.2.0。
- **后端环境**：Next.js API Routes（Node.js runtime）。
- **数据库**：PostgreSQL，通过 Prisma ORM 连接；本次自动化验证不连接真实数据库。
- **缓存**：Redis 配置已预留，本版本未启用。
- **测试框架**：Jest 29 + ts-jest；外部 HTTP 调用通过原生 `fetch` mock 覆盖。
- **静态检查**：TypeScript、ESLint 与 Next.js production build。

---

## 3. 测试策略

- **单元测试**：验证股票代码解析、金融数据映射、受控错误与 DashScope 响应 schema；所有第三方 HTTP 调用使用 mock，以确保可重复验证成功、错误、限流与畸形响应路径。
- **API 编排测试**：mock Prisma 报告服务与外部适配器，验证成功路径写入真实数据来源和公司名称，以及外部服务失败后将已创建报告标记为 `failed`。
- **集成测试**：配置测试 PostgreSQL 与真实 API 凭证后，执行报告创建、查询和供应商可用性人工检查。
- **E2E 测试**：在完整环境中通过浏览器验证首页输入到报告展示、错误提示和章节导航。
- **静态检查**：执行完整 Jest、TypeScript 类型检查、ESLint 和 production build。

---

## 4. 自动化测试用例

| 模块 | 用例描述 | 预期结果 | 状态 |
| :--- | :--- | :--- | :--- |
| validation | 合法代码、空值与非法字符校验 | 合法代码规范化；非法输入返回错误 | Pass |
| parse-ticker | 识别 US、HK、裸 A 股、`.SH`、`.SZ` 与未知代码 | 返回正确 `ticker` 与 `market` | Pass |
| financial-data / Alpha Vantage | 映射公司资料、年报与财务指标 | 生成标准化 `FinancialData` | Pass |
| financial-data / Alpha Vantage | 供应商非 2xx、限流或畸形响应 | 返回 `DATA_PROVIDER_UNAVAILABLE` | Pass |
| financial-data / Tushare | 映射字段行、仅使用年度报表、ROE 转比率 | 生成标准化 A 股指标 | Pass |
| financial-data / Tushare | 未配置 token、畸形行或错误响应 | 返回受控数据服务错误 | Pass |
| financial-data / 腾讯报价 | 价格映射、请求/解析失败降级和慢行情非阻塞 | 失败或基本面完成时未返回均为 `quote=null`，基本面仍成功 | Pass |
| financial-data / 港股 | 请求港股基本面 | 返回 `MARKET_NOT_SUPPORTED` | Pass |
| report-generator | DashScope endpoint、Bearer、模型、JSON mode 和结构化输入 | 请求符合 OpenAI-compatible 契约 | Pass |
| report-generator | 缺失、额外、空白或超长章节 | 返回 `LLM_INVALID_RESPONSE` | Pass |
| report-generator | 缺少配置、网络、非 2xx 或外层 JSON 无效 | 返回 `LLM_NOT_CONFIGURED` 或 `LLM_UNAVAILABLE` | Pass |
| POST /api/reports | 成功创建报告 | 写入公司名称、真实来源和 `completed` 状态 | Pass |
| POST /api/reports | 数据或 LLM 服务失败 | 已创建报告更新为 `failed`，响应保留受控状态和错误码 | Pass |

---

## 5. 集成与 E2E 测试用例

| 场景 | 前置条件 | 步骤 | 预期结果 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| 真实美股报告 | PostgreSQL、Alpha Vantage、DashScope 均已配置 | 输入 `AAPL` 并创建报告 | 存储八章节报告及实际数据来源 | 未执行 |
| 真实 A 股报告 | PostgreSQL、Tushare、DashScope 均已配置 | 输入 `600519` 并创建报告 | 存储八章节报告及实际数据来源 | 未执行 |
| 真实港股请求 | PostgreSQL 已配置 | 输入 `00700.HK` 并创建报告 | 返回 HTTP 422 / `MARKET_NOT_SUPPORTED`，报告状态为 `failed` | 未执行 |
| 首页错误提示 | 服务已启动 | 提交空值或非法代码 | 显示错误且不跳转 | 未执行 |
| 报告页导航 | 已存在 completed 报告 | 点击左侧章节链接 | 平滑滚动至对应章节 | 未执行 |

---

## 6. 执行结果汇总

| 检查项 | 命令 | 结果 |
| :--- | :--- | :--- |
| 完整 Jest 测试 | `npm test -- --runInBand` | Pass：5 个测试套件、35 个测试全部通过 |
| TypeScript 类型检查 | `npm run type-check` | Pass |
| ESLint | `npm run lint` | Pass：无警告、无错误 |
| Production build | `npm run build` | Pass |

真实数据库、供应商凭证和浏览器环境未在当前验证环境中配置，因此真实供应商集成测试和浏览器 E2E 测试尚待部署环境执行。

---

## 7. 已知限制与上线建议

- 真实适配器已由可重复的 HTTP mock 自动化测试覆盖，但上线前仍需使用受限的真实凭证检查第三方额度、响应形态和可用性。
- 报告生成当前为同步请求路径；外部调用较慢时会占用 API 响应时间，后续应评估异步队列。
- 港股代码可以识别，但港股基本面供应商尚未接入，当前会返回受控的不支持错误。
- 完整 Jest、类型检查、ESLint 和 production build 已通过；在真实环境集成与浏览器 E2E 验证完成前，暂不建议上线。
