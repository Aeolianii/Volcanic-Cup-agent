import type {
  EventState,
  LocationState,
  MetricState,
  NPCKnowledge,
  PlayerKnowledge,
  RelationshipState,
  StateUpdate,
  WorldState,
  MemoryEntry,
  NPCRuntimeState,
} from "@/types";
import type { StoryBible } from "@/types";

export function createWorldState(
  storyId: string,
  roomId: string,
  bible: StoryBible
): WorldState {
  const metrics: MetricState[] = bible.metrics.map((m) => ({
    metric_id: m.id,
    value: m.initial,
  }));

  const events: EventState[] = bible.events.map((e) => ({
    event_id: e.id,
    triggered: false,
    resolved: false,
  }));

  const relationships: RelationshipState[] = [];

  const playerKnowledge: Record<string, PlayerKnowledge> = {};
  for (const role of bible.roles) {
    playerKnowledge[role.id] = {
      player_id: role.id,
      known_facts: [...role.initial_knowledge],
      known_npcs: [],
      known_locations: [role.starting_location],
      known_events: [],
      evidence: [],
    };
  }

  const npcKnowledge: Record<string, NPCKnowledge> = {};
  for (const npc of bible.npcs) {
    npcKnowledge[npc.id] = {
      npc_id: npc.id,
      known_facts: [...npc.initial_knowledge],
      known_events: [],
      known_players: [],
      known_player_actions: [],
      relationships: {},
      suspicions: {},
    };
  }

  return {
    story_id: storyId,
    room_id: roomId,
    chapter: 1,
    turn: 0,
    flags: {},
    metrics,
    events,
    relationships,
    locations: createLocations(bible),
    active_modifiers: [],
    npc_runtime_state: Object.fromEntries(
      bible.npcs.map((npc) => [
        npc.id,
        {
          ...createInitialNPCRuntime(npc),
        },
      ])
    ),
    knowledge_state: {
      player_knowledge: playerKnowledge,
      npc_knowledge: npcKnowledge,
      public_knowledge: [],
    },
  };
}

export function createInitialNPCRuntime(npc: StoryBible["npcs"][number]): NPCRuntimeState {
  return {
    npc_id: npc.id,
    core_goal: npc.goal,
    current_goal: inferStageGoal(npc.goal, npc.secret_goal, 1),
    current_plan: inferInterventionStrategy(npc.behavior_style),
    action_cooldown: 0,
    action_frequency: 2,
    last_action_turn: -1,
    current_intention: "",
    known_facts: npc.initial_knowledge.map((content, index) => ({
      id: `initial_fact_${npc.id}_${index}`,
      source: "initial_knowledge",
      confidence: 90,
      content,
    })),
    suspected_facts: [],
    relationships: [],
    suspicion_towards_players: {},
    known_player_actions: [],
    intervention_strategy: inferInterventionStrategy(npc.behavior_style),
    threat_targets: [],
    protected_secrets: npc.secret_goal ? [npc.secret_goal] : [],
    active_modifiers: [],
    memory_log: npc.memory.map((content, index) => ({
      id: `initial_memory_${npc.id}_${index}`,
      timestamp: 0,
      source: "initial_memory",
      importance: 60,
      content,
    })),
    consecutive_target_id: undefined,
    consecutive_target_count: 0,
  };
}

function inferStageGoal(goal: string, secretGoal: string, chapter: number): string {
  if (chapter <= 1) return `建立局势优势，同时隐藏真实目标：${secretGoal || goal}`;
  if (chapter === 2) return `保护关键秘密，阻止敌对调查推进：${secretGoal || goal}`;
  return `推进核心目标并控制最终局势：${goal}`;
}

function inferInterventionStrategy(style: { aggression: number; caution: number; cooperation: number; deception: number }): string {
  if (style.deception >= 70) return "mislead_and_protect_secret";
  if (style.aggression >= 60) return "threaten_and_accelerate_plan";
  if (style.cooperation >= 60) return "assist_or_probe_players";
  if (style.caution >= 60) return "observe_and_obstruct_when_threatened";
  return "opportunistic_intervention";
}

function createLocations(bible: StoryBible): LocationState[] {
  const text = [
    bible.title,
    bible.world_setting.era,
    bible.world_setting.location,
    bible.world_setting.atmosphere,
    ...bible.roles.map((role) => `${role.name} ${role.public_identity}`),
  ].join(" ");
  const profile = inferProfile(text);
  const base = locationTemplates(profile);
  const roleLocations = bible.roles.map((role) => role.starting_location);
  const ids = [...new Set([...roleLocations, ...base.map((location) => location.id)])];

  return ids.map((id, index) => {
    const template = base.find((location) => location.id === id);
    const fallbackName = formatLocationName(id);
    const connected = ids.filter((otherId) => otherId !== id).slice(0, 3);
    return {
      id,
      name: template?.name || fallbackName,
      description:
        template?.description ||
        `${fallbackName}是${bible.world_setting.location || "当前舞台"}中的重要地点，可能藏着与事件相关的线索。`,
      present_characters: [],
      connected_locations: template?.connected_locations.filter((otherId) => ids.includes(otherId)) || connected,
      flags: template?.flags || {},
    };
  });
}

function inferProfile(text: string): "campus" | "romance" | "political" | "sci_fi" | "wuxia" | "demo_fantasy" | "generic" {
  if (/校园|高中|大学|班级|学生会|社团|毕业|校草|校花|青春/.test(text)) return "campus";
  if (/言情|恋爱|爱情|暗恋|复合|告白/.test(text)) return "romance";
  if (/科幻|星际|空间站|飞船|赛博|殖民/.test(text)) return "sci_fi";
  if (/武侠|江湖|门派|朝廷/.test(text)) return "wuxia";
  if (/圣杯|艾尔德兰|圣殿/.test(text)) return "demo_fantasy";
  if (/王国|王室|贵族|宫廷|权谋/.test(text)) return "political";
  return "generic";
}

function locationTemplates(profile: ReturnType<typeof inferProfile>): LocationState[] {
  if (profile === "campus") {
    return [
      loc("classroom", "教室", "班级日常与流言最容易发酵的地方。", ["student_council_room", "library", "corridor"]),
      loc("student_council_room", "学生会办公室", "存放活动资料、竞选记录和内部通知的房间。", ["classroom", "library", "club_room"], { restricted: true }),
      loc("library", "图书馆", "安静的公共空间，适合查记录、谈条件或躲开围观。", ["classroom", "student_council_room", "club_room"]),
      loc("club_room", "社团活动室", "社团排练、道具和私人聊天经常发生在这里。", ["library", "sports_field", "cafeteria"]),
      loc("sports_field", "操场", "视野开阔，适合公开对质，也容易被更多人看见。", ["club_room", "cafeteria"]),
      loc("cafeteria", "食堂", "消息传播最快的地方之一，非正式谈话常在这里发生。", ["sports_field", "classroom"]),
      loc("corridor", "走廊", "课间人流密集，偶遇和偷听都可能发生。", ["classroom", "student_council_room"]),
    ];
  }

  if (profile === "romance") {
    return [
      loc("meeting_place", "约定地点", "关系变化的关键场所，许多误会都从这里开始。", ["quiet_corner", "public_square"]),
      loc("quiet_corner", "安静角落", "适合私下谈心，也适合隐藏真实情绪。", ["meeting_place", "shared_memory_place"]),
      loc("shared_memory_place", "共同回忆地点", "承载过去情感的地方，可能触发关键坦白。", ["quiet_corner", "public_square"]),
      loc("phone_chat", "聊天窗口", "线上消息留下了证据，也可能制造新的误解。", ["meeting_place"]),
      loc("public_square", "公开场合", "任何表态都会被更多人看见。", ["meeting_place", "shared_memory_place"]),
    ];
  }

  if (profile === "sci_fi") {
    return [
      loc("command_deck", "指挥甲板", "任务调度和权限控制的核心区域。", ["research_lab", "hangar"]),
      loc("research_lab", "研究实验室", "异常数据、样本和实验记录集中在这里。", ["command_deck", "medbay"]),
      loc("hangar", "机库", "出入、撤离和物资转运的关键区域。", ["command_deck", "market"]),
      loc("medbay", "医疗舱", "伤情记录和生理数据可能揭示隐藏真相。", ["research_lab"]),
      loc("market", "补给区", "非正式交易和底层消息在这里流动。", ["hangar"]),
    ];
  }

  if (profile === "wuxia") {
    return [
      loc("inn", "客栈", "江湖消息汇聚之处。", ["market", "riverbank"]),
      loc("training_ground", "演武场", "公开较量和门派试探常在这里发生。", ["ancestral_hall"]),
      loc("ancestral_hall", "宗祠", "门规、旧案和身份秘密可能藏在此处。", ["training_ground", "riverbank"], { restricted: true }),
      loc("riverbank", "河岸", "适合密谈、追踪和截获信件。", ["inn", "ancestral_hall"]),
      loc("market", "市集", "人多眼杂，情报与交易并存。", ["inn"]),
    ];
  }

  if (profile === "demo_fantasy") {
    return [
      loc("throne_room", "王座大厅", "辉煌的王座大厅，国王在此接见臣民。", ["temple", "royal_library", "city_streets"]),
      loc("temple", "圣殿", "庄严的圣殿，圣杯曾在此供奉。", ["throne_room", "cathedral_basement", "underground_altar"]),
      loc("cathedral_basement", "教堂地下室", "阴暗潮湿的地下室，藏着不为人知的秘密。", ["temple", "underground_altar"], { restricted: true }),
      loc("underground_altar", "地下祭坛", "隐藏在教堂之下的古老祭坛。", ["temple", "cathedral_basement"], { hidden: true }),
      loc("royal_library", "皇家图书馆", "藏有大量古籍和秘密档案的图书馆。", ["throne_room"]),
      loc("city_streets", "王城街道", "繁华的王城街道，各色人等穿梭其中。", ["throne_room", "temple", "tavern"]),
      loc("tavern", "乌鸦酒馆", "雇佣兵和情报贩子聚集的酒馆。", ["city_streets"]),
    ];
  }

  if (profile === "political") {
    return [
      loc("council_hall", "议事厅", "公开讨论和权力交锋的中心。", ["archive", "garden", "gate"]),
      loc("archive", "档案室", "旧记录、证据和被封存的文件集中在这里。", ["council_hall"], { restricted: true }),
      loc("garden", "庭院", "看似轻松的社交场，常发生私下试探。", ["council_hall", "gate"]),
      loc("gate", "正门", "消息、人员和外部压力从这里进入。", ["garden", "market"]),
      loc("market", "市集", "民意与流言传播最快的地方。", ["gate"]),
    ];
  }

  return [
    loc("central_place", "核心现场", "事件发生或影响最集中的地点。", ["meeting_place", "archive"]),
    loc("meeting_place", "会面地点", "角色可以公开对话或私下协商的地方。", ["central_place", "hidden_corner"]),
    loc("archive", "资料点", "记录、证据和旧线索集中在这里。", ["central_place"], { restricted: true }),
    loc("hidden_corner", "隐秘角落", "适合观察、偷听或交换秘密。", ["meeting_place", "public_square"]),
    loc("public_square", "公开场合", "任何行动都可能影响更多人的态度。", ["hidden_corner"]),
  ];
}

function loc(
  id: string,
  name: string,
  description: string,
  connected_locations: string[],
  flags: Record<string, boolean> = {}
): LocationState {
  return { id, name, description, present_characters: [], connected_locations, flags };
}

function formatLocationName(id: string): string {
  return id
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function applyUpdates(state: WorldState, updates: StateUpdate[]): WorldState {
  const next = structuredClone(state);
  next.active_modifiers ||= [];
  next.npc_runtime_state ||= {};

  for (const update of updates) {
    switch (update.type) {
      case "add_known_fact": {
        if (update.target && update.fact_id) {
          const pk = next.knowledge_state.player_knowledge[update.target];
          if (pk && !pk.known_facts.includes(update.fact_id)) pk.known_facts.push(update.fact_id);
          const nk = next.knowledge_state.npc_knowledge[update.target];
          if (nk && !nk.known_facts.includes(update.fact_id)) nk.known_facts.push(update.fact_id);
        }
        break;
      }
      case "remove_known_fact": {
        if (update.target && update.fact_id) {
          const pk = next.knowledge_state.player_knowledge[update.target];
          if (pk) pk.known_facts = pk.known_facts.filter((f) => f !== update.fact_id);
        }
        break;
      }
      case "metric_change": {
        if (update.metric && update.delta !== undefined) {
          const metric = next.metrics.find((item) => item.metric_id === update.metric);
          if (metric && typeof metric.value === "number") {
            metric.value = Math.max(0, Math.min(100, metric.value + update.delta));
          }
        }
        break;
      }
      case "set_flag": {
        if (update.flag) next.flags[update.flag] = true;
        break;
      }
      case "clear_flag": {
        if (update.flag) next.flags[update.flag] = false;
        break;
      }
      case "relationship_change": {
        if (update.relationship) {
          const { source, target, type, delta } = update.relationship;
          const existing = next.relationships.find(
            (relationship) => relationship.source_id === source && relationship.target_id === target && relationship.type === type
          );
          if (existing) {
            existing.value = Math.max(-100, Math.min(100, existing.value + delta));
          } else {
            next.relationships.push({
              id: `rel_${source}_${target}_${type}`,
              source_id: source,
              target_id: target,
              type: type as RelationshipState["type"],
              value: delta,
            });
          }
        }
        break;
      }
      case "add_evidence": {
        if (update.target && update.fact_id) {
          const pk = next.knowledge_state.player_knowledge[update.target];
          if (pk && !pk.evidence.includes(update.fact_id)) pk.evidence.push(update.fact_id);
        }
        break;
      }
      case "trigger_event": {
        if (update.target) {
          const event = next.events.find((item) => item.event_id === update.target);
          if (event) {
            event.triggered = true;
            event.trigger_turn = next.turn;
          }
        }
        break;
      }
      case "change_location": {
        if (update.target && update.value && typeof update.value === "string") {
          for (const location of next.locations) {
            location.present_characters = location.present_characters.filter((character) => character !== update.target);
          }
          const newLocation = next.locations.find((location) => location.id === update.value);
          if (newLocation && !newLocation.present_characters.includes(update.target)) {
            newLocation.present_characters.push(update.target);
          }
        }
        break;
      }
      case "reveal_information": {
        if (update.value) next.knowledge_state.public_knowledge.push(String(update.value));
        break;
      }
      case "add_active_modifier": {
        if (update.modifier) {
          next.active_modifiers = next.active_modifiers.filter((modifier) => modifier.id !== update.modifier?.id);
          next.active_modifiers.push(update.modifier);
          const runtime = next.npc_runtime_state[update.modifier.source];
          if (runtime) {
            runtime.active_modifiers = runtime.active_modifiers.filter((modifier) => modifier.id !== update.modifier?.id);
            runtime.active_modifiers.push(update.modifier);
          }
        }
        break;
      }
      case "update_npc_runtime": {
        if (update.target && update.npc_runtime) {
          const current = next.npc_runtime_state[update.target] ?? {
            npc_id: update.target,
            core_goal: "",
            current_goal: "",
            current_plan: "",
            action_cooldown: 0,
            action_frequency: 2,
            last_action_turn: -1,
            current_intention: "",
            known_facts: [],
            suspected_facts: [],
            relationships: [],
            suspicion_towards_players: {},
            known_player_actions: [],
            intervention_strategy: "",
            threat_targets: [],
            protected_secrets: [],
            active_modifiers: [],
            memory_log: [],
            consecutive_target_count: 0,
          };
          next.npc_runtime_state[update.target] = {
            ...current,
            ...update.npc_runtime,
            suspicion_towards_players: {
              ...current.suspicion_towards_players,
              ...update.npc_runtime.suspicion_towards_players,
            },
          };
        }
        break;
      }
      case "append_npc_memory": {
        if (update.target && update.value) {
          const runtime = next.npc_runtime_state[update.target];
          const memory = update.memory || createMemory(update.value, next.turn);
          if (runtime) runtime.memory_log.push(memory);
          const nk = next.knowledge_state.npc_knowledge[update.target];
          if (nk && !nk.known_facts.includes(String(update.value))) nk.known_facts.push(String(update.value));
        }
        break;
      }
      case "add_npc_fact": {
        if (update.target && update.fact) {
          const runtime = next.npc_runtime_state[update.target];
          if (runtime && !runtime.known_facts.some((fact) => fact.id === update.fact?.id)) {
            runtime.known_facts.push(update.fact);
          }
        }
        break;
      }
      case "add_npc_suspected_fact": {
        if (update.target && update.fact) {
          const runtime = next.npc_runtime_state[update.target];
          if (runtime && !runtime.suspected_facts.some((fact) => fact.id === update.fact?.id)) {
            runtime.suspected_facts.push(update.fact);
          }
        }
        break;
      }
      case "record_known_player_action": {
        if (update.target && update.known_player_action) {
          const runtime = next.npc_runtime_state[update.target];
          if (runtime) {
            runtime.known_player_actions = [
              ...runtime.known_player_actions,
              update.known_player_action,
            ].slice(-12);
          }
          const nk = next.knowledge_state.npc_knowledge[update.target];
          if (nk) {
            nk.known_player_actions = [
              ...(nk.known_player_actions || []),
              update.known_player_action,
            ].slice(-12);
            if (!nk.known_players.includes(update.known_player_action.actor_id)) {
              nk.known_players.push(update.known_player_action.actor_id);
            }
          }
        }
        break;
      }
    }
  }

  return next;
}

function createMemory(value: unknown, turn: number): MemoryEntry {
  return {
    id: `memory_${turn}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: turn,
    source: "rule_engine",
    importance: 50,
    content: String(value),
  };
}

export function decrementActiveModifiers(state: WorldState): WorldState {
  const activeModifiers = (state.active_modifiers || [])
    .map((modifier) => ({ ...modifier, remaining_turns: modifier.remaining_turns - 1 }))
    .filter((modifier) => modifier.remaining_turns > 0);
  const activeBySource = new Map<string, typeof activeModifiers>();
  for (const modifier of activeModifiers) {
    activeBySource.set(modifier.source, [...(activeBySource.get(modifier.source) || []), modifier]);
  }
  return {
    ...state,
    active_modifiers: activeModifiers,
    npc_runtime_state: Object.fromEntries(
      Object.entries(state.npc_runtime_state || {}).map(([npcId, runtime]) => [
        npcId,
        {
          ...runtime,
          active_modifiers: activeBySource.get(npcId) || [],
        },
      ])
    ),
  };
}

export function getMetricValue(state: WorldState, metricId: string): number | boolean | string | undefined {
  return state.metrics.find((m) => m.metric_id === metricId)?.value;
}

export function isFlagSet(state: WorldState, flag: string): boolean {
  return state.flags[flag] === true;
}

export function getPlayerKnowledge(state: WorldState, playerId: string): PlayerKnowledge | undefined {
  return state.knowledge_state.player_knowledge[playerId];
}

export function getNPCKnowledge(state: WorldState, npcId: string): NPCKnowledge | undefined {
  return state.knowledge_state.npc_knowledge[npcId];
}
