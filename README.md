# 担保物权优先受偿计算器

基于《民法典》第414条和《企业破产法》第109-113条，自动计算各债权人就担保物的优先受偿金额。

## 功能

- **Excel/CSV 上传**：自动识别中英文列名，支持拖拽上传
- **在线编辑**：预览阶段可直接修改数据
- **四种分配场景**：1对1、多对1、1对多、多对多
- **迭代比例分配算法**：多对多场景下最大化全体债权人受偿
- **可视化**：受偿率柱状图、债权人-担保物关系图
- **交互演示器**：内置 4 种场景的可编辑模拟器，附带分配过程详解
- **结果导出**：一键导出 Excel（含汇总、明细、统计三个 Sheet）
- **数据安全**：所有计算在浏览器端完成，数据不离开本地

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:4173

## 构建

```bash
npm run build
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 构建 | Vite 5 |
| 框架 | React 18 |
| 语言 | TypeScript (strict) |
| Excel | SheetJS (xlsx) |
| 图表 | Chart.js + react-chartjs-2 |

## 项目结构

```
src/
├── main.tsx                    # 入口
├── App.tsx                     # 主应用（三步向导）
├── styles.css                  # 全局样式（深色科技风）
├── types.ts                    # 类型定义
├── constants.ts                # 列名映射
├── utils/
│   ├── allocationEngine.ts     # 核心分配算法
│   ├── fileParser.ts           # Excel/CSV 解析
│   ├── validation.ts           # 数据校验
│   ├── exportResults.ts        # 结果导出
│   └── formatCurrency.ts       # 金额格式化
└── components/
    ├── FileUpload.tsx           # 文件上传
    ├── DataPreview.tsx          # 数据预览编辑
    ├── AllocationResults.tsx    # 结果展示
    ├── RecoveryChart.tsx        # 受偿率图表
    ├── StepIndicator.tsx        # 步骤导航
    └── ExplanationPanel.tsx     # 规则说明 + 交互模拟器
```

## 输入表格格式

| 列名 | 说明 | 示例 |
|------|------|------|
| 债权人 | 债权人名称 | 银行A |
| 债权金额 | 债权总额（元） | 6,000,000 |
| 抵押物 | 担保物名称 | 房产1 |
| 评估值 | 担保物评估价值（元） | 10,000,000 |
| 顺位 | 抵押权顺位（1=最高） | 1 |

列名支持多种中文写法，系统自动识别。

## 工作区说明

```
docs/           → 产品文档（PRD、需求迭代、关键决策）
assets/design/  → 设计素材（效果图、UI 参考）
assets/bug/     → 测试报错截图
assets/reference/ → 参考图、灵感收集
notes/          → 学习笔记、踩坑记录
```

详见 [AGENTS.md](AGENTS.md)
