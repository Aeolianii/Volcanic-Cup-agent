import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { checkEndings, evaluateVictorySettlement } from "@/engine/endingJudge";
import { getAIProvider } from "@/lib/aiProvider";

export async function POST(
  _request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const room = roomManager.getRoom(roomId);
    const worldState = roomManager.getWorldState(roomId);
    const bible = roomManager.getStoryBible(room?.story_bible_id || "");

    if (!room || !worldState || !bible) {
      return NextResponse.json(
        { success: false, error: "房间或故事不存在" },
        { status: 404 }
      );
    }

    const endingResult = checkEndings(worldState, bible);

    let endingNarrative = "";
    if (endingResult.reached && endingResult.ending) {
      endingNarrative = await getAIProvider().generateEndingNarrative({
        ending_title: endingResult.ending.title,
        ending_description: endingResult.ending.description,
        world_state_summary: {
          flags: worldState.flags,
          metrics: worldState.metrics.map((m) => ({
            id: m.metric_id,
            label: m.metric_id,
            value: m.value,
          })),
          active_events: worldState.events.filter((e) => e.triggered).map((e) => e.event_id),
          player_locations: {},
        },
        key_events: worldState.events.filter((e) => e.triggered).map((e) => e.event_id),
        player_contributions: {},
      });

      roomManager.updateRoomStatus(roomId, "finished");
    }

    // ---- NEW: Build chronicle (world events in chronological order) ----
    const chronicle = buildChronicle(worldState, bible);

    // ---- NEW: Collect all player actions ----
    const allPlayerActions = collectAllPlayerActions(worldState, room.players, bible);

    // ---- NEW: Build truth reveal ----
    const truthReveal = buildTruthReveal(worldState, bible, endingResult);

    // ---- NEW: GM evaluations & MVP ----
    const { gmEvaluations, mvpPlayerId } = await buildGMEvaluationsAndMVP(
      room.players,
      worldState,
      bible,
      endingResult,
      allPlayerActions
    );

    return NextResponse.json({
      success: true,
      ending: endingResult.reached ? endingResult.ending : null,
      all_endings_status: endingResult.all_endings_status,
      victory_settlement: evaluateVictorySettlement(
        room.players,
        worldState,
        bible,
        endingResult.reached ? endingResult.ending : null
      ),
      ending_narrative: endingNarrative,
      // New fields
      chronicle,
      all_player_actions: allPlayerActions,
      truth_reveal: truthReveal,
      gm_evaluations: gmEvaluations,
      mvp_player_id: mvpPlayerId,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// Chronicle — world events in chronological order
// ============================================================

interface ChronicleEntry {
  turn: number;
  chapter: number;
  round: number;
  title: string;
  description: string;
  type: "event_triggered" | "round_end" | "chapter_transition" | "flag_set";
}

function buildChronicle(
  worldState: { events: Array<{ event_id: string; triggered: boolean; trigger_turn?: number }>; turn_state: { round_history: Array<{ round: number; ended_at_turn: number; reason: string }> }; flags: Record<string, boolean> },
  bible: { events: Array<{ id: string; title: string; description: string }>; chapters: Array<{ order: number; title: string }> }
): ChronicleEntry[] {
  const entries: ChronicleEntry[] = [];

  // Sort triggered events by trigger_turn
  const triggeredEvents = worldState.events
    .filter((e) => e.triggered)
    .map((e) => {
      const eventDef = bible.events.find((be) => be.id === e.event_id);
      return {
        turn: e.trigger_turn || 0,
        title: eventDef?.title || e.event_id,
        description: eventDef?.description || "",
      };
    })
    .sort((a, b) => a.turn - b.turn);

  for (const evt of triggeredEvents) {
    const chapter = bible.chapters
      .filter((c) => c.order <= (worldState.turn_state.round_history.length || 1))
      .sort((a, b) => b.order - a.order)[0];
    entries.push({
      turn: evt.turn,
      chapter: chapter?.order || 1,
      round: Math.max(1, Math.ceil(evt.turn / 3)),
      title: evt.title,
      description: evt.description,
      type: "event_triggered",
    });
  }

  // Add round transitions
  for (const roundEntry of worldState.turn_state.round_history || []) {
    const chapter = bible.chapters
      .filter((c) => c.order <= roundEntry.round)
      .sort((a, b) => b.order - a.order)[0];
    entries.push({
      turn: roundEntry.ended_at_turn,
      chapter: chapter?.order || 1,
      round: roundEntry.round,
      title: `第 ${roundEntry.round} 回合结束`,
      description: roundEntry.reason,
      type: "round_end",
    });
  }

  // Sort all entries by turn
  entries.sort((a, b) => a.turn - b.turn || a.round - b.round);

  return entries;
}

// ============================================================
// All Player Actions — collect from NPC knowledge & turn state
// ============================================================

interface PlayerActionRecord {
  player_id: string;
  player_name: string;
  role_name: string;
  is_ai: boolean;
  actions: {
    turn: number;
    action_type: string;
    target: string;
    method: string;
    intent: string;
    summary: string;
  }[];
  total_actions: number;
}

function collectAllPlayerActions(
  worldState: {
    knowledge_state: {
      npc_knowledge: Record<string, {
        known_player_actions: Array<{
          actor_id: string;
          action_type: string;
          target: string;
          method: string;
          intent: string;
          turn: number;
          public_summary: string;
        }>;
      }>;
    };
    turn_state: { player_action_counts: Record<string, number> };
  },
  players: Array<{
    player_id: string;
    name: string;
    role: { name: string } | null;
    is_ai?: boolean;
  }>,
  bible: { npcs: Array<{ id: string; name: string }>; roles: Array<{ id: string; name: string }> }
): PlayerActionRecord[] {
  // Collect all known player actions from all NPCs' knowledge
  const actionMap = new Map<string, Map<string, PlayerActionRecord["actions"][0]>>();

  for (const npcKnowledge of Object.values(worldState.knowledge_state.npc_knowledge || {})) {
    for (const action of npcKnowledge.known_player_actions || []) {
      if (!actionMap.has(action.actor_id)) {
        actionMap.set(action.actor_id, new Map());
      }
      const playerActions = actionMap.get(action.actor_id)!;
      const key = `${action.turn}_${action.action_type}_${action.target}`;
      if (!playerActions.has(key)) {
        playerActions.set(key, {
          turn: action.turn,
          action_type: action.action_type,
          target: formatTarget(action.target, bible),
          method: action.method,
          intent: action.intent,
          summary: action.public_summary,
        });
      }
    }
  }

  // Build player action records
  return players.map((player) => {
    const playerActionMap = actionMap.get(player.player_id) || new Map();
    const actions = Array.from(playerActionMap.values())
      .sort((a, b) => a.turn - b.turn);

    return {
      player_id: player.player_id,
      player_name: player.name,
      role_name: player.role?.name || player.player_id,
      is_ai: player.is_ai || false,
      actions,
      total_actions: worldState.turn_state.player_action_counts[player.player_id] || actions.length || 0,
    };
  });
}

function formatTarget(target: string, bible: { npcs: Array<{ id: string; name: string }>; roles: Array<{ id: string; name: string }> }): string {
  const npc = bible.npcs.find((n) => n.id === target);
  if (npc) return npc.name;
  const role = bible.roles.find((r) => r.id === target);
  if (role) return role.name;
  const locationLabels: Record<string, string> = {
    temple: "圣殿",
    cathedral_basement: "教堂地下室",
    underground_altar: "地下祭坛",
    throne_room: "王座大厅",
    royal_library: "皇家图书馆",
    city_streets: "王城街道",
    tavern: "酒馆",
    current_location: "当前位置",
  };
  return locationLabels[target] || target.replace(/_/g, " ");
}

// ============================================================
// Truth Reveal — the complete truth of the story
// ============================================================

interface TruthReveal {
  story_title: string;
  ending_title: string;
  core_truth: string;
  public_knowledge: string[];
  key_flags: { flag: string; value: boolean }[];
  final_metrics: { metric: string; label: string; value: unknown }[];
}

function buildTruthReveal(
  worldState: { flags: Record<string, boolean>; metrics: Array<{ metric_id: string; value: unknown }>; knowledge_state: { public_knowledge: string[] } },
  bible: { title: string; metrics: Array<{ id: string; label: string }> },
  endingResult: { reached: boolean; ending: { title: string; description: string } | null }
): TruthReveal {
  // Collect significant flags (filter out internal event flags)
  const significantFlags = Object.entries(worldState.flags)
    .filter(([key]) =>
      !key.startsWith("chapter_") &&
      !key.startsWith("round_") &&
      !key.startsWith("event_")
    )
    .map(([flag, value]) => ({ flag, value }));

  return {
    story_title: bible.title,
    ending_title: endingResult.ending?.title || "未知结局",
    core_truth: endingResult.ending?.description || "真相已被命运掩埋。",
    public_knowledge: worldState.knowledge_state.public_knowledge || [],
    key_flags: significantFlags,
    final_metrics: worldState.metrics.map((m) => ({
      metric: m.metric_id,
      label: bible.metrics.find((bm) => bm.id === m.metric_id)?.label || m.metric_id,
      value: m.value,
    })),
  };
}

// ============================================================
// GM Evaluations & MVP
// ============================================================

interface GMEvaluation {
  player_id: string;
  player_name: string;
  role_name: string;
  is_ai: boolean;
  commentary: string;
  rating: number; // 1-10
}

async function buildGMEvaluationsAndMVP(
  players: Array<{
    player_id: string;
    name: string;
    role: { name: string } | null;
    is_ai?: boolean;
  }>,
  worldState: {
    turn_state: { player_action_counts: Record<string, number> };
    character_states: Record<string, { status: string }>;
    flags: Record<string, boolean>;
  },
  bible: { title: string; roles: Array<{ id: string; name: string }> },
  endingResult: { ending: { title: string; description: string } | null },
  allPlayerActions: PlayerActionRecord[]
): Promise<{ gmEvaluations: GMEvaluation[]; mvpPlayerId: string }> {
  // Try LLM-based evaluation first; fall back to rule-based
  const aiProvider = getAIProvider();

  try {
    const context = {
      story_title: bible.title,
      ending_title: endingResult.ending?.title || "故事结束",
      ending_description: endingResult.ending?.description || "",
      players: players.map((p) => ({
        player_id: p.player_id,
        player_name: p.name,
        role_name: p.role?.name || p.player_id,
        is_ai: p.is_ai || false,
        life_status: worldState.character_states[p.player_id]?.status || "alive",
        total_actions: worldState.turn_state.player_action_counts[p.player_id] || 0,
        actions: allPlayerActions
          .find((pa) => pa.player_id === p.player_id)?.actions
          .slice(-10) // Last 10 actions only to keep context manageable
          .map((a) => `${a.summary}`) || [],
      })),
    };

    const result = await callLLMForEvaluation(context, players);
    if (result) return result;
  } catch {
    // Fall back to rule-based
  }

  return buildRuleBasedEvaluations(players, worldState, bible, allPlayerActions);
}

async function callLLMForEvaluation(
  context: unknown,
  players: Array<{ player_id: string; name: string; role: { name: string } | null; is_ai?: boolean }>
): Promise<{ gmEvaluations: GMEvaluation[]; mvpPlayerId: string } | null> {
  const { apiKey, baseUrl, model } = getLLMConfig();
  if (!apiKey) return null;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: [
              "你是 AI Story Foundry 的 GM（游戏主持人），需要为每个玩家撰写评语并选出 MVP。",
              "对于 AI NPC 玩家（is_ai: true），称呼他们为\"机器人1号（扮演角色名）\"、\"机器人2号（扮演角色名）\"等，按他们在列表中的顺序编号。",
              "对真人玩家直接称呼其角色名。",
              "评语应包含：角色扮演表现、策略选择、关键贡献、对故事走向的影响。",
              "MVP 应该是在推进故事、角色扮演、策略决策方面表现最出色的玩家。AI NPC 也可以当选 MVP。",
              "每个评语 50-80 字，中文。",
              "返回 JSON 格式：{\"evaluations\":[{\"player_id\":\"...\", \"commentary\":\"...\", \"rating\":8}], \"mvp_player_id\":\"...\"}。",
              "rating 为 1-10 的整数。",
            ].join("\n"),
          },
          { role: "user", content: JSON.stringify(context) },
        ],
        max_tokens: 2000,
        stream: false,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    const parsed = parseJSONResponse(content);
    if (!parsed) return null;

    // Enrich LLM evaluations with player data
    const gmEvaluations: GMEvaluation[] = (parsed.evaluations || []).map((evalItem) => {
      const player = players.find((p) => p.player_id === evalItem.player_id);
      return {
        player_id: evalItem.player_id,
        player_name: player?.name || evalItem.player_id,
        role_name: player?.role?.name || evalItem.player_id,
        is_ai: player?.is_ai || false,
        commentary: evalItem.commentary,
        rating: evalItem.rating,
      };
    });

    return {
      gmEvaluations,
      mvpPlayerId: parsed.mvp_player_id || "",
    };
  } catch {
    return null;
  }
}

function getLLMConfig() {
  return {
    apiKey:
      process.env.OPENAI_COMPAT_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
    baseUrl:
      process.env.OPENAI_COMPAT_BASE_URL ||
      process.env.DEEPSEEK_BASE_URL ||
      "https://api.deepseek.com",
    model:
      process.env.OPENAI_COMPAT_MODEL ||
      process.env.DEEPSEEK_MODEL ||
      "deepseek-v4-pro",
  };
}

function parseJSONResponse(content: string): { evaluations: Array<{ player_id: string; commentary: string; rating: number }>; mvp_player_id: string } | null {
  try {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const raw = (fenced || content).trim();
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    const jsonText = firstBrace >= 0 && lastBrace >= firstBrace
      ? raw.slice(firstBrace, lastBrace + 1)
      : raw;
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function buildRuleBasedEvaluations(
  players: Array<{
    player_id: string;
    name: string;
    role: { name: string } | null;
    is_ai?: boolean;
  }>,
  worldState: {
    turn_state: { player_action_counts: Record<string, number> };
    character_states: Record<string, { status: string }>;
    flags: Record<string, boolean>;
  },
  bible: { roles: Array<{ id: string; name: string }> },
  allPlayerActions: PlayerActionRecord[]
): { gmEvaluations: GMEvaluation[]; mvpPlayerId: string } {
  const evaluations: GMEvaluation[] = [];
  let bestScore = -1;
  let mvpId = "";

  let aiIndex = 0;
  for (const player of players) {
    const roleName = player.role?.name || player.name;
    const actionCount = worldState.turn_state.player_action_counts[player.player_id] || 0;
    const lifeStatus = worldState.character_states[player.player_id]?.status || "alive";
    const isAlive = lifeStatus === "alive";

    // Score based on actions and survival
    const actionScore = Math.min(5, actionCount);
    const survivalScore = isAlive ? 3 : 1;
    const totalActions = allPlayerActions.find((pa) => pa.player_id === player.player_id)?.actions.length || 0;
    const varietyScore = Math.min(2, Math.ceil(totalActions / 3));

    const rating = Math.min(10, actionScore + survivalScore + varietyScore);

    const displayName = player.is_ai
      ? `机器人${++aiIndex}号（扮演${roleName}）`
      : roleName;

    let commentary = "";
    if (player.is_ai) {
      commentary = `${displayName}在本次故事中执行了${actionCount}次行动，${isAlive ? "成功存活至终局" : "不幸陨落"}。作为 AI 代演玩家，其行为遵循角色设定，${totalActions >= 3 ? "积极参与了故事的推进" : "为故事增添了必要的戏剧性"}。`;
    } else {
      commentary = `玩家"${player.name}"扮演的${roleName}在故事中执行了${actionCount}次行动，${isAlive ? "存活至终局" : "命运多舛"}。${totalActions >= 4 ? "是故事推进的关键推动者之一。" : "为故事增添了独特的角色视角。"}`;
    }

    evaluations.push({
      player_id: player.player_id,
      player_name: player.name,
      role_name: roleName,
      is_ai: player.is_ai || false,
      commentary,
      rating,
    });

    if (rating > bestScore) {
      bestScore = rating;
      mvpId = player.player_id;
    }
  }

  // Ensure we have an MVP
  if (!mvpId && evaluations.length > 0) {
    mvpId = evaluations[0].player_id;
  }

  return { gmEvaluations: evaluations, mvpPlayerId: mvpId };
}
