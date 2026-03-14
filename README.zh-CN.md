<div align="center">
  <img src="packages/web/public/logo/icon-dark.svg" width="80" alt="Claw Insights" />
  <h1>Claw Insights</h1>
  <p><strong><a href="https://github.com/openclaw/openclaw">OpenClaw</a> Agent 可观测仪表盘</strong></p>
  <p>
    <img src="https://img.shields.io/badge/%F0%9F%94%8C_%E9%9B%B6%E4%BE%B5%E5%85%A5-read--only_sidecar-10b981" alt="零侵入" />
    <img src="https://img.shields.io/badge/%F0%9F%94%8D_%E5%AE%8C%E6%95%B4%E5%9B%9E%E6%94%BE-session_transcripts-6366f1" alt="完整回放" />
    <img src="https://img.shields.io/badge/%F0%9F%93%B8_%E5%8F%AF%E5%88%86%E4%BA%AB%E5%BF%AB%E7%85%A7-PNG_%7C_SVG-f59e0b" alt="可分享快照" />
  </p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%E2%89%A522.5-green" alt="Node.js" /></a>
    <img src="https://img.shields.io/badge/macOS-supported-blue" alt="macOS" />
    <img src="https://img.shields.io/badge/Linux-supported-blue" alt="Linux" />
  </p>
  <br />
  <img src="docs/assets/hero-montage.png" width="100%" alt="仪表盘、会话回放与快照 API" />
</div>

---

<p align="center">
  <a href="README.md">English</a> ·
  <strong>中文</strong>
</p>

## 功能特性

- **零侵入** — 纯只读旁路服务；不改代码、不联网、数据不出机器
- **会话回放** — 完整对话时间线，角色区分、工具调用、逐条 token 追踪
- **可分享快照** — 通过 REST API 生成 PNG/SVG 状态卡片，支持主题、语言、详细度选择
- **指标仪表盘** — 按模型分 token 消耗、错误率、在线率，支持 30m / 1h / 6h / 12h / 24h 时间范围
- **事件日志** — 结构化查看器，密度热力条、过滤、搜索
- **一键安装** — 自动发现运行中的 gateway，轻量 SQLite 存储
- **深色 / 浅色 · EN / 中文** — 完整主题切换和国际化

## 快速开始

```bash
# 安装
npm install -g claw-insights

# 启动（自动连接运行中的 OpenClaw gateway）
claw-insights start
```

启动后会看到访问地址：

```
✅ Claw Insights v0.1.0    ready in 1.2s

➜  Open:  http://127.0.0.1:41041/?token=abc123...
   Auth:  token (auto-generated)

PID 12345 · daemon · Port 41041
```

打开链接——token 自动交换为 session cookie，直接进入。

```bash
claw-insights status          # 查看当前访问地址
claw-insights stop            # 停止服务
claw-insights start --no-auth # 禁用认证
```

→ 完整安装选项、快照 API 和故障排查：[docs/configuration.md](docs/configuration.md)

## 🤖 AI Agent 友好

内置 AI agent 结构化资源——完整索引见 **[AGENTS.md](AGENTS.md)**：

| Skill | 用途 |
|-------|------|
| [install](docs/skills/install/SKILL.md) | 安装、配置、启动 |
| [snapshot](docs/skills/snapshot/SKILL.md) | 通过 REST 或 CLI 生成 PNG/SVG/JSON 快照 |

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

**数据流：** OpenClaw gateway → 日志追踪 + CLI → SQLite → GraphQL（SSE 订阅）→ React

→ 完整架构说明、开发环境和 codegen：[docs/architecture.md](docs/architecture.md)

## 文档

| 文档 | 说明 |
|------|------|
| [配置参考](docs/configuration.md) | 所有环境变量、配置文件、认证模型 |
| [架构说明](docs/architecture.md) | 系统设计、开发环境、测试 |
| [API 参考](docs/api-reference.md) | GraphQL + REST 接口签名 |
| [AGENTS.md](AGENTS.md) | AI agent 技能索引 |

## 参与贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发环境搭建、PR 规范和代码约定。

## 安全

见 [SECURITY.md](SECURITY.md) 了解漏洞报告和安全模型。

## 许可证

[MIT](LICENSE)
