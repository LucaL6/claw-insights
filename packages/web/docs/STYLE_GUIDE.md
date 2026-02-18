# Claw-Insights UI Style Guide

## 1. 设计原则

**Tailwind-first:** 所有可静态表达的样式使用 Tailwind class，不写 inline style。

**语义 Token:** 通过 `@theme` 注册 CSS 变量后使用 Tailwind class（如 `text-fg-muted`），不在组件中直接写 `style={{ color: 'var(--text-muted)' }}`。

**Inline style 仅用于:**
- 动态运行时值（props 计算、数值型宽高）
- Variant map 查找结果（状态颜色、类型着色）
- CSS 变量插值（`var(--card-accent-${accent})`）

---

## 2. Token 体系

所有 token 在 `src/styles/theme.css` 的 `@theme` 块中注册，dark/light 两套值在 `[data-theme]` 中定义。

### 前景（文字）
| Token | Class | 用途 |
|---|---|---|
| `--text-primary` | `text-fg` | 主文字 |
| `--text-secondary` | `text-fg-secondary` | 次级文字 |
| `--text-muted` | `text-fg-muted` | 弱化文字 |
| `--text-dim` | `text-fg-dim` | 最弱文字 |

### 背景
| Token | Class | 用途 |
|---|---|---|
| `--bg-base` | `bg-base` | 页面底色 |
| `--bg-surface` | `bg-surface` | 卡片/面板（半透明） |
| `--bg-surface-solid` | `bg-surface-solid` | 卡片/面板（不透明） |
| `--bg-elevated` | `bg-elevated` | 按钮、badge、输入框 |
| `--bg-overlay` | `bg-overlay` | 浮层 |
| `--bg-input` | `bg-input` | 输入框 |

### 边框
| Token | Class | 用途 |
|---|---|---|
| `--border` | `border-edge` | 标准边框 |
| `--border-subtle` | `border-edge-subtle` | 弱边框 |

### 强调色
每个强调色有三个变体：主色、背景色、边框色。

| 色系 | 主色 Class | 背景 Class | 边框 Class |
|---|---|---|---|
| Emerald | `text-emerald` | `bg-emerald-bg` | `border-emerald-border` |
| Red | `text-red` | `bg-red-bg` | `border-red-border` |
| Sky | `text-sky` | `bg-sky-bg` | `border-sky-border` |
| Amber | `text-amber` | `bg-amber-bg` | `border-amber-border` |
| Orange | `text-orange` | `bg-orange-bg` | `border-orange-border` |
| Violet | `text-violet` | `bg-violet-bg` | `border-violet-border` |

### 阴影
| Token | Class | 用途 |
|---|---|---|
| `--shadow-card` | `shadow-card` | 卡片投影 |
| `--shadow-tooltip` | `shadow-tooltip` | Tooltip 投影 |

### 特殊
| Token | Class | 用途 |
|---|---|---|
| `--skeleton` | `bg-skeleton` | 骨架屏 |
| `--progress-track` | `bg-progress-track` | 进度条轨道 |
| `--tree-line` | `bg-tree-line` | Sub-agent 树线 |
| `--subagent-bg` | `bg-subagent` | Sub-agent 卡片背景 |
| `--theme-btn-bg` | `bg-theme-btn-bg` | 主题切换按钮背景 |
| `--theme-btn-text` | `text-theme-btn-text` | 主题切换按钮文字 |

---

## 3. 主题切换

- Dark/Light 通过 `[data-theme="dark"]` / `[data-theme="light"]` 切换
- **所有颜色值**在 `theme.css` 中两套定义，组件只使用语义 token
- 禁止在组件中硬编码 hex 色值（如 `#ef4444`），使用 `text-red` 等

---

## 4. 样式模式

### ✅ 静态样式 — Tailwind class

布局、颜色、圆角、阴影、排版全走 class：

```tsx
// ✅ Good
<div className="bg-surface-solid border border-edge shadow-card rounded-xl p-4">
  <span className="text-fg-muted text-[12px] mono">...</span>
</div>
```

### ✅ 条件样式 — className 三元

2-3 个确定状态之间切换：

```tsx
// ✅ Good
<button className={`px-3 py-1 rounded-md ${
  active
    ? 'bg-emerald-bg text-emerald border border-emerald-border'
    : 'bg-elevated text-fg-secondary border border-edge'
}`}>
```

### ✅ 动态样式 — Variant Map + inline style

状态/类型映射的运行时颜色，通过 constants 文件集中管理：

```tsx
// constants.ts — 集中定义
export const TAG_STYLES = {
  model: { bg: 'var(--tag-model-bg)', color: 'var(--tag-model-text)', border: 'var(--tag-model-border)' },
  channel: { bg: 'var(--tag-channel-bg)', color: 'var(--tag-channel-text)', border: 'var(--tag-channel-border)' },
};

// ✅ Good — variant map 查找，inline style 仅用于动态值
<span
  className="text-[11px] px-2 py-0.5 rounded"
  style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
>
```

### ✅ 动态数值 — inline style

Props 传入的数值型样式：

```tsx
// ✅ Good — 动态像素值
<div style={{ height: `${height}px` }}>
<span style={{ width: `${clamped}%` }}>
```

---

## 5. 禁止模式 ❌

| 禁止 | 替代方案 |
|---|---|
| `style={{ color: 'var(--text-muted)' }}` | `className="text-fg-muted"` |
| `style={{ backgroundColor: 'var(--bg-elevated)' }}` | `className="bg-elevated"` |
| `style={{ border: '1px solid var(--border)' }}` | `className="border border-edge"` |
| `<span style={{ color: '#ef4444' }}>` | `<span className="text-red">` |
| `<style>{@keyframes ...}</style>` | 写入 `index.css` |
| 已注册 token 用 `text-[var(--xxx)]` | 直接用对应 class |

---

## 6. 文件组织

```
src/
├── styles/
│   └── theme.css          # @theme 注册 + dark/light CSS 变量
├── index.css              # @import tailwindcss + 全局样式 (fonts, scrollbar, keyframes)
└── components/
    └── sessions/
        └── shared/
            └── constants.ts  # 组件级 variant map (tag/status/session styles)
```

- **theme.css** — Token 注册层。`@theme` 块 + `[data-theme]` 变量值
- **index.css** — 全局层。字体、scrollbar、keyframes、公共 class
- **constants.ts** — 组件 variant map。动态样式的数据源（CSS 变量引用）
- **组件内** — Tailwind class 为主，inline style 仅动态值

---

## 7. 何时注册新 @theme Token

**注册（加入 @theme）:**
- 被 2+ 个组件使用的 CSS 变量
- 属于"设计系统"层级的语义 token（颜色、阴影、间距）

**不注册（留在 variant map 或 data-theme）:**
- 仅单个组件使用的细粒度变量（`--tag-model-bg`、`--session-active-border`）
- ECharts 专用变量（`--chart-grid`、`--chart-tooltip-bg`）
- 通过 JS variant map 消费的变量

---

## 8. 新增组件 Checklist

- [ ] 颜色是否使用语义 token？（禁止 hex）
- [ ] 是否有可替换为 Tailwind class 的 inline style？
- [ ] 动态样式是否通过 variant map 管理？
- [ ] dark/light 两套值是否在 theme.css 中定义？
- [ ] 新 keyframes 是否写入 index.css？（禁止 inline `<style>`）
- [ ] 新 CSS 变量是否需要注册到 @theme？（参考第 7 节）
