# AGENTS.md — 开发 AI 工作指南

本文件面向后续参与开发的 AI 助手（Claude Code 等），说明项目工作区结构与开发规则。

---

## 工作区结构

```
collateral-calculator/
├── src/              # 所有代码（React + TypeScript）
├── docs/             # 产品文档区
├── assets/
│   ├── design/       # 设计素材（效果图、UI 参考图）
│   ├── bug/          # 测试报错截图
│   └── reference/    # 参考图、灵感收集
├── notes/            # 学习笔记、踩坑记录、技术方案
├── AGENTS.md         # 本文件：AI 开发指南
├── README.md         # 项目简介
└── ...               # 构建配置文件（vite.config.ts, tsconfig.json 等）
```

---

## 各目录用途详解

### `src/` — 代码区

- **所有代码文件必须放在此目录下**，不要在根目录或其他目录创建 `.tsx`、`.ts`、`.css` 等源码文件。
- 代码中**不引用 `src/` 以外的资源文件**（图片、字体等），如需静态资源请放在 `public/` 目录（Vite 约定）。
- 组件放 `src/components/`，工具函数放 `src/utils/`，类型定义放 `src/types.ts`。

### `docs/` — 产品文档区

- 存放 PRD（产品需求文档）、需求迭代记录、关键决策文档。
- 文件格式：Markdown（`.md`）。
- 命名规范：`YYYY-MM-DD_文档标题.md`，如 `2026-05-11_分配算法PRD.md`。
- **不要在 docs 中存放代码或配置文件。**

### `assets/design/` — 设计素材

- 存放 UI 效果图、设计稿截图、风格参考图。
- 支持格式：`.png`、`.jpg`、`.svg`、`.fig`（Figma 链接可写在 `.txt` 中）。

### `assets/bug/` — 测试报错截图

- 存放 Bug 复现截图、控制台报错截图、浏览器 DevTools 截图。
- 命名建议：`bug-简要描述.png`。

### `assets/reference/` — 参考与灵感

- 存放竞品截图、灵感收集、第三方 UI 参考。
- 可按子目录分类。

### `notes/` — 学习笔记

- 存放开发过程中的踩坑记录、技术方案对比、学习笔记。
- 文件格式：Markdown。
- 鼓励记录**为什么**做出某个技术选择，而不仅仅是**做了什么**。

---

## 开发规则

### 代码规则

1. **所有代码放在 `src/` 下**，禁止在根目录、docs、assets 中创建源码文件。
2. **代码中不引用外部 URL 资源**（CDN 字体、外部图片等），所有依赖通过 npm 管理。
3. **纯前端，无后端**：所有计算在浏览器端完成，不引入服务端代码或 API 调用。
4. **TypeScript strict 模式**：遵循 `tsconfig.json` 中的严格类型检查。
5. **样式写在 `src/styles.css`**：全局样式统一管理，组件不使用 CSS-in-JS。
6. **中文 UI**：所有面向用户的文本使用简体中文。

### 文档规则

7. **产品文档放 `docs/`**，不要混入代码目录。
8. **决策记录**：重大技术或产品决策写入 `docs/` 并注明日期和原因。
9. **截图放对应 assets 子目录**，不要散落在根目录。

### 构建规则

10. **开发服务器**：`npm run dev`，端口 4173，绑定 0.0.0.0。
11. **构建**：`npm run build`（执行 `tsc && vite build`）。
12. **不修改构建配置**（vite.config.ts、tsconfig.json）除非有明确理由并记录在 docs 中。

### 提交规则

13. **提交前**：确保 `tsc --noEmit` 无报错，`vite build` 成功。
14. **提交信息**：使用中文，格式如 `feat: 添加xxx功能`、`fix: 修复xxx问题`、`docs: 更新xxx文档`。

---

## 核心业务背景

本项目是**担保物权优先受偿计算器**，用于企业破产/债务重组场景，计算各债权人就担保物的优先受偿金额。

- 法律依据：《民法典》第414条、《企业破产法》第109-113条
- 核心算法：迭代比例分配（按顺位处理，同一顺位内按债权比例分配）
- 技术栈：Vite + React 18 + TypeScript + xlsx（SheetJS）+ Chart.js

修改算法或业务逻辑前，请先阅读 `src/utils/allocationEngine.ts` 中的注释和 `docs/` 下的 PRD。
