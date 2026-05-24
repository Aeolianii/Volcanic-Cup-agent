import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { checkEndings, evaluateVictorySettlement } from "@/engine/endingJudge";
import { getAIProvider } from "@/lib/aiProvider";
import type { HistoricalAction, HistoricalWorldEvent, Player, StoryBible, WorldState } from "@/types";

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
          flags: buildPublicFlagSummary(worldState.flags),
          metrics: worldState.metrics.map((m) => {
            const metricDef = bible.metrics.find((metric) => metric.id === m.metric_id);
            const labelMap: Record<string, string> = {
              situation_stability: "局势稳定度",
              truth_progress: "真相进度",
              faction_power: "势力值",
              trust: "信任度",
              suspicion: "怀疑值",
            };
            return {
              id: m.metric_id,
              label: metricDef?.label || labelMap[m.metric_id] || publicLabel(m.metric_id),
              value: m.value,
            };
          }),
          active_events: worldState.events
            .filter((e) => e.triggered)
            .map((e) => bible.events.find((event) => event.id === e.event_id)?.title || publicLabel(e.event_id)),
          player_locations: {},
        },
        key_events: worldState.events
          .filter((e) => e.triggered)
          .map((e) => bible.events.find((event) => event.id === e.event_id)?.title || publicLabel(e.event_id)),
        player_contributions: {},
      });

      roomManager.updateRoomStatus(roomId, "finished");
    }

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
      ending_recap: buildEndingRecap(room.players, worldState, bible),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

function buildEndingRecap(players: Player[], worldState: WorldState, bible: StoryBible) {
  const history = {
    actions: worldState.history?.actions || [],
    world_events: worldState.history?.world_events || [],
  };
  const participants = buildRecapParticipants(players, bible);
  const chronicle = buildChronicle(history.world_events, worldState, bible);
  const playerActions = history.actions
    .slice()
    .sort((a, b) => a.turn - b.turn)
    .map((action) => ({
      ...action,
      actor_display_name: displayActorName(action, participants),
      action_label: actionLabel(action.action_type),
      target_display_name: action.target_name || publicLabel(action.target),
    }));
  const reviews = participants.map((participant) => buildGMReview(participant, history.actions, worldState));
  const mvp = reviews.slice().sort((a, b) => b.score - a.score)[0] || null;

  return {
    truth: buildTruthDisclosure(bible, worldState),
    chronicle,
    player_actions: playerActions,
    gm_reviews: reviews,
    mvp,
  };
}

function buildRecapParticipants(players: Player[], bible: StoryBible) {
  const humanRoleIds = new Set(players.map((player) => player.role_id).filter(Boolean));
  const humanParticipants = players.map((player) => ({
    id: player.player_id,
    kind: "human_player" as const,
    display_name: player.role?.name ? `${player.name}（${player.role.name}）` : player.name,
    role_id: player.role_id,
    role_name: player.role?.name || bible.roles.find((role) => role.id === player.role_id)?.name,
  }));
  const robotParticipants = bible.roles
    .filter((role) => !humanRoleIds.has(role.id))
    .map((role, index) => ({
      id: role.id,
      kind: "ai_player_role" as const,
      display_name: `机器人${index + 1}（${role.name}）`,
      role_id: role.id,
      role_name: role.name,
    }));

  return [...humanParticipants, ...robotParticipants];
}

function buildTruthDisclosure(bible: StoryBible, worldState: WorldState) {
  const truth = [
    {
      title: "最终结局",
      content: bible.endings.map((ending) => `${ending.title}：${ending.description}`).join("\n"),
      source: "ending",
    },
    ...bible.knowledge
      .filter((item) => item.category === "hidden" || item.category === "secret" || item.category === "clue")
      .map((item) => ({
        title: item.title,
        content: item.content,
        source: item.category,
      })),
    ...(bible.knowledge_graph?.facts || []).map((fact) => ({
      title: fact.title,
      content: `${fact.content}${fact.truth_status !== "true" ? `（状态：${fact.truth_status}）` : ""}`,
      source: fact.source,
    })),
    ...bible.roles.map((role) => ({
      title: `${role.name}的真实动机`,
      content: [role.private_background, role.secret_goal].filter(Boolean).join("；"),
      source: "role_secret",
    })),
    ...bible.npcs.map((npc) => ({
      title: `${npc.name}的隐藏目标`,
      content: [npc.public_identity, npc.secret_goal, ...npc.memory].filter(Boolean).join("；"),
      source: "npc_secret",
    })),
    ...Object.values(worldState.faction_states || {}).flatMap((factionState) => {
      const faction = bible.factions.find((item) => item.id === factionState.faction_id);
      return factionState.hidden_information.map((content, index) => ({
        title: `${faction?.name || factionState.faction_id}的隐秘情报 ${index + 1}`,
        content,
        source: "faction_secret",
      }));
    }),
  ].filter((item) => item.content.trim().length > 0);

  const seen = new Set<string>();
  return truth.filter((item) => {
    const key = `${item.title}:${item.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildChronicle(historyEvents: HistoricalWorldEvent[], worldState: WorldState, bible: StoryBible) {
  const recorded = historyEvents.map((event) => ({
    turn: event.turn,
    title: event.title,
    description: event.description,
    trigger_reason: event.trigger_reason,
  }));
  const recordedIds = new Set(historyEvents.map((event) => event.event_id));
  const fallback = worldState.events
    .filter((event) => event.triggered && !recordedIds.has(event.event_id))
    .map((event) => {
      const eventDef = bible.events.find((item) => item.id === event.event_id);
      return {
        turn: event.trigger_turn ?? 0,
        title: eventDef?.title || publicLabel(event.event_id),
        description: eventDef?.description || "该事件已在世界状态中发生。",
        trigger_reason: "世界状态记录为已触发",
      };
    });

  return [...recorded, ...fallback].sort((a, b) => a.turn - b.turn);
}

function buildGMReview(
  participant: ReturnType<typeof buildRecapParticipants>[number],
  actions: HistoricalAction[],
  worldState: WorldState
) {
  const ownActions = actions.filter((action) => action.actor_id === participant.id);
  const successful = ownActions.filter((action) => action.success);
  const investigations = ownActions.filter((action) =>
    ["investigate", "search", "track", "eavesdrop", "interrogate", "decode", "spy", "divination", "gather_intelligence"].includes(action.action_type)
  );
  const socialMoves = ownActions.filter((action) =>
    ["talk", "persuade", "threaten", "deceive", "ally", "betray", "confess"].includes(action.action_type)
  );
  const highRiskWins = ownActions.filter((action) => action.risk_level === "high" && action.success);
  const discoveries = worldState.knowledge_state.discovered_facts.filter((fact) => fact.discoverer_id === participant.id);
  const score =
    successful.length * 3 +
    investigations.length * 2 +
    socialMoves.length +
    highRiskWins.length * 2 +
    discoveries.length * 3;

  const highlights = [
    ownActions.length > 0 ? `共行动 ${ownActions.length} 次，成功 ${successful.length} 次。` : "本局没有留下可公开行动记录。",
    investigations.length > 0 ? `推动调查 ${investigations.length} 次。` : "",
    socialMoves.length > 0 ? `参与谈判、欺瞒或结盟 ${socialMoves.length} 次。` : "",
    discoveries.length > 0 ? `发现关键线索 ${discoveries.length} 条。` : "",
    highRiskWins.length > 0 ? `完成高风险成功行动 ${highRiskWins.length} 次。` : "",
  ].filter(Boolean);

  return {
    player_id: participant.id,
    display_name: participant.display_name,
    kind: participant.kind,
    role_id: participant.role_id,
    role_name: participant.role_name,
    score,
    highlights,
    gm_comment: buildGMComment(participant.display_name, ownActions, score, highlights),
  };
}

function buildGMComment(displayName: string, actions: HistoricalAction[], score: number, highlights: string[]): string {
  if (actions.length === 0) {
    return `GM点评：${displayName}在公开记录中较少直接出手，但其角色仍构成了结局版图的一部分。`;
  }
  const tone = score >= 12
    ? "是本局非常有存在感的推动者"
    : score >= 6
    ? "稳定参与了局势推进"
    : "行动较谨慎，影响主要体现在局部";
  return `GM点评：${displayName}${tone}。${highlights.join("")}`;
}

function displayActorName(
  action: HistoricalAction,
  participants: ReturnType<typeof buildRecapParticipants>
): string {
  return participants.find((participant) => participant.id === action.actor_id)?.display_name ||
    action.role_name ||
    action.actor_name ||
    publicLabel(action.actor_id);
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
    spy: "侦察",
    divination: "占卜",
    gather_intelligence: "收集情报",
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
    defend: "防御",
    execute: "处决",
    sacrifice: "牺牲",
    buy: "购买",
    trade: "交易",
    steal: "偷取",
    transport: "转移",
    build: "建造",
  };
  return labels[actionType] || publicLabel(actionType);
}

function buildPublicFlagSummary(flags: Record<string, boolean>): Record<string, boolean> {
  const summary: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(flags)) {
    if (!value) continue;
    if (/^chapter_\d+_started$/.test(key)) {
      summary[`第 ${key.match(/\d+/)?.[0] || "?"} 章已开始`] = true;
      continue;
    }
    if (/^(adv_|personal_victory_|completed_|known_|triggered_|event_)/.test(key)) continue;
    summary[publicLabel(key)] = true;
  }
  return summary;
}

function publicLabel(value: string): string {
  return String(value || "")
    .replace(/^evt_/, "")
    .replace(/^event_/, "")
    .replace(/^ending_/, "")
    .replace(/^npc_/, "")
    .replace(/^role_/, "角色 ")
    .replace(/_/g, " ")
    .trim() || "未知条目";
}
