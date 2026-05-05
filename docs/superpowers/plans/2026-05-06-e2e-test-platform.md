# E2E 测试平台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 搭建 Playwright 测试平台，支持真实 Electron 应用的端到端测试

**Architecture:** 使用 _electron.launch 启动应用；测试环境配置短时番茄钟；增强组件可测试性

**Tech Stack:** Playwright, Electron, TypeScript, React

---

## File Structure

| 文件 | 职责 |
|------|------|
| tomato_app/playwright.config.ts | 移除 webServer，配置 Electron |
| tomato_app/tests/e2e/fixtures.ts | Electron 启动和数据库清理 |
| tomato_app/src/main/database.ts | 数据库清理函数 |
| tomato_app/src/main/index.ts | 测试 IPC 处理器 |
| tomato_app/src/renderer/components/*.tsx | 添加 aria-label 和 data-testid |
| tomato_app/tests/e2e/pomodoro-cycle.spec.ts | 完整番茄循环测试 |
| tomato_app/tests/e2e/task-timer-link.spec.ts | 任务联动测试 |

---

## Task 1-14: 详见设计文档

完整步骤请参考设计文档。

验收标准：
- [ ] Playwright 启动真实 Electron 应用
- [ ] 5秒番茄钟 + 3秒休息
- [ ] 数据库每次测试前清空
- [ ] P0 测试用例通过
