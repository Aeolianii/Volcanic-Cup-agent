import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { generateGMNarrative } from "@/engine/aiGM";
import { getAIProvider } from "@/lib/aiProvider";
import type { Player, PlayerView, StoryBible, SuggestedActionForGM, WorldState } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string; playerId: string } }
) {
  try {
    const { roomId, playerId } = params;
    const room = roomManager.getRoom(roomId);
    const worldState = roomManager.getWorldState(roomId);
    const player = roomManager.getPlayer(roomId, playerId);

    if (!room || !worldState || !player || !player.role) {
      return NextResponse.json(
        { success: false, error: "找不到房间、玩家或角色" },
        { status: 404 }
      );
    }

    const bible = roomManager.getStoryBible(room.story_bible_id);
    if (!bible) {
      return NextResponse.json(
        { success: false, error: "找不到故事数据" },
        { status: 404 }
      );
    }

    const pk = worldState.knowledge_state.player_knowledge[playerId] || {
      player_id: playerId,
      known_facts: [],
      known_npcs: [],
      known_locations: [],
      known_events: [],
      evidence: [],
    };

    const gmOutput = await generateGMNarrative(
      bible,
      worldState,
      getAIProvider(),
      worldState.turn === 0 ? "opening" : "turn_narration"
    );

    const visibleMetrics = bible.metrics
      .filter((m) => m.visibility === "public")
      .map((m) => {
        const state = worldState.metrics.find((ms) => ms.metric_id === m.id);
        return {
          metric_id: m.id,
          label: m.label,
          value: state?.value ?? m.initial,
          type: m.type,
        };
      });

    const suggestedActions = sanitizeSuggestedActions(
      gmOutput.suggested_actions,
      player,
      worldState,
      bible
    );

    const playerView: PlayerView = {
      role_sheet: player.role,
      known_facts: normalizeKnownFacts(pk.known_facts, player, bible.world_setting.atmosphere, bible, worldState),
      known_npcs: normalizeKnownNpcs(pk.known_npcs, bible),
      known_locations: pk.known_locations,
      evidence: pk.evidence.map((item) => normalizeKnowledgeItem(item, bible, worldState)),
      visible_metrics: visibleMetrics,
      active_events: worldState.events
        .filter((e) => e.triggered)
        .map((e) => {
          const be = bible.events.find((be) => be.id === e.event_id);
          return {
            event_id: e.event_id,
            title: be?.title || e.event_id,
            description: be?.description || "",
            turn_triggered: e.trigger_turn || 0,
          };
        }),
      suggested_actions: suggestedActions.map((sa, i) => ({
        id: `sa_${i}`,
        label: sa.label,
        action_type: sa.action_type,
        target: sa.target,
        method: sa.method,
        intent: sa.intent,
        risk_level: sa.risk_level,
        context: sa.context,
      })),
    };

    return NextResponse.json({ success: true, player_view: playerView, gm_narrative: gmOutput });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

function normalizeKnownFacts(
  facts: string[],
  player: Player,
  worldSetting: string,
  bible: StoryBible,
  worldState: WorldState
): string[] {
  const role = player.role;
  if (!role) return facts;

  const usefulFacts = facts.filter((fact) => {
    const trimmed = fact.trim();
    return trimmed && !/基本认知|占位|隐藏动机/.test(trimmed);
  });

  const defaults = [
    `你清楚自己的公开身份：${role.public_identity}`,
    `你的秘密目标是：${role.secret_goal}`,
  ];

  if (worldSetting) {
    defaults.push(`当前局势背景：${worldSetting}`);
  }

  return Array.from(new Set([
    ...defaults,
    ...usefulFacts.map((fact) => normalizeKnowledgeItem(fact, bible, worldState)),
  ]));
}

function normalizeKnowledgeItem(item: string, bible: StoryBible, worldState: WorldState): string {
  const raw = String(item || "").trim();
  if (!raw) return raw;

  const actionMatch = raw.match(/^Action completed:\s*([a-z_]+)\s*->\s*(.+)\.?$/i);
  if (actionMatch) {
    return `已完成${actionLabel(actionMatch[1])}：${formatKnowledgeTarget(actionMatch[2], bible, worldState)}。`;
  }

  const clueMatch = raw.match(/^Clue found at\s+(.+)\.?$/i);
  if (clueMatch) {
    return `来自${formatKnowledgeTarget(clueMatch[1], bible, worldState)}的线索。`;
  }

  if (/^[a-z]+(_[a-z0-9]+)+$/i.test(raw)) {
    return formatInternalId(raw, bible, worldState);
  }

  return raw
    .replace(/\bcurrent_location\b/g, "当前位置")
    .replace(/\bconnected_location\b/g, "相关地点")
    .replace(/\bcurrent_event\b/g, "当前事件")
    .replace(/\ball_players\b/g, "所有玩家");
}

function formatInternalId(id: string, bible: StoryBible, worldState: WorldState): string {
  const event = bible.events.find((item) => item.id === id);
  if (event) return event.title;

  const npc = bible.npcs.find((item) => item.id === id);
  if (npc) return npc.name;

  const role = bible.roles.find((item) => item.id === id);
  if (role) return role.name;

  const location = worldState.locations.find((item) => item.id === id);
  if (location) return location.name;

  if (id.startsWith("false_evidence_")) return "一条可疑线索";
  if (id.startsWith("npc_action_")) return "某个角色的暗中行动";
  if (id.startsWith("clue_")) {
    return `来自${formatKnowledgeTarget(id.replace(/^clue_/, ""), bible, worldState)}的线索`;
  }

  return id
    .replace(/^npc_/, "")
    .replace(/^role_/, "")
    .replace(/_/g, " ");
}

function formatKnowledgeTarget(value: string, bible: StoryBible, worldState: WorldState): string {
  const cleaned = value.trim().replace(/\.$/, "");
  return formatInternalId(cleaned, bible, worldState);
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
    attack: "攻击",
    defend: "防守",
    buy: "收买",
    trade: "交易",
    steal: "偷取",
    transport: "转移",
    build: "建设",
  };
  return labels[actionType] || actionType.replace(/_/g, " ");
}

function normalizeKnownNpcs(knownNpcs: string[], bible: { npcs: Array<{ id: string; name: string }> }): string[] {
  const npcLabels = new Map(bible.npcs.map((npc) => [npc.id, npc.name]));
  return knownNpcs.map((npc) => npcLabels.get(npc) || npc);
}

function sanitizeSuggestedActions(
  actions: SuggestedActionForGM[],
  player: Player,
  worldState: WorldState,
  bible: StoryBible
): SuggestedActionForGM[] {
  const role = player.role;
  if (!role) return actions;
  const storyText = JSON.stringify({
    title: bible.title,
    world_setting: bible.world_setting,
    roles: bible.roles.map((item) => [item.name, item.public_identity]),
    npcs: bible.npcs.map((item) => [item.name, item.public_identity]),
    factions: bible.factions.map((item) => item.name),
  });
  const forbiddenTerms = getForbiddenTerms(storyText);

  const selfNames = new Set([
    player.player_id,
    role.id,
    role.name,
    role.name.toLowerCase(),
    role.name.includes("公主") ? "princess" : "",
    role.name.includes("王子") ? "prince" : "",
    role.name.includes("圣女") ? "saintess" : "",
    role.name.includes("刺客") ? "assassin" : "",
    role.name.includes("骑士") ? "knight" : "",
  ].filter(Boolean));

  const socialActions = new Set([
    "talk",
    "persuade",
    "threaten",
    "deceive",
    "ally",
    "betray",
    "confess",
  ]);

  const filtered = actions.filter((action) => {
    const target = String(action.target || "").toLowerCase();
    const label = `${action.label || ""} ${action.context || ""}`.toLowerCase();
    const visibleText = `${action.label || ""} ${action.context || ""} ${action.target || ""} ${action.method || ""}`;
    if (forbiddenTerms.some((term) => visibleText.includes(term))) return false;

    const targetsSelf = Array.from(selfNames).some((name) => {
      const normalized = name.toLowerCase();
      return target === normalized || label.includes(normalized);
    });

    return !(targetsSelf && socialActions.has(action.action_type));
  });

  if (filtered.length >= 3 || !allowsTemplateFallback(bible)) return filtered.slice(0, 5);

  return [...filtered, ...buildRoleFallbackActions(player, worldState, bible)]
    .filter((action, index, all) => all.findIndex((a) => a.label === action.label) === index)
    .slice(0, 5);
}

function allowsTemplateFallback(bible: StoryBible): boolean {
  return bible.id === "demo_lost_holy_grail";
}

function buildRoleFallbackActions(player: Player, worldState: WorldState, bible: StoryBible): SuggestedActionForGM[] {
  const roleName = player.role?.name || "角色";
  const role = player.role;
  const storyText = JSON.stringify({
    title: bible.title,
    world_setting: bible.world_setting,
    roles: bible.roles.map((item) => [item.name, item.public_identity]),
    npcs: bible.npcs.map((item) => [item.name, item.public_identity]),
  });
  const profile = inferStoryProfile(storyText);
  const currentLocation =
    worldState.locations.find((location) => location.present_characters.includes(player.player_id))?.id ||
    player.role?.starting_location ||
    "current_location";
  const locationLabel = getLocationLabel(currentLocation, worldState);
  const firstNpc = bible.npcs[0];
  const firstEvent = bible.events[0];

  const actions: SuggestedActionForGM[] = [
    {
      label: profile === "campus" ? `调查${locationLabel}` : "调查当前地点",
      action_type: "investigate",
      target: currentLocation,
      method: "examine",
      intent: "find_clues",
      risk_level: "low",
      context: profile === "campus"
        ? "从聊天记录、时间线和现场细节里寻找与校园风波相关的线索"
        : "寻找与你当前处境相关的线索",
    },
    {
      label: "梳理秘密目标",
      action_type: "investigate",
      target: "self_goal",
      method: "reflect",
      intent: "plan_next_move",
      risk_level: "low",
      context: `${roleName}可以结合“${role?.secret_goal || "秘密目标"}”规划下一步`,
    },
  ];

  if (firstNpc) {
    actions.push({
      label: profile === "campus" ? `找${firstNpc.name}谈谈` : `试探${firstNpc.name}`,
      action_type: "talk",
      target: firstNpc.id,
      method: profile === "campus" ? "private_conversation" : "careful_conversation",
      intent: "gather_information",
      risk_level: "medium",
      context: `${firstNpc.public_identity}，可能知道“${firstEvent?.title || "当前事件"}”的另一面`,
    });
  }

  return actions;
}

function inferStoryProfile(text: string): "campus" | "romance" | "political" | "sci_fi" | "wuxia" | "generic" {
  if (/校园|高中|大学|班级|学生会|社团|毕业|校草|校花|青春|同桌|学生/.test(text)) return "campus";
  if (/言情|恋爱|爱情|暗恋|复合|告白|表白|暧昧/.test(text)) return "romance";
  if (/科幻|星际|空间站|飞船|赛博|殖民|机器人/.test(text)) return "sci_fi";
  if (/武侠|江湖|门派|侠客|帮派/.test(text)) return "wuxia";
  if (/王国|王室|贵族|宫廷|权谋|帝国/.test(text)) return "political";
  return "generic";
}

function getForbiddenTerms(storyText: string): string[] {
  const profile = inferStoryProfile(storyText);
  if (profile === "campus" || profile === "romance") {
    return ["国王", "老国王", "王座", "王城", "王室", "贵族", "宫廷", "骑士", "圣女", "圣杯", "大法师", "主教"];
  }
  if (profile === "sci_fi") {
    return ["国王", "王座", "宫廷", "校园流言", "学生会"];
  }
  return [];
}

function getLocationLabel(locationId: string, worldState: WorldState): string {
  return worldState.locations.find((location) => location.id === locationId)?.name || "当前地点";
}
