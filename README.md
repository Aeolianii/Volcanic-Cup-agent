# AI Story Foundry

AI Story Foundry 是一个 AI 驱动的多人互动叙事引擎。用户输入故事创意后，系统生成 Story Bible，并围绕 Story Bible 构建动态规则、动态 UI、多人房间、AI GM、AI NPC、World State 和多结局流程。

## 快速开始

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

生产模式本地测试：

```bash
npm run build
npm run start
```

## 技术栈

- Frontend: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- Backend: Next.js API Routes
- Realtime: Socket.IO 预留
- Database: MVP 使用内存存储，后续可替换为 PostgreSQL
- AI: Mock Provider + OpenAI-compatible Chat Completions Provider

## LLM Provider

应用支持兼容 OpenAI Chat Completions 的模型服务。创建 `.env.local`：

```bash
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
```

配置 `DEEPSEEK_API_KEY` 后，GM 叙事、NPC 规划、结局叙事和自由行动解析会优先调用真实模型。Demo 故事在模型不可用时允许使用兜底以保证可玩；导入故事在 AI 失败时会明确提示未生成，不用模板剧情冒充真实生成。

## Demo 故事：失落圣杯之夜

点击首页的 Demo 故事，或访问 `/generate?demo=true`，可以直接体验预置故事。

- 类型：西幻 + 权谋 + 推理
- 玩家角色：王子、圣女、刺客、骑士
- NPC：大法师、老国王、主教
- 核心事件：圣杯失窃、圣殿调查、地下祭坛发现、大法师仪式、王国动乱
- 结局：王国得救、古神苏醒、王权崩塌、刺客革命成功

## 核心架构原则

1. Story Bible 是唯一故事数据源。
2. World State 是唯一真实世界状态源。
3. Rule Engine 是唯一状态修改入口。
4. AI GM 可以读取完整故事摘要，但不能直接修改 World State。
5. AI NPC 只能读取 Knowledge Filter 生成的局部视野。
6. 玩家 Chat、Suggested Actions、Free Action 最终都转换为 StructuredAction。
7. 前端 UI 不由 AI 生成代码，而是通过 Widget Registry 根据 `ui_config` 动态渲染。

## 游戏运行流程

1. AI GM 输出当前剧情叙事。
2. 玩家阅读 NarrativePanel。
3. 玩家可以在 ChatPanel 进行 RP 发言。
4. 玩家点击 Suggested Actions 或在 FreeActionInput 输入自由行动。
5. Action Parser 将输入转换为 StructuredAction。
6. Rule Engine 进行权限、风险、成功率和后果结算。
7. World State Engine 应用状态更新。
8. Event Trigger System 检查事件触发。
9. NPC Knowledge Filter 为 NPC 构造局部视野。
10. NPC Planner 生成 NPC 行动提案。
11. NPC 行动进入 Rule Engine。
12. Story Controller 判断章节推进。
13. Ending Judge 判断结局。
14. AI GM 基于最新状态生成下一段叙事。

## API 路由

| 方法 | 路径 | 描述 |
| --- | --- | --- |
| POST | `/api/stories/generate` | 生成 Story Bible |
| POST | `/api/stories/validate` | 校验 Story Bible |
| POST | `/api/rooms` | 创建房间 |
| POST | `/api/rooms/:roomId/join` | 加入房间 |
| POST | `/api/rooms/:roomId/select-role` | 选择角色 |
| POST | `/api/rooms/:roomId/start` | 开始故事 |
| GET | `/api/rooms/:roomId/state` | 获取房间状态 |
| GET | `/api/rooms/:roomId/players/:playerId/view` | 获取玩家视角 |
| POST | `/api/rooms/:roomId/chat` | 提交 RP 聊天 |
| POST | `/api/rooms/:roomId/actions` | 提交正式行动 |
| POST | `/api/rooms/:roomId/npc-turn` | 执行 NPC 回合 |
| POST | `/api/rooms/:roomId/endings/check` | 检查结局 |

## 项目结构

```text
src/
  app/                 Next.js App Router 页面与 API
  components/
    widgets/           游戏面板组件
    ui/                UIBuilder 等 UI 组装逻辑
  engine/              Story Bible、Rule Engine、AI GM、NPC、事件和结局逻辑
  registry/            Widget Registry 与 Rule Pack Registry
  types/               TypeScript 类型定义
  mock/                Demo Story Bible 与 Mock AI Provider
  lib/                 房间管理、AI Provider、前端状态
```

## 版本更新

### v1.2 - 2026-05-24

#### Story Bible 与故事生成

- 生成内容更贴合玩家输入的题材、人物关系和世界设定，减少校园/言情等故事被硬套西幻权谋模板的问题。
- 强化 Story Bible 校验，覆盖角色目标、NPC 知识范围、Widget 配置、结局数量和访问权限。
- Demo 可以使用可玩兜底；导入故事 AI 失败时明确提示未生成。

#### AI GM、规则结算与 World State

- 玩家行动结果会进入 AI GM 上下文，GM 叙事会结合 Rule Engine、World State、事件和新增情报生成具体反馈。
- 修复事件 ID、目标别名、指标 key、玩家 ID 等内部参数泄露到玩家文本的问题。
- 统一规范行动目标，支持 NPC、角色、事件、当前位置和关联地点等目标。
- 改进社交、调查、自我梳理、线索、指标、关系和事件结算，让行动结果更具体。

#### 玩家交互与性能

- 推荐行动和自由行动提交后显示即时处理中反馈。
- 推荐行动会根据最新 World State 刷新，点击过的旧行动会被过滤。
- 修复推荐行动列表不实时更新的问题：点击后立即从 UI 移除旧行动，结算完成后用新推荐替换，失败时恢复原列表。
- 行动结算后并行执行结局判断和 GM 叙事生成，减少等待。
- 行动后的 GM 叙事使用并发高 token AI 请求，优先采用第一个合法 JSON 结果。

#### 玩家界面

- 修复 GM 名称被误显示为“通用汽车”。
- 已知事实支持展开查看完整列表。
- 优化行动面板、自由行动输入框和 UI Builder 的禁用、处理中、推荐刷新状态。
- 清理证据、已知事实、角色信息和叙事文本中的内部参数。

#### Demo：失落圣杯之夜

- 打通创建房间、选角、开始故事、行动提交、GM 叙事、推荐刷新、事件触发和结局判断闭环。
- 强化与大法师等 NPC 交谈后的具体反馈和后续线索方向。
- 保留 Demo 兜底叙事，避免导入故事被兜底模板污染。

完整更新日志见 [CHANGELOG.md](CHANGELOG.md)。
