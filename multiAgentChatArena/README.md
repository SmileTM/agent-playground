# Multi-Agent Chat Arena: 基于 LLM 的多智能体编排系统

本项目是一个基于 Next.js 14 开发的高性能 Web 应用，旨在探索多 LLM 智能体在共享上下文环境下的协作与对抗逻辑。项目通过抽象化 Agent 实体并实现中心化消息总线，提供了一个可扩展的多模型调度平台。

## 🛠 核心技术特性

- **Agent 实体抽象与编排 (Orchestration):** 
  支持通过 System Prompt 为每个 Agent 定义独立的生命周期行为与决策逻辑。系统通过状态机实现 Agent 轮转响应，支持串行及并行对话流触发。
- **异构模型调度层 (Heterogeneous Model Ops):** 
  内置对 OpenAI、Google Gemini、Alibaba Qwen 及 Moonshot 等主流 LLM 的适配器。实现了统一的推理接口（Payload Mapping），支持模型级别的精细化参数配置。
- **消息总线与上下文管理 (Context Management):** 
  利用 React 状态提升与高效的 Context API 维护全局对话树。实现了基于 LRU 策略的输入历史回溯功能，优化了长文本输入场景下的交互链路。
- **全链路监控与调试 (Observability):** 
  服务端实现了详细的 Telemetry 打印机制。每次 API 请求的原始 Payload 及下游响应内容均通过结构化日志输出，确保了模型幻觉与请求异常的可观测性。
- **兼容性与边缘适配:** 
  基于 Tailwind CSS 实现了高度流式的响应式布局。优化了边缘触控事件，确保在 Mobile Web 场景下的交互响应延迟符合工程标准。

## 🏗 技术栈架构

- **Framework:** Next.js 14 (App Router) - 利用 serverless 路由处理高并发 API 聚合。
- **Typing:** TypeScript - 严格的类型约束确保数据结构在 Agent 传递过程中的一致性。
- **UI Architecture:** Tailwind CSS + Lucide Icons - 实现原子化的样式管理与轻量化资源加载。

## 🚀 部署与开发

1.  **依赖安装:**
    ```bash
    npm install
    ```
2.  **开发环境启动:**
    ```bash
    npm run dev
    ```
    应用将监听在 `http://localhost:3000`。

## 💡 工程实践建议

- **System Prompt 优化:** 为 Agent 设计具体的角色边界与决策边界（Decision Boundary），以获得更高质量的思维链（CoT）表现。
- **API 通信调试:** 建议在开发阶段持续开启终端日志。通过分析请求体的 `messages` 序列，可以直观定位模型输出偏离预期的根源。

---

*Multi-Agent Chat Arena - 为 AI 智能体探索提供稳健的基础设施。*
