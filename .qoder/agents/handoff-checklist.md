# 阶段验收清单

## PM 阶段准出检查

- [ ] PRD 已按 `docs/templates/prd-template.md` 完整填写。
- [ ] 包含清晰的目标用户与用户故事。
- [ ] 功能清单已拆分，每个功能有明确验收标准。
- [ ] 非功能需求（性能、安全、兼容性）已说明。
- [ ] 文件保存为 `docs/prd/YYYY-MM-DD-<feature>-prd.md`。
- [ ] 文档中无未决 `TBD`、`TODO`，或已标记为后续迭代。

## UE/UI 阶段准出检查

- [ ] 设计文档已按 `docs/templates/design-template.md` 完整填写。
- [ ] 信息架构与用户流程完整，无歧义。
- [ ] 核心页面与交互说明覆盖 PRD 中所有功能。
- [ ] 设计 tokens 与组件建议符合 `AGENTS.md` 技术栈。
- [ ] 文件保存为 `docs/design/YYYY-MM-DD-<feature>-design.md`。
- [ ] 文档中无未决 `TBD`、`TODO`，或已标记为后续迭代。

## Dev 阶段准出检查

- [ ] HLD 已按 `docs/templates/hld-template.md` 完整填写。
- [ ] 代码实现覆盖 PRD 与设计文档中所有功能。
- [ ] 代码通过 lint 与类型检查。
- [ ] 单元测试已补充并通过（核心逻辑覆盖率 ≥ 80%）。
- [ ] HLD 保存为 `docs/hld/YYYY-MM-DD-<feature>-hld.md`。
- [ ] 无敏感信息硬编码，配置通过环境变量管理。

## QA 阶段准出检查

- [ ] 测试计划/报告已按 `docs/templates/test-plan-template.md` 完整填写。
- [ ] 测试范围覆盖 PRD、设计文档、HLD 中的关键路径。
- [ ] 单元、集成、E2E 测试用例齐全。
- [ ] 测试结果已记录，缺陷已汇总并分级。
- [ ] 报告保存为 `docs/test/YYYY-MM-DD-<feature>-test-plan.md`。
- [ ] 已给出明确的上线/回退建议。
