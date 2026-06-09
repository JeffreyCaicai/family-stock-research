# Family Stock Research

家庭股票池的定向深度投研系统。

## 定位

本项目服务 A 股优先的家庭股票池投研场景：输入家庭关注股票，系统同步真实数据，并生成可解释的单股分析、风险提醒、买点观察和情景路径推演。

系统不做自动交易，不替用户下单。它的目标是把真实数据、经典投资框架、A 股市场适配、缠论结构、风险控制和复盘机制组织成一个可持续使用的投研副驾。

## 第一阶段目标

- 维护家庭股票池。
- 支持股票状态和标签。
- 同步 A 股行情、日线、周线和 60 分钟 K 线。
- 生成单股基础分析页。
- 输出数据健康状态。
- 输出基础结论层。

## 本地开发

```bash
npm install
npm run dev
```

默认本地地址：`http://localhost:5173/`。

## 行情同步

当前已经建立同步快照契约，前端读取 `src/data/generated/marketSnapshots.json`。

正式家庭股票池源：

```text
data/family-pool.json
```

这个文件用于同步脚本读取股票代码、状态和标签。页面本地录入仍会先保存在浏览器本地，后续会继续打通“页面录入 -> 家庭股票池文件/API -> 行情同步”的闭环。

离线验证同步管道：

```bash
npm run sync:fixture
```

真实 A 股行情同步预留 AKShare 入口，需要本地 Python 环境先安装 `akshare`：

```bash
pip install akshare
npm run sync:akshare
```

注意：fixture 模式只用于验证管道，不代表真实行情；AKShare 接入后仍需继续补日 K、周 K、60 分钟 K、财务和公告数据。

同步脚本测试：

```bash
npm run test:sync
```

## 文档

- `docs/product-design.md`：完整产品设计和重构方案。
- `docs/phase-1-plan.md`：第一阶段开发计划。
