<div align="center">
  <img src="packages/web/public/logo/icon-dark.svg" width="80" alt="Claw Insights" />
  <h1>Claw Insights</h1>
  <p><strong>开源 Agent 可观测性 — 回放、指标、日志与可分享快照</strong></p>
  <p><sub>为 <a href="https://github.com/openclaw/openclaw">OpenClaw</a> 而生 · 适配器架构 — 可扩展至任意 Agent 运行时</sub></p>
  <p>
    <img src="https://img.shields.io/badge/%F0%9F%94%8C_%E9%9B%B6%E4%BE%B5%E5%85%A5-read--only_sidecar-10b981" alt="零侵入" />
    <img src="https://img.shields.io/badge/%F0%9F%94%8D_%E5%AE%8C%E6%95%B4%E5%9B%9E%E6%94%BE-session_transcripts-6366f1" alt="完整回放" />
    <img src="https://img.shields.io/badge/%F0%9F%93%B8_%E5%8F%AF%E5%88%86%E4%BA%AB%E5%BF%AB%E7%85%A7-PNG_%7C_SVG-f59e0b" alt="可分享快照" />
  </p>
  <p>
    <a href="https://github.com/LucaL6/claw-insights/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/LucaL6/claw-insights/ci.yml?branch=main&label=CI" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%E2%89%A522.5-green" alt="Node.js" /></a>
    <img src="https://img.shields.io/badge/macOS-supported-blue" alt="macOS" />
    <img src="https://img.shields.io/badge/Linux-supported-blue" alt="Linux" />
  </p>
  <br />
  <img src="docs/assets/hero-montage.png" width="100%" alt="Claw Insights 仪表盘 — Agent 可观测性：会话回放、Token 分析与可分享快照" />
</div>

---

<p align="center">
  <a href="README.md">English</a> ·
  <strong>中文</strong>
</p>

## 功能特性

- **零侵入** — 自托管、本地优先的可观测性旁路服务；无需 SDK、不改代码、不联网、数据不出机器
- **会话回放** — 完整对话时间线，角色区分、工具调用、思维链步骤、逐条 Token 追踪
- **可分享快照** — 通过 REST API 或 CLI 生成 PNG/SVG 状态卡片，支持主题、语言、详细度选择
- **指标仪表盘** — 按模型分 Token 分析、错误率、在线率，支持 30m / 1h / 6h / 12h / 24h 时间范围
- **事件日志** — 结构化日志查看器，密度热力条、过滤、搜索，便于 AI Agent 调试
- **一键安装** — 自动发现运行中的 gateway，轻量 SQLite 存储
- **深色 / 浅色 · EN / 中文** — 完整主题切换和国际化

## 快速开始

```bash
# 全局安装
npm install -g claw-insights

# 启动 — 自动连接运行中的 OpenClaw gateway
claw-insights start
```

启动后会看到：

```
✅ Claw Insights v0.1.0    ready in 1.2s

➜  Open:  http://127.0.0.1:41041/?token=abc123...
   Auth:  token (auto-generated)

PID 12345 · daemon · Port 41041
```

打开链接 — token 自动交换为 session cookie，直接进入。

## 使用指南

### 🔌 零侵入 — 启动与连接

```bash
claw-insights start                    # 自动发现运行中的 OpenClaw gateway
claw-insights start --gateway <url>    # 连接指定 gateway
claw-insights start --no-auth          # 禁用 token 认证
claw-insights start --open             # 启动并自动打开浏览器
claw-insights status                   # 查看访问地址与连接信息
claw-insights logs -n 50               # 查看守护进程日志
claw-insights restart                  # 重启守护进程
claw-insights stop                     # 停止守护进程
```

### 🔍 完整回放 — 会话与对话记录

在仪表盘中浏览所有会话。点击任意会话查看完整对话时间线 — 包含角色区分、工具调用详情、逐条 Token / 延迟追踪。

### 📸 可分享快照 — 截图与分享

```bash
claw-insights snapshot                              # 默认：PNG，深色主题，6 小时范围
claw-insights snapshot --format svg --theme light   # SVG 浅色主题
claw-insights snapshot --range 24h --detail full    # 24 小时完整快照
claw-insights snapshot --lang zh --quick            # 快速中文紧凑卡片
```

REST API 程序化访问：

```bash
curl -X POST http://localhost:41041/api/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"format":"svg","theme":"light","detail":"full","range":"24h"}'
```

## 工作原理

Claw Insights 作为 **只读旁路服务** 运行，提供 LLM 与 Agent 可观测性。
它追踪日志文件和 CLI 输出 — 无需 SDK、不改代码、无网络调用。

```
Agent 运行时 (OpenClaw / Claude Code / ...)
  │
  ├─ 日志文件 ──→  claw-insights 守护进程
  │                     │
  ├─ CLI 探针 ──→       ├─→ SQLite（仅本地存储）
  │                     ├─→ GraphQL API + SSE 订阅
  │                     └─→ Satori 渲染器（PNG/SVG）
  │                              │
  └─────────────────────────→  React 仪表盘（实时）
```

**技术栈：** Express · GraphQL Yoga · SQLite · Satori · React 19 · Vite · ECharts

→ 完整配置与安装选项：[docs/configuration.md](docs/configuration.md)

## 🤖 AI Agent 友好

Claw Insights 内置了面向 AI Agent 的结构化技能 —
你的 Agent 可以自主安装、运行和截图。

完整索引见 **[AGENTS.md](AGENTS.md)**。

### Install 技能

帮助 AI Agent 从零开始安装 Claw Insights — 安装、配置、启动、验证。

```bash
# Agent 读取技能后执行：
npm install -g claw-insights
claw-insights start
claw-insights status   # 验证：运行中 + gateway 已连接
```

→ 完整技能：[docs/skills/install/SKILL.md](docs/skills/install/SKILL.md)

### Snapshot 技能

教 Agent 将仪表盘状态截取为 PNG/SVG/JSON 并分享到聊天频道。

```bash
# 截取 6 小时深色中文快照
claw-insights snapshot --theme dark --lang zh --range 6h -o status.png

# REST API — 任意 Agent 均可程序化调用
curl -X POST http://localhost:41041/api/snapshot \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"format":"svg","theme":"light","detail":"full"}'
```

→ 完整技能：[docs/skills/snapshot/SKILL.md](docs/skills/snapshot/SKILL.md)

## 路线图

✅ 已发布 · 🔧 进行中 · 📋 计划中

- ✅ 会话回放与对话时间线
- ✅ 指标仪表盘（Token 分析、错误率、在线率）
- ✅ 可分享快照（PNG / SVG / JSON）
- 🔧 思维链 / 推理步骤可视化 — *进行中*
- 🔧 Agent 工具调用可观测性 — *进行中*
- 📋 多数据源适配器（Claude Code、Codex 等）
- 📋 多 Agent 拓扑视图

## 架构

```
claw-insights/
├── packages/
│   ├── server/     Express + GraphQL Yoga + SQLite + Satori 渲染器
│   ├── web/        React 19 + Vite + Tailwind + ECharts + urql
│   └── shared/     Codegen TypeScript 类型（server 与 web 共享）
├── bin/            CLI 入口（start/stop/restart/status/logs/snapshot/run）
└── codegen.ts      GraphQL codegen 配置（3 个生成目标）
```

→ 完整架构说明、开发环境和 codegen：[docs/architecture.md](docs/architecture.md)

## 文档

| 文档                              | 说明                             |
| --------------------------------- | -------------------------------- |
| [配置参考](docs/configuration.md) | 所有环境变量、配置文件、认证模型 |
| [架构说明](docs/architecture.md)  | 系统设计、开发环境、测试         |
| [API 参考](docs/api-reference.md) | GraphQL + REST 接口签名          |
| [AGENTS.md](AGENTS.md)            | AI Agent 技能索引                |

## 参与贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发环境搭建、PR 规范和代码约定。

## 安全

见 [SECURITY.md](SECURITY.md) 了解漏洞报告和安全模型。

## 许可证

[MIT](LICENSE)
