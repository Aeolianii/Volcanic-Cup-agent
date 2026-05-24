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

### v1.6 - 2026-05-24

#### Agent-Based Story Simulation MVP 闭环

- 打通从“用户输入故事创意”到 Story Bible 生成、可玩性分析、校验、规则/UI 配置、创建房间、选角、开局、玩家行动、规则结算、世界状态更新、事件触发和结局结算的 MVP 主链路。
- 生成入口支持单段“故事创意”输入，也兼容题材、开场、角色、世界观等结构化字段；后端会统一归一化 StorySeed。
- AI 可玩性分析与本地 `analyzeStory` 规则合并判断，生成 Story Bible 前后都会形成可执行的题材、模块和后果配置。

#### 题材驱动模块配置

- 新增 Story Adaptation Layer，自动生成 CharacterModel、FactionModel、RelationshipGraph、KnowledgeGraph、VictoryConditions 和 Runtime Modules。
- 校园言情、恋爱、搞笑、推理、恐怖、权谋、战斗冒险、职场和通用故事会启用不同玩法模块。
- 校园言情默认启用关系线、调查和攻略失败，不启用角色死亡。
- 搞笑本默认启用整活挫折，不启用角色死亡和严肃失败界面。
- 恐怖、战争、暗杀等高风险题材才启用死亡、幽灵旁观和致命后果。

#### 知识边界与信息迷雾

- 新增 Knowledge Boundary 系统，玩家和 NPC 只能看到自身信息、公开信息、已发现信息和合法阵营信息。
- NPC 局部视野升级为 Knowledge Layer、Memory Layer、Decision Layer、Action Layer 的受限架构，不再读取完整 Story Bible、隐藏身份、未来事件或全部结局。
- 阵营面板只显示合法可见成员，隐藏阵营成员不会因为 Story Bible 存在就提前泄露。

#### 调查、聊天与平衡系统

- InvestigationAction 扩展为调查、搜索、追踪、窃听、审问、解码、潜伏、占卜和情报搜集，并支持发现事实、误导信息、怀疑上升和假线索。
- 新增多频道 Chat Layer：公共频道、阵营频道和解锁式私聊；跨阵营私聊需要通过关系、任务或互动解锁。
- 新增 GM Balancer Agent，基于信息、资源、关系、战力、阵营和影响力评估玩家优势，只生成叙事一致的软平衡事件，不直接改写胜负。

#### 角色状态与结算

- 角色状态机支持 Alive、Dead、Missing、Imprisoned、Defeated 和 Setback。
- 死亡题材下玩家死亡后进入 Ghost Mode，可旁观故事和查看结算，但不能发言、行动或改变世界状态。
- 非死亡题材会把高风险行动解释为题材安全的后果，例如攻略失败、社交受挫、推理受阻或整活翻车。
- 结算系统拆分 FactionVictory 和 PersonalVictory，死亡或退场角色仍可保留阵营胜利判断。

#### 玩家界面与中文呈现

- 生成页新增“故事创意”输入框，并展示可玩性评分、设计说明、玩法模块、题材类型和后果模式。
- 游戏界面支持多频道聊天窗口、未读提示、频道切换、阵营可见成员和模块化玩家视图。
- 所有新增提示、界面文案和更新说明均使用中文；源码按 UTF-8 读取验证，避免中文乱码。

#### 验证

- 已通过 `npm run build`。
- 已在浏览器验证 `/generate` 页面中文正常、无乱码特征。
- 已通过 API 烟测验证校园言情：`campus_romance`、攻略失败、无角色死亡、可建房开局、可提交行动并推进回合。
- 已通过 API 烟测验证搞笑本：`comedy`、整活翻车、无角色死亡、无失败界面。

完整更新日志已合并到 README。

### v1.5 - 2026-05-24

#### NPC Agent 对抗行动系统

- 每个 NPC 现在拥有持久 Runtime State，包括目标层级、长期记忆、威胁评估、关系快照和自身 active modifiers。
- NPC 默认每 2 回合行动一次，按 `Observe -> Think -> Plan -> Act` 主动推进世界，而不是等待玩家触发。
- NPC Planner 只能读取 Knowledge Filter 生成的局部视野，不能读取完整 Story Bible、结局条件、未来章节或其他 NPC 秘密。

#### 规则结算与公平性

- NPC 行动必须先生成 proposal，再由 Rule Engine 转换为 StructuredAction 语义并审核结算。
- 成功率公式加入 NPC 干扰项和 35% 下限，NPC 可以误导、隐藏、延迟和伪造假证据，但不能永久删除关键线索。
- 增加 `max_consecutive_target = 2`，避免 NPC 无限锁定同一玩家。

#### 导入故事与玩家视图

- NPC Agent 不再依赖 Demo 固定指标或地点，会动态匹配导入故事中的进度、势力、压力、怀疑、稳定、信任等指标。
- 事件追踪面板只显示已解锁事件，避免玩家提前看到后续剧情节点。
- 已知事实和线索增加展示清洗，避免内部 id、英文调试文本和状态 key 泄露给玩家。

完整更新日志见 [CHANGELOG.md](CHANGELOG.md)。

### v1.4 - 2026-05-24

#### AI GM 推进推理

- 新增 `progression_guidance` 上下文，AI GM 会读取未触发事件、缺失条件、关键指标和已使用行动来生成下一步推荐。
- 推荐行动必须围绕 World State 的事件链缺口，或承接上一成功行动形成关联优势。
- LLM prompt 强化为“能推进事件、指标或结局”的行动建议，减少导入故事里的重复模板按钮。

#### 通用 Rule Engine 推进

- Rule Engine 自动识别 Story Bible 中的进度、稳定、压力/影响、信任/关系类指标，不再只适配圣杯 Demo。
- 调查、交谈、公开证据、澄清、阻止、稳定局势、资源准备和结局收束行动会按导入故事自己的指标推进。
- 收束类行动会向优先级最高的结局条件靠拢，帮助故事进入可判定结局区间。

#### 行动成功率与连携优势

- 降低高风险行动门槛，并保留低/中风险成功率优化。
- 成功行动会记录动量、目标锁定、类别优势和已完成行动签名。
- 调查成功会增强后续社交和政治/指挥类行动，让“先铺垫、再推进”的行动链更可靠。

#### 推荐行动与事件推进

- 推荐行动会过滤上一行动和已完成行动，并按推进价值排序。
- 事件的 `add_knowledge` 效果会同步写入后续触发所需 flag，避免拿到线索但事件链断开。
- Demo 可从真相进度 15 推进到 100；导入故事已验证校园言情事件链可连续推进。

完整更新日志见 [CHANGELOG.md](CHANGELOG.md)。

### v1.3 - 2026-05-24

#### 隐藏指标与模糊化反馈

- 新增隐藏/条件指标系统，后台记录真实数值，玩家叙事中以"暗流变化"形式呈现模糊化反馈。
- AI GM 上下文通过 `implicit_effects` 传递隐藏指标效果，禁止输出隐藏指标名称和具体数值。
- GM 叙事"局势变化"仅显示公开指标，隐藏指标不再泄露到玩家文本。

#### 推荐行动生成改进

- 导入故事的推荐行动必须来自 AI，结合 Story Bible、World State、当前章节和上一行动结果生成，不再使用本地模板冒充。
- 强化 LLM 推荐行动 prompt，要求基于当前剧情生成，不得重复上一行动。
- 修复兜底叙事路径漏传 `lastAction` 导致推荐行动重复的问题；提交失败时恢复原列表。

#### Rule Engine 与行动优势系统

- 新增行动优势机制：成功行动后积累动量、目标锁定和类别优势，为后续行动提供骰面加成。
- 调整风险等级阈值，整体提升行动成功率。
- 调查类和社交类行动根据方法和目标差异化推进真相进度。

#### 事件效果与章节推进

- 事件触发后自动应用事件效果到 World State，支持设置标记、修改指标、添加知识和切换位置。
- 行动结算后检查章节推进条件，满足时自动切换章节。

#### AI Provider 与 GM 叙事

- 移除 Mock Provider 自动降级逻辑，AI 失败时明确返回错误。
- GM 叙事改用严格 JSON 解析，不再提供 mock fallback。
- AI GM 上下文中指标使用 Story Bible label 提升叙事可读性。

#### Demo：失落圣杯之夜

- 修复追问主教推荐行动文案，改为"向主教核对大法师说法"并携带线索上下文。
- 验证推荐行动刷新不再重复已执行的行动。

完整更新日志见 [CHANGELOG.md](CHANGELOG.md)。

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
