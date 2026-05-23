# AI Story Foundry

AI 驱动的多人互动叙事引擎。输入故事创意，自动生成 Story Bible，支持多人在线角色扮演，AI GM 叙事，AI NPC 行为，动态规则引擎和多重结局。

## 技术栈

- **Frontend**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Realtime**: Socket.IO (预留)
- **Database**: 内存存储 (MVP)，可替换为 PostgreSQL
- **AI**: Mock Provider (MVP)，接口可替换为真实 LLM

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:3000
```

## LLM Provider

The app supports an OpenAI-compatible chat completions provider.

Create `.env.local`:

```bash
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
```

When `DEEPSEEK_API_KEY` is present, GM narration, NPC planning, ending narration,
and free-action parsing use the real provider first. If the provider is
unavailable or returns invalid JSON, the app falls back to the local mock
provider so the demo remains playable.

## Demo 故事：失落圣杯之夜

点击首页「Demo 故事」或访问 `/generate?demo=true` 可直接体验预置故事。

- **类型**：西幻 + 权谋 + 推理
- **角色**：王子、圣女、刺客、骑士
- **NPC**：大法师、老国王、主教
- **结局**：王国得救 / 古神苏醒 / 王权崩塌 / 刺客革命成功

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx            # 首页
│   ├── generate/page.tsx   # 故事生成页
│   ├── room/[roomId]/      # 房间/游戏主界面
│   ├── ending/[roomId]/    # 结局页
│   └── api/                # API Routes
│       ├── stories/        # 故事生成 & 校验
│       └── rooms/          # 房间管理 & 游戏逻辑
├── components/
│   ├── widgets/            # 10 个 Widget 组件
│   │   ├── NarrativePanel.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── RolePanel.tsx
│   │   ├── MetricPanel.tsx
│   │   ├── EventPanel.tsx
│   │   ├── EvidencePanel.tsx
│   │   ├── SuggestedActionsPanel.tsx
│   │   ├── FreeActionInput.tsx
│   │   ├── FactionPanel.tsx
│   │   └── PlayerInfoPanel.tsx
│   └── ui/
│       └── UIBuilder.tsx    # 动态 Widget 渲染器
├── engine/                  # 核心引擎 (23 个模块)
│   ├── storyBibleValidator.ts   # Story Bible 校验
│   ├── worldStateEngine.ts      # World State 引擎
│   ├── ruleEngine.ts            # 规则引擎
│   ├── actionParser.ts          # 行动解析器
│   ├── aiGM.ts                  # AI GM 模块
│   ├── npcKnowledgeFilter.ts    # NPC 知识过滤器
│   ├── npcPlanner.ts            # NPC 行动规划
│   ├── eventTriggerSystem.ts    # 事件触发系统
│   ├── storyController.ts       # 章节推进
│   ├── endingJudge.ts           # 结局判定
│   ├── featureExtractor.ts      # 特性提取
│   ├── rulePackSelector.ts      # 规则包选择
│   ├── metricGenerator.ts       # 指标生成
│   ├── uiConfigGenerator.ts     # UI 配置生成
│   ├── storyAnalyzer.ts         # 故事分析
│   ├── storyAdapter.ts          # 故事适配
│   ├── storyBibleGenerator.ts   # Story Bible 生成
│   └── index.ts
├── registry/
│   ├── widgetRegistry.ts   # Widget 注册表
│   └── rulePackRegistry.ts # 规则包注册表
├── types/                  # TypeScript 类型定义
│   ├── story.ts
│   ├── role.ts
│   ├── metric.ts
│   ├── worldState.ts
│   ├── room.ts
│   ├── action.ts
│   ├── ai.ts
│   ├── chat.ts
│   └── index.ts
├── mock/
│   ├── demoStoryBible.ts   # Demo 故事数据
│   └── mockAIProvider.ts   # Mock AI Provider
└── lib/
    ├── roomManager.ts      # 房间管理器
    └── gameStore.ts        # 游戏状态 Context
```

## 核心架构原则

1. **Story Bible** 是唯一故事数据源
2. **World State** 是唯一真实世界状态源
3. **Rule Engine** 是唯一状态修改入口
4. **AI GM** 可读取完整 Story Bible，但不能直接修改 World State
5. **AI NPC** 不能读取完整 Story Bible，只能读取 Knowledge Filter 的局部视野
6. 玩家交互支持 Chat / Suggested Actions / Free Action，底层统一转为 StructuredAction
7. 前端 UI 通过 Widget Registry 根据 ui_config 动态拼装

## 游戏运行流程

1. AI GM 输出当前剧情叙事
2. 玩家阅读 NarrativePanel
3. 玩家在 ChatPanel 自由 RP 发言
4. 玩家点击 Suggested Actions 或 FreeActionInput 输入行动
5. Action Parser → StructuredAction
6. Rule Engine 权限/风险/成功率结算
7. World State Engine 应用状态更新
8. Event Trigger System 检查事件
9. NPC Knowledge Filter 生成 NPC 局部视野
10. NPC Planner 生成 Action Proposal
11. NPC Proposal 进入 Rule Engine
12. Story Controller 判断章节推进
13. Ending Judge 判断结局
14. 进入下一轮

## API 路由

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/stories/generate` | 生成 Story Bible |
| POST | `/api/stories/validate` | 校验 Story Bible |
| POST | `/api/rooms` | 创建房间 |
| POST | `/api/rooms/:roomId/join` | 加入房间 |
| POST | `/api/rooms/:roomId/select-role` | 选择角色 |
| POST | `/api/rooms/:roomId/start` | 开始故事 |
| GET | `/api/rooms/:roomId/state` | 获取房间状态 |
| GET | `/api/rooms/:roomId/players/:playerId/view` | 获取玩家视角 |
| POST | `/api/rooms/:roomId/chat` | RP 聊天 |
| POST | `/api/rooms/:roomId/actions` | 提交行动 |
| POST | `/api/rooms/:roomId/npc-turn` | NPC 回合 |
| POST | `/api/rooms/:roomId/endings/check` | 检查结局 |

## MVP 实现优先级

- **P0**: 类型定义、Demo Story Bible、Validator、Room System、World State Engine、Action Parser、Rule Engine、UI Builder、基础游戏界面 ✅
- **P1**: AI GM mock、NPC Knowledge Filter、NPC Planner、Event Trigger System、Story Controller、Ending Judge ✅
- **P2**: 完整 Story Analyzer、Story Adapter、多 Rule Pack 组合、数据库持久化 (框架已预留)
