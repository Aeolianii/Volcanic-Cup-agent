import type {
  AIProvider,
  GMActionContext,
  GMContext,
  GMNarrativeOutput,
  ProgressionGuidance,
  RuleResult,
  StoryBible,
  StructuredAction,
  WorldState,
} from "@/types";

/**
 * AI GM can read Story Bible and World State, but can only output narration,
 * suggested events, revealed information and suggested actions.
 */
export async function generateGMNarrative(
  bible: StoryBible,
  state: WorldState,
  aiProvider: AIProvider,
  phase: "opening" | "chapter_start" | "turn_narration" | "event_narration" | "ending",
  actionContext?: {
    action: StructuredAction;
    result: RuleResult;
    triggered_events?: Array<{ id: string; title: string; description?: string }>;
  }
): Promise<GMNarrativeOutput> {
  const context = buildGMContext(bible, state, actionContext);

  try {
    const output = await withTimeout(
      aiProvider.generateNarrative(context),
      getNarrativeTimeoutMs(bible, Boolean(context.last_action))
    );
    if (isUsableNarrative(output)) {
      return sanitizeNarrativeOutput({
        ...output,
        suggested_actions: refreshSuggestedActions(output.suggested_actions, state, bible, context.last_action),
      });
    }
  } catch {
    if (!allowsTemplateFallback(bible)) {
      return sanitizeNarrativeOutput(failedNarrative(context.last_action, state, bible));
    }
  }

  if (!allowsTemplateFallback(bible)) {
    return sanitizeNarrativeOutput(failedNarrative(context.last_action, state, bible));
  }

  return sanitizeNarrativeOutput(templateNarrative(bible, state, phase, context.last_action));
}

function allowsTemplateFallback(bible: StoryBible): boolean {
  return bible.id === "demo_lost_holy_grail";
}

function getNarrativeTimeoutMs(bible: StoryBible, hasAction: boolean): number {
  if (!hasAction) return 3000;
  return allowsTemplateFallback(bible) ? 4500 : 16000;
}

function failedNarrative(
  lastAction: GMActionContext | undefined,
  state: WorldState,
  bible: StoryBible
): GMNarrativeOutput {
  return {
    narration: [
      `第 ${state.chapter} 章 · 第 ${state.turn} 回合`,
      lastAction ? `行动已由规则引擎完成结算：${lastAction.public_result}` : `《${bible.title}》的当前叙事请求已经提交。`,
      "AI GM 没有成功返回本次叙事结果。为避免用模板剧情替代导入故事的真实生成，系统没有生成替代剧情。",
      "请重新提交行动，或检查 AI API 配置、模型响应时间和网络状态。",
    ].join("\n\n"),
    suggested_events: lastAction?.triggered_events.map((event) => event.id) || [],
    revealed_information: [],
    suggested_actions: allowsTemplateFallback(bible) && lastAction
      ? generateContextualActions(state, bible, lastAction)
      : [],
    mood: "tense",
  };
}

function sanitizeNarrativeOutput(output: GMNarrativeOutput): GMNarrativeOutput {
  return {
    ...output,
    narration: sanitizeDisplayText(output.narration),
    revealed_information: output.revealed_information.map((item) => ({
      ...item,
      title: sanitizeDisplayText(item.title),
      content: sanitizeDisplayText(item.content),
    })),
    suggested_actions: output.suggested_actions.map((action) => ({
      ...action,
      label: sanitizeDisplayText(action.label),
      context: sanitizeDisplayText(action.context),
    })),
  };
}

function sanitizeDisplayText(text: string): string {
  const replacements: Record<string, string> = {
    connected_location: "相关地点",
    "connected location": "相关地点",
    current_location: "当前位置",
    "current location": "当前位置",
    current_event: "当前事件",
    "current event": "当前事件",
    informed_npc: "知情者",
    "informed npc": "知情者",
    self_goal: "自己的目标",
    "self goal": "自己的目标",
    npc_archmage: "大法师",
    npc_old_king: "老国王",
    npc_bishop: "主教",
    role_prince: "王子",
    role_saintess: "圣女",
    role_assassin: "刺客",
    role_knight: "骑士",
    archmage: "大法师",
    old_king: "老国王",
    bishop: "主教",
    holy_grail: "圣杯",
    truth_progress: "真相进度",
    "truth progress": "真相进度",
    kingdom_stability: "王国稳定度",
    holy_grail_influence: "圣杯影响力",
  };

  return Object.entries(replacements).reduce(
    (value, [key, label]) => value.replace(new RegExp(`\\b${key}\\b`, "g"), label),
    text
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AI GM timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function buildGMContext(
  bible: StoryBible,
  state: WorldState,
  actionContext?: {
    action: StructuredAction;
    result: RuleResult;
    triggered_events?: Array<{ id: string; title: string; description?: string }>;
  }
): GMContext {
  const currentChapter = bible.chapters.find((chapter) => chapter.order === state.chapter);
  const eventLabel = (eventId: string) =>
    bible.events.find((event) => event.id === eventId)?.title || eventId;
  const lastAction = actionContext
    ? buildLastActionContext(actionContext.action, actionContext.result, bible, state, actionContext.triggered_events || [])
    : undefined;

  return {
    story_bible: {
      title: bible.title,
      world_setting: bible.world_setting.atmosphere,
      roles: bible.roles.map((role) => ({
        id: role.id,
        name: role.name,
        public_identity: role.public_identity,
      })),
      npcs: bible.npcs.map((npc) => ({
        id: npc.id,
        name: npc.name,
        public_identity: npc.public_identity,
      })),
      chapters: bible.chapters.map((chapter) => ({ id: chapter.id, title: chapter.title })),
      current_chapter_events: (currentChapter?.key_events || []).map(eventLabel),
    },
    world_state_summary: {
      flags: state.flags,
      metrics: state.metrics
        .filter((metric) => isPlayerVisibleMetric(metric.metric_id, bible))
        .map((metric) => ({
          id: metric.metric_id,
          label: bible.metrics.find((item) => item.id === metric.metric_id)?.label || metric.metric_id,
          value: metric.value,
        })),
      active_events: state.events
        .filter((event) => event.triggered)
        .map((event) => eventLabel(event.event_id)),
      player_locations: Object.fromEntries(
        state.locations
          .filter((location) => location.present_characters.length > 0)
          .flatMap((location) => location.present_characters.map((character) => [character, location.id]))
      ),
    },
    progression_guidance: buildProgressionGuidance(bible, state, lastAction),
    recent_events: state.events
      .filter((event) => event.triggered)
      .map((event) => eventLabel(event.event_id)),
    current_turn: state.turn,
    current_chapter: state.chapter,
    last_action: lastAction,
  };
}

function buildProgressionGuidance(
  bible: StoryBible,
  state: WorldState,
  lastAction?: GMActionContext
): ProgressionGuidance {
  const progressMetric = pickMetricSummary(bible, state, [
    "truth_progress", "progress", "truth", "clue", "evidence", "真相", "进度", "线索", "证据",
  ]);
  const stabilityMetric = pickMetricSummary(bible, state, [
    "kingdom_stability", "situation_stability", "political_stability", "stability", "order", "safety", "稳定", "秩序", "安全",
  ]);
  const pressureMetric = pickMetricSummary(bible, state, [
    "holy_grail_influence", "supernatural_pressure", "faction_power", "suspicion", "pressure", "influence", "power", "tension", "怀疑", "压力", "影响", "势力", "紧张",
  ]);

  const nextEvents = bible.events
    .filter((event) => !state.events.find((item) => item.event_id === event.id)?.triggered)
    .slice(0, 4)
    .map((event) => ({
      id: event.id,
      title: event.title,
      chapter_id: event.chapter_id,
      missing_conditions: event.trigger.conditions
        .filter((condition) => !conditionSatisfiedForGuidance(condition.field, condition.operator, condition.value, state))
        .map((condition) => describeCondition(condition.field, condition.operator, condition.value, bible, state)),
    }));

  const actorDonePrefix = lastAction ? `done_${lastAction.actor_id}_` : "";
  const avoidActionKeys = Object.keys(state.flags)
    .filter((flag) => flag.startsWith("done_") && state.flags[flag])
    .map((flag) => actorDonePrefix && flag.startsWith(actorDonePrefix)
      ? flag.slice(actorDonePrefix.length)
      : flag.replace(/^done_/, ""))
    .slice(-12);

  if (lastAction) {
    avoidActionKeys.push(actionKey(lastAction.action_type, lastAction.target, lastAction.method, lastAction.intent));
  }

  return {
    progress_metric: progressMetric,
    stability_metric: stabilityMetric,
    pressure_metric: pressureMetric,
    next_events: nextEvents,
    action_strategy: buildActionStrategy(nextEvents, lastAction),
    avoid_action_keys: Array.from(new Set(avoidActionKeys)),
  };
}

function pickMetricSummary(
  bible: StoryBible,
  state: WorldState,
  candidates: string[]
): ProgressionGuidance["progress_metric"] {
  const metric = bible.metrics.find((item) => {
    const haystack = `${item.id} ${item.label}`.toLowerCase();
    return candidates.some((candidate) => item.id === candidate || haystack.includes(candidate.toLowerCase()));
  });
  if (!metric) return undefined;
  return {
    id: metric.id,
    label: metric.label,
    value: state.metrics.find((item) => item.metric_id === metric.id)?.value ?? metric.initial,
  };
}

function conditionSatisfiedForGuidance(field: string, operator: string, value: unknown, state: WorldState): boolean {
  const metric = state.metrics.find((item) => item.metric_id === field);
  if (metric) return compareGuidanceValue(metric.value, operator, value);

  if (field in state.flags) return operator === "exists" ? state.flags[field] === true : compareGuidanceValue(state.flags[field], operator, value);

  if (field.startsWith("flag_")) {
    const flagValue = state.flags[field.replace(/^flag_/, "")];
    return operator === "exists" ? flagValue === true : compareGuidanceValue(flagValue, operator, value);
  }

  if (field === "turn") return compareGuidanceValue(state.turn, operator, value);
  if (field === "chapter") return compareGuidanceValue(state.chapter, operator, value);

  if (field.startsWith("event_")) {
    const eventId = field.replace(/^event_/, "");
    const eventState = state.events.find((event) => event.event_id === eventId);
    return operator === "exists" ? eventState?.triggered === true : compareGuidanceValue(eventState?.triggered, operator, value);
  }

  return false;
}

function compareGuidanceValue(current: unknown, operator: string, target: unknown): boolean {
  switch (operator) {
    case "eq": return current === target;
    case "gt": return Number(current) > Number(target);
    case "lt": return Number(current) < Number(target);
    case "gte": return Number(current) >= Number(target);
    case "lte": return Number(current) <= Number(target);
    case "contains": return String(current).includes(String(target));
    case "exists": return current !== undefined && current !== null;
    default: return false;
  }
}

function describeCondition(field: string, operator: string, value: unknown, bible: StoryBible, state: WorldState): string {
  if (field.startsWith("event_")) {
    const eventId = field.replace(/^event_/, "");
    const event = bible.events.find((item) => item.id === eventId);
    return `需要先推动事件「${event?.title || "前置事件"}」`;
  }

  const metric = bible.metrics.find((item) => item.id === field);
  if (metric) {
    const current = state.metrics.find((item) => item.metric_id === field)?.value ?? metric.initial;
    return `需要让「${metric.label}」满足 ${operator} ${value}（当前 ${current}）`;
  }

  if (field === "turn") return `需要回合推进到 ${value}`;
  if (field === "chapter") return `需要章节推进到 ${value}`;
  if (field.startsWith("flag_")) return "需要先完成一个相关前置行动";
  return "需要补足一个未完成的前置条件";
}

function buildActionStrategy(
  nextEvents: ProgressionGuidance["next_events"],
  lastAction?: GMActionContext
): string[] {
  const missing = nextEvents.flatMap((event) => event.missing_conditions);
  const strategy = [
    "生成 3 到 5 个新的下一步行动，必须围绕未触发事件的缺口设计。",
    "不要重复上一行动，也不要把已点击过的行动换个说法重新给出。",
  ];

  if (lastAction?.success) {
    strategy.push("上一行动成功，优先给出能承接其线索、目标或行动类型的关联行动，让玩家感到铺垫产生了优势。");
  } else if (lastAction) {
    strategy.push("上一行动失败，给出补救、换目标、降低风险或另辟路径的行动，而不是继续原地重复。");
  }

  if (missing.some((item) => item.includes("指标") || item.includes("满足"))) {
    strategy.push("如果下一事件缺少指标进度，推荐调查、核对、公开证据、协调关系或稳定局势等能改变指标的行动。");
  }
  if (missing.some((item) => item.includes("前置事件"))) {
    strategy.push("如果下一事件缺少前置事件，推荐能直接推动该前置事件浮现的行动。");
  }

  return strategy;
}

function buildLastActionContext(
  action: StructuredAction,
  result: RuleResult,
  bible: StoryBible,
  state: WorldState,
  triggeredEvents: Array<{ id: string; title: string; description?: string }>
): GMActionContext {
  return {
    actor_id: action.actor_id,
    actor_name: formatEntityName(action.actor_id, bible, state),
    action_type: action.action_type,
    action_label: isReflectAction(action) ? "梳理角色目标" : actionLabel(action.action_type),
    target: action.target,
    target_name: formatEntityName(action.target, bible, state),
    method: action.method,
    intent: action.intent,
    risk_level: action.risk_level,
    raw_input: action.raw_input,
    success: result.success,
    public_result: result.public_result,
    private_result: result.private_result,
    implicit_effects: buildImplicitMetricEffects(result.state_updates, bible),
    state_updates: result.state_updates
      .filter((update) => update.type !== "metric_change" || !update.metric || isPlayerVisibleMetric(update.metric, bible))
      .map((update) => ({
        type: update.type,
        target: update.target,
        fact_id: update.fact_id,
        metric: update.metric,
        delta: update.delta,
        value: update.value,
      })),
    triggered_events: triggeredEvents,
  };
}

function isUsableNarrative(output: GMNarrativeOutput | null | undefined): output is GMNarrativeOutput {
  return Boolean(output?.narration && Array.isArray(output.suggested_actions));
}

function templateNarrative(
  bible: StoryBible,
  state: WorldState,
  phase: string,
  lastAction?: GMActionContext
): GMNarrativeOutput {
  const currentChapter = bible.chapters.find((chapter) => chapter.order === state.chapter);
  const activeEvents = state.events
    .filter((event) => event.triggered)
    .map((event) => bible.events.find((storyEvent) => storyEvent.id === event.event_id))
    .filter(Boolean);

  if (phase === "opening") {
    return {
      narration: [
        `# ${bible.title}`,
        bible.world_setting.atmosphere,
        currentChapter ? `当前章节：${currentChapter.title}` : "故事即将开始。",
        currentChapter?.description || "",
        "你的角色已经入场。现在的每一步行动都会改变局势、关系和结局判断。",
      ].filter(Boolean).join("\n\n"),
      suggested_events: currentChapter?.key_events || [],
      revealed_information: [
        {
          type: "fact",
          title: "世界背景",
          content: bible.world_setting.atmosphere,
          visible_to: ["all"],
        },
      ],
      suggested_actions: generateContextualActions(state, bible, lastAction),
      mood: "opening",
    };
  }

  if (lastAction) {
    const actionNarration = buildActionNarration(lastAction, bible, state);
    return {
      narration: actionNarration,
      suggested_events: lastAction.triggered_events.map((event) => event.id),
      revealed_information: buildRevealedInformation(lastAction),
      suggested_actions: generateContextualActions(state, bible, lastAction),
      mood: lastAction.success ? "investigative" : "tense",
    };
  }

  if (phase === "event_narration") {
    const latestEvent = activeEvents[activeEvents.length - 1];
    return {
      narration: latestEvent
        ? `【事件推进】${latestEvent.title}\n\n${latestEvent.description}`
        : "新的发展正在浮现，局势开始偏离原本的轨道。",
      suggested_events: [],
      revealed_information: latestEvent
        ? [{
            type: "event",
            title: latestEvent.title,
            content: latestEvent.description,
            visible_to: latestEvent.visibility === "public" ? ["all"] : [],
          }]
        : [],
      suggested_actions: generateContextualActions(state, bible),
      mood: "dramatic",
    };
  }

  return {
    narration: [
      `第 ${state.turn} 回合`,
      activeEvents.length > 0
        ? `当前事件：${activeEvents.map((event) => event?.title).join("、")}`
        : "局势仍在酝酿，尚未出现公开事件。",
      "请根据你的公开目标、秘密目标和已知情报选择下一步行动。",
    ].join("\n\n"),
    suggested_events: [],
    revealed_information: [],
    suggested_actions: generateContextualActions(state, bible),
    mood: "tense",
  };
}

function buildActionNarration(
  lastAction: GMActionContext,
  bible: StoryBible,
  state: WorldState
): string {
  const activeEvents = state.events
    .filter((event) => event.triggered)
    .map((event) => bible.events.find((storyEvent) => storyEvent.id === event.event_id)?.title)
    .filter(Boolean);
  const metricLines = lastAction.state_updates
    .filter((update) =>
      update.type === "metric_change" &&
      update.metric &&
      update.delta &&
      isPlayerVisibleMetric(update.metric, bible)
    )
    .map((update) => {
      const metricName = bible.metrics.find((metric) => metric.id === update.metric)?.label || update.metric;
      return `${metricName}${Number(update.delta) > 0 ? "上升" : "下降"}${Math.abs(Number(update.delta))}`;
    });
  const implicitLines = lastAction.implicit_effects || [];
  const triggeredLines = lastAction.triggered_events.map((event) => `新的事件被推到台前：${event.title}。`);
  const resultLine = lastAction.success
    ? buildSuccessfulActionResult(lastAction, bible)
    : `${lastAction.actor_name}的尝试没有达成预期，${lastAction.target_name}没有给出真正有用的回应。`;

  return [
    `第 ${state.turn} 回合`,
    `${lastAction.actor_name}${lastAction.success ? "完成了" : "尝试了"}“${lastAction.action_label}”：${lastAction.raw_input || lastAction.public_result}`,
    resultLine,
    metricLines.length > 0 ? `局势变化：${metricLines.join("，")}。` : "",
    implicitLines.length > 0 ? `暗流变化：${implicitLines.join("，")}` : "",
    triggeredLines.join("\n"),
    activeEvents.length > 0 ? `当前公开事件：${activeEvents.join("、")}。` : "",
  ].filter(Boolean).join("\n\n");
}

function buildSuccessfulActionResult(lastAction: GMActionContext, bible: StoryBible): string {
  const targetNpc = bible.npcs.find((npc) => npc.id === lastAction.target || npc.name === lastAction.target_name);
  const firstEvent = bible.events[0];

  if (isReflectActionContext(lastAction)) {
    return "你把公开目标、秘密目标和当前公开事件重新放在同一张行动表上：短期内应先确认关键证词和可验证线索，再决定要公开施压、私下试探，还是保留筹码等待更好的时机。这次梳理不会直接揭开真相，但会让下一步行动更有方向。";
  }

  if (lastAction.action_type === "talk" && targetNpc) {
    if (targetNpc.id.includes("archmage") || targetNpc.name.includes("大法师")) {
      return `${targetNpc.name}没有直接回答全部问题，但他承认圣杯失窃前后圣殿的魔力潮汐出现过异常。他提醒你：真正值得追问的不是“谁拿走了圣杯”，而是“谁有能力让圣殿记录同时失真”。这条线索把调查指向圣殿内部的仪式记录和主教的封存档案。`;
    }
    if (targetNpc.id.includes("bishop") || targetNpc.name.includes("主教")) {
      return `${targetNpc.name}措辞谨慎，只承认圣殿昨夜临时封锁过内殿。他的回避让你意识到，圣殿的公开说法和实际时间线之间存在缺口。`;
    }
    return `${targetNpc.name}给出了一段有价值的回应：${targetNpc.public_identity}掌握的信息与“${firstEvent?.title || "当前事件"}”存在交叉，你获得了新的询问方向。`;
  }

  if (["investigate", "search", "track", "eavesdrop", "interrogate", "decode"].includes(lastAction.action_type)) {
    return `你在${lastAction.target_name}获得了可验证的线索。它不能立刻揭开真相，但足以缩小范围：后续可以围绕记录、证词和异常痕迹继续推进。`;
  }

  if (["persuade", "threaten", "deceive", "ally", "betray", "confess"].includes(lastAction.action_type)) {
    return `${lastAction.target_name}的态度发生了变化。关系的松动会影响后续对话中能问出的信息，也可能改变其他人的警惕程度。`;
  }

  return `${lastAction.public_result} 这个选择已经写入当前局势，后续叙事会围绕它产生新的压力和机会。`;
}

function buildRevealedInformation(lastAction: GMActionContext): GMNarrativeOutput["revealed_information"] {
  if (!lastAction.success) return [];
  return lastAction.state_updates
    .filter((update) => update.type === "add_known_fact" || update.type === "add_evidence")
    .map((update) => ({
      type: update.type === "add_evidence" ? "clue" as const : "fact" as const,
      title: "行动结果",
      content: String(update.fact_id || lastAction.public_result),
      visible_to: [lastAction.actor_id],
    }));
}

function isPlayerVisibleMetric(metricId: string, bible: StoryBible): boolean {
  return bible.metrics.find((metric) => metric.id === metricId)?.visibility === "public";
}

function buildImplicitMetricEffects(updates: RuleResult["state_updates"], bible: StoryBible): string[] {
  const effects = updates
    .filter((update) => update.type === "metric_change" && update.metric && update.delta)
    .filter((update) => !isPlayerVisibleMetric(update.metric!, bible))
    .map((update) => implicitMetricEffect(update.metric!, Number(update.delta), bible))
    .filter(Boolean);

  return Array.from(new Set(effects));
}

function implicitMetricEffect(metricId: string, delta: number, bible: StoryBible): string {
  const metric = bible.metrics.find((item) => item.id === metricId);
  const label = metric?.label || metricId;
  const text = `${metricId} ${label}`.toLowerCase();

  if (text.includes("suspicion") || label.includes("怀疑") || label.includes("戒心")) {
    return delta > 0 ? "你的举动引起了一些人的怀疑。" : "周围的戒心稍稍缓和。";
  }
  if (text.includes("trust") || label.includes("信任")) {
    return delta > 0 ? "有人对你的态度悄悄缓和。" : "某些关系正在变得紧绷。";
  }
  if (text.includes("influence") || label.includes("影响")) {
    return delta > 0 ? "某种难以言说的影响正在加深。" : "某种无形影响暂时退去了一些。";
  }
  if (label.includes("稳定") || text.includes("stability")) {
    return delta > 0 ? "局面表面上稳住了一些。" : "局面下方出现了新的裂痕。";
  }

  return delta > 0 ? "暗处的压力正在升高。" : "暗处的压力稍有回落。";
}

function actionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    talk: "交谈",
    persuade: "说服",
    threaten: "威胁",
    deceive: "欺骗",
    ally: "结盟",
    betray: "背叛",
    confess: "坦白",
    investigate: "调查",
    search: "搜索",
    track: "追踪",
    eavesdrop: "偷听",
    interrogate: "盘问",
    decode: "解读",
    command: "指挥",
    summon_meeting: "召集会议",
    gain_support: "争取支持",
    coup: "夺权",
    impeach: "弹劾",
    appoint: "任命",
    attack: "攻击",
    assassinate: "刺杀",
    duel: "决斗",
    ambush: "伏击",
    defend: "防守",
    buy: "收买",
    trade: "交易",
    steal: "偷取",
    transport: "转移",
    build: "建造",
  };
  return labels[actionType] || actionType;
}

function formatEntityName(id: string | undefined, bible: StoryBible, state: WorldState): string {
  if (!id || id === "unknown") return "当前目标";
  if (id === "self_goal") return "自己的目标";

  const knownLabels: Record<string, string> = {
    current_location: "当前位置",
    connected_location: "相关地点",
    current_event: "当前事件",
    informed_npc: "知情者",
    witness: "证人",
    guard: "守卫",
    archmage: "大法师",
    old_king: "老国王",
    bishop: "主教",
    prince: "王子",
    saintess: "圣女",
    assassin: "刺客",
    knight: "骑士",
    holy_grail: "圣杯",
  };
  if (knownLabels[id]) return knownLabels[id];

  const role = bible.roles.find((item) => item.id === id || item.name === id);
  if (role) return role.name;
  const npc = bible.npcs.find((item) => item.id === id || item.name === id);
  if (npc) return npc.name;
  const location = state.locations.find((item) => item.id === id || item.name === id);
  if (location) return location.name;
  const event = bible.events.find((item) => item.id === id || item.title === id);
  if (event) return event.title;
  if (id.startsWith("player_")) return "玩家";
  return id.replace(/^npc_/, "").replace(/^role_/, "").replace(/_/g, " ");
}

function isReflectAction(action: StructuredAction): boolean {
  return action.target === "self_goal" || action.method === "reflect" || action.intent === "plan_next_move";
}

function isReflectActionContext(action: GMActionContext): boolean {
  return action.target === "self_goal" || action.method === "reflect" || action.intent === "plan_next_move";
}

function generateContextualActions(
  state: WorldState,
  bible: StoryBible,
  lastAction?: GMActionContext
): GMNarrativeOutput["suggested_actions"] {
  const firstVisibleEvent = bible.events.find((event) => {
    const eventState = state.events.find((item) => item.event_id === event.id);
    return event.visibility === "public" && (!eventState || eventState.triggered);
  }) || bible.events[0];

  const firstNpc = bible.npcs[0];
  const currentTarget =
    state.locations.find((location) => location.present_characters.length > 0)?.id ||
    "current_location";

  const actions: GMNarrativeOutput["suggested_actions"] = [
    {
      label: "调查当前线索",
      action_type: "investigate",
      target: firstVisibleEvent?.id || currentTarget,
      method: "focused_inquiry",
      intent: "find_clues",
      risk_level: "low",
      context: firstVisibleEvent
        ? `围绕“${firstVisibleEvent.title}”寻找更多证据`
        : "先确认当前地点有哪些可用信息",
    },
    {
      label: "梳理角色目标",
      action_type: "investigate",
      target: "self_goal",
      method: "reflect",
      intent: "plan_next_move",
      risk_level: "low",
      context: "把公开目标与秘密目标转化为下一步计划",
    },
  ];

  if (firstNpc) {
    actions.push({
      label: `试探${firstNpc.name}`,
      action_type: "talk",
      target: firstNpc.id,
      method: "careful_conversation",
      intent: "gather_information",
      risk_level: "medium",
      context: `${firstNpc.public_identity}，可能掌握与你当前处境相关的信息`,
    });
  }

  return mergeSuggestedActions(buildFollowUpActions(state, bible, lastAction), actions, lastAction).slice(0, 5);
}

function refreshSuggestedActions(
  aiActions: GMNarrativeOutput["suggested_actions"],
  state: WorldState,
  bible: StoryBible,
  lastAction?: GMActionContext
): GMNarrativeOutput["suggested_actions"] {
  if (!allowsTemplateFallback(bible)) {
    return filterFreshSuggestedActions(
      rankProgressiveActions(mergeSuggestedActions([], aiActions, lastAction), state, bible),
      state,
      lastAction
    ).slice(0, 5);
  }

  return filterFreshSuggestedActions(
    rankProgressiveActions(
      mergeSuggestedActions(buildFollowUpActions(state, bible, lastAction), aiActions, lastAction),
      state,
      bible
    ),
    state,
    lastAction
  ).slice(0, 5);
}

function mergeSuggestedActions(
  primary: GMNarrativeOutput["suggested_actions"],
  secondary: GMNarrativeOutput["suggested_actions"],
  lastAction?: GMActionContext
): GMNarrativeOutput["suggested_actions"] {
  const usedKey = lastAction ? actionKey(lastAction.action_type, lastAction.target, lastAction.method, lastAction.intent) : "";
  const usedLabel = normalizeActionLabel(lastAction?.raw_input || lastAction?.action_label || "");
  const seen = new Set<string>();
  const seenLabels = new Set<string>();
  const merged: GMNarrativeOutput["suggested_actions"] = [];

  for (const action of [...primary, ...secondary]) {
    const key = actionKey(action.action_type, action.target, action.method, action.intent);
    const label = normalizeActionLabel(action.label);
    if (key === usedKey || label === usedLabel || seen.has(key) || seenLabels.has(label)) continue;
    seen.add(key);
    seenLabels.add(label);
    merged.push(action);
  }

  return merged;
}

function actionKey(actionType: string, target: string, method: string, intent: string): string {
  return [actionType, target, method, intent].map((value) => String(value || "").toLowerCase()).join("|");
}

function filterFreshSuggestedActions(
  actions: GMNarrativeOutput["suggested_actions"],
  state: WorldState,
  lastAction?: GMActionContext
): GMNarrativeOutput["suggested_actions"] {
  const lastKey = lastAction ? actionKey(lastAction.action_type, lastAction.target, lastAction.method, lastAction.intent) : "";
  const actorDonePrefix = lastAction ? `done_${lastAction.actor_id}_` : "";
  const usedFlagSuffixes = Object.keys(state.flags)
    .filter((flag) => flag.startsWith("done_") && state.flags[flag])
    .map((flag) => actorDonePrefix && flag.startsWith(actorDonePrefix)
      ? flag.slice(actorDonePrefix.length)
      : flag.replace(/^done_/, ""));

  return actions.filter((action) => {
    const key = actionKey(action.action_type, action.target, action.method, action.intent);
    if (key === lastKey) return false;
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
    return !usedFlagSuffixes.some((usedKey) => usedKey === safeKey || usedKey.endsWith(`_${safeKey}`));
  });
}

function rankProgressiveActions(
  actions: GMNarrativeOutput["suggested_actions"],
  state: WorldState,
  bible: StoryBible
): GMNarrativeOutput["suggested_actions"] {
  const nextEventIds = bible.events
    .filter((event) => !state.events.find((item) => item.event_id === event.id)?.triggered)
    .slice(0, 3)
    .map((event) => event.id);

  return [...actions].sort((a, b) => scoreActionForProgress(b, nextEventIds) - scoreActionForProgress(a, nextEventIds));
}

function scoreActionForProgress(action: GMNarrativeOutput["suggested_actions"][number], nextEventIds: string[]): number {
  let score = 0;
  if (nextEventIds.includes(action.target)) score += 20;
  if (["investigate", "search", "track", "eavesdrop", "interrogate", "decode"].includes(action.action_type)) score += 10;
  if (["persuade", "confess", "command", "gain_support", "summon_meeting", "defend"].includes(action.action_type)) score += 8;
  if (/resolve|stop|stabilize|public|evidence|clarify|confront|解决|阻止|稳定|公开|证据|澄清|对质/.test(`${action.method} ${action.intent} ${action.context}`)) score += 8;
  return score;
}

function normalizeActionLabel(label: string): string {
  return String(label || "").replace(/[“”"'\s]/g, "").toLowerCase();
}

function buildFollowUpActions(
  state: WorldState,
  bible: StoryBible,
  lastAction?: GMActionContext
): GMNarrativeOutput["suggested_actions"] {
  const activeEvent = state.events.find((event) => event.triggered);
  const event = bible.events.find((item) => item.id === activeEvent?.event_id) || bible.events[0];
  const archmage = bible.npcs.find((npc) => npc.name.includes("大法师")) || bible.npcs[0];
  const bishop = bible.npcs.find((npc) => npc.name.includes("主教")) || bible.npcs[1] || bible.npcs[0];
  const oldKing = bible.npcs.find((npc) => npc.name.includes("国王")) || bible.npcs[2] || bible.npcs[0];
  const truthProgress = Number(state.metrics.find((metric) => metric.metric_id === "truth_progress")?.value ?? 0);

  if (lastAction?.target === "self_goal" || lastAction?.method === "reflect") {
    return [
      {
        label: "锁定首要线索",
        action_type: "investigate",
        target: event?.id || "current_event",
        method: "prioritize_clues",
        intent: "choose_next_lead",
        risk_level: "low",
        context: "把刚梳理出的目标转化为一个明确调查方向",
      },
      {
        label: bishop ? `试探${bishop.name}` : "寻找关键证人",
        action_type: "talk",
        target: bishop?.id || "witness",
        method: "targeted_questioning",
        intent: "verify_timeline",
        risk_level: "medium",
        context: "用新的目标判断去验证时间线和证词缺口",
      },
    ];
  }

  if (lastAction?.action_type === "talk") {
    return [
      {
        label: "核对对方说法",
        action_type: "investigate",
        target: event?.id || "current_event",
        method: "cross_check_statement",
        intent: "verify_claim",
        risk_level: "low",
        context: "把刚得到的说法和现场记录、时间线进行交叉验证",
      },
      {
        label: bishop && lastAction.target !== bishop.id
          ? `向${bishop.name}核对${lastAction.target_name}说法`
          : "询问守卫",
        action_type: "talk",
        target: bishop && lastAction.target !== bishop.id ? bishop.id : "guard",
        method: "follow_up_questioning",
        intent: "find_contradiction",
        risk_level: "medium",
        context: bishop && lastAction.target !== bishop.id
          ? `带着${lastAction.target_name}刚给出的线索，验证圣殿记录和时间线是否对得上`
          : "寻找与刚才证词相冲突的细节",
      },
    ];
  }

  if (["investigate", "search", "track", "eavesdrop", "interrogate", "decode"].includes(lastAction?.action_type || "")) {
    if (state.chapter >= 3 || truthProgress >= 80) {
      return [
        {
          label: "阻断仪式核心",
          action_type: "command",
          target: "underground_altar",
          method: "ritual_interruption",
          intent: "stop_ritual",
          risk_level: "high",
          context: "真相已经接近完整，现在可以把线索转化成阻止仪式的直接行动",
        },
        {
          label: oldKing ? `向${oldKing.name}公开关键证据` : "公开关键证据",
          action_type: "persuade",
          target: oldKing?.id || "royal_court",
          method: "present_evidence",
          intent: "stabilize_realm",
          risk_level: "medium",
          context: "用已获得的证据争取公开支持，压制圣杯失窃引发的动乱",
        },
        {
          label: bishop ? `逼问${bishop.name}封锁内殿原因` : "逼问封锁内殿原因",
          action_type: "interrogate",
          target: bishop?.id || "bishop",
          method: "evidence_pressure",
          intent: "expose_contradiction",
          risk_level: "high",
          context: "把地下祭坛和圣殿封锁联系起来，迫使关键人物给出解释",
        },
      ];
    }

    if (state.chapter >= 2 || truthProgress >= 45) {
      return [
        {
          label: "追查地下入口",
          action_type: "search",
          target: "cathedral_basement",
          method: "follow_runes",
          intent: "find_altar",
          risk_level: "medium",
          context: "已有线索指向圣殿深处，继续调查可能发现失窃背后的仪式痕迹",
        },
        {
          label: bishop ? `追问${bishop.name}内殿记录` : "追问内殿记录",
          action_type: "talk",
          target: bishop?.id || "bishop",
          method: "record_confrontation",
          intent: "verify_sanctum_log",
          risk_level: "medium",
          context: "用新线索核对圣殿封锁、守夜记录和圣杯失窃时间线",
        },
        {
          label: "比对祭坛符文",
          action_type: "decode",
          target: "ancient_runes_discovered",
          method: "rune_comparison",
          intent: "identify_ritual",
          risk_level: "medium",
          context: "把已发现的异常痕迹转化为可验证的仪式证据",
        },
      ];
    }

    return [
      {
        label: archmage ? `带着线索询问${archmage.name}` : "带着线索询问知情者",
        action_type: "talk",
        target: archmage?.id || "informed_npc",
        method: "evidence_confrontation",
        intent: "interpret_clue",
        risk_level: "medium",
        context: "用刚得到的线索换取解释或逼出新的矛盾",
      },
      {
        label: "扩大搜索范围",
        action_type: "search",
        target: "connected_location",
        method: "broaden_search",
        intent: "find_related_clues",
        risk_level: "low",
        context: "沿着新线索追查相关地点和旁证",
      },
    ];
  }

  return [
    {
      label: "复盘最新局势",
      action_type: "investigate",
      target: "self_goal",
      method: "reflect",
      intent: "plan_next_move",
      risk_level: "low",
      context: "根据当前 World State 重新选择下一步优先级",
    },
  ];
}
