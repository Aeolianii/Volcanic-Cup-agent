import type { Player, StateUpdate, StoryBible, StructuredAction, TurnState, WorldState } from "@/types";

const DEFAULT_MAX_ROUNDS = 12;
const DEFAULT_ACTIONS_PER_PLAYER = 2;
const DEFAULT_NPC_ACTIONS_PER_ROUND = 2;

export function ensureTurnState(state: WorldState): WorldState {
  const turnState: TurnState = {
    current_round: state.turn_state?.current_round || Math.max(1, state.turn || 1),
    max_rounds: state.turn_state?.max_rounds || DEFAULT_MAX_ROUNDS,
    actions_per_player: state.turn_state?.actions_per_player || DEFAULT_ACTIONS_PER_PLAYER,
    npc_actions_per_round: state.turn_state?.npc_actions_per_round || DEFAULT_NPC_ACTIONS_PER_ROUND,
    player_action_counts: { ...(state.turn_state?.player_action_counts || {}) },
    npc_action_counts: { ...(state.turn_state?.npc_action_counts || {}) },
    round_history: [...(state.turn_state?.round_history || [])],
  };

  return {
    ...state,
    turn: turnState.current_round,
    turn_state: turnState,
  };
}

export function isConversationAction(action: StructuredAction): boolean {
  return action.action_source === "chat" ||
    action.method === "rp_chat" ||
    action.method === "ooc_chat";
}

export function getPlayerActionsUsed(state: WorldState, playerId: string): number {
  return ensureTurnState(state).turn_state.player_action_counts[playerId] || 0;
}

export function getPlayerActionsRemaining(state: WorldState, playerId: string): number {
  const ensured = ensureTurnState(state);
  return Math.max(0, ensured.turn_state.actions_per_player - getPlayerActionsUsed(ensured, playerId));
}

export function canPlayerTakeAction(
  state: WorldState,
  playerId: string,
  action: StructuredAction
): { allowed: boolean; reason: string } {
  const ensured = ensureTurnState(state);
  if (isConversationAction(action)) return { allowed: true, reason: "" };
  if (ensured.turn_state.current_round > ensured.turn_state.max_rounds) {
    return { allowed: false, reason: "剧本回合已经结束，当前只能查看结算。" };
  }
  if (getPlayerActionsRemaining(ensured, playerId) <= 0) {
    return { allowed: false, reason: "你本回合的两次行动已经用完，可以继续对话或等待下一回合。" };
  }
  return { allowed: true, reason: "" };
}

export function consumePlayerAction(state: WorldState, playerId: string, action: StructuredAction): WorldState {
  const ensured = ensureTurnState(state);
  if (isConversationAction(action)) return ensured;
  return {
    ...ensured,
    turn_state: {
      ...ensured.turn_state,
      player_action_counts: {
        ...ensured.turn_state.player_action_counts,
        [playerId]: getPlayerActionsUsed(ensured, playerId) + 1,
      },
    },
  };
}

export function getNPCActionCount(state: WorldState, npcId: string): number {
  return ensureTurnState(state).turn_state.npc_action_counts[npcId] || 0;
}

export function canNPCTakeAction(state: WorldState, npcId: string): boolean {
  const ensured = ensureTurnState(state);
  if (ensured.turn_state.current_round > ensured.turn_state.max_rounds) return false;
  return getNPCActionCount(ensured, npcId) < ensured.turn_state.npc_actions_per_round;
}

export function consumeNPCAction(state: WorldState, npcId: string): WorldState {
  const ensured = ensureTurnState(state);
  return {
    ...ensured,
    turn_state: {
      ...ensured.turn_state,
      npc_action_counts: {
        ...ensured.turn_state.npc_action_counts,
        [npcId]: getNPCActionCount(ensured, npcId) + 1,
      },
    },
  };
}

export function maybeAdvanceRound(
  state: WorldState,
  players: Player[],
  reason = "all_player_actions_spent"
): WorldState {
  const ensured = ensureTurnState(state);
  const activePlayerIds = players
    .filter((player) => player.role_id)
    .map((player) => player.player_id);

  if (activePlayerIds.length === 0) return ensured;
  const allPlayersSpent = activePlayerIds.every((playerId) =>
    getPlayerActionsUsed(ensured, playerId) >= ensured.turn_state.actions_per_player
  );
  if (!allPlayersSpent) return ensured;
  if (ensured.turn_state.current_round >= ensured.turn_state.max_rounds) return ensured;

  const nextRound = ensured.turn_state.current_round + 1;
  return {
    ...ensured,
    turn: nextRound,
    turn_state: {
      ...ensured.turn_state,
      current_round: nextRound,
      player_action_counts: {},
      npc_action_counts: {},
      round_history: [
        ...ensured.turn_state.round_history,
        {
          round: ensured.turn_state.current_round,
          ended_at_turn: ensured.turn_state.current_round,
          reason,
        },
      ],
    },
  };
}

export function buildRoundPressureUpdates(state: WorldState, bible: StoryBible): StateUpdate[] {
  const ensured = ensureTurnState(state);
  const round = ensured.turn_state.current_round;
  if (round <= 1) return [];

  const progressMetric = findMetricId(bible, ["truth_progress", "progress", "truth", "clue", "evidence"]);
  const pressureMetric = findMetricId(bible, ["suspicion", "pressure", "tension", "influence", "power"]);
  const stabilityMetric = findMetricId(bible, ["stability", "order", "safety"]);
  const updates: StateUpdate[] = [
    {
      type: "record_balance_event",
      value: `第 ${round} 回合开始：即使玩家暂缓推进，NPC 与局势也会继续向各自目标滑动。`,
    },
  ];

  if (progressMetric) updates.push({ type: "metric_change", metric: progressMetric, delta: round >= 4 ? 6 : 3 });
  if (pressureMetric) updates.push({ type: "metric_change", metric: pressureMetric, delta: 5 });
  if (stabilityMetric) updates.push({ type: "metric_change", metric: stabilityMetric, delta: round >= 4 ? -6 : -3 });

  return updates;
}

export function isFinalRoundReached(state: WorldState): boolean {
  const ensured = ensureTurnState(state);
  return ensured.turn_state.current_round >= ensured.turn_state.max_rounds;
}

function findMetricId(bible: StoryBible, candidates: string[]): string | undefined {
  return bible.metrics.find((metric) => {
    const haystack = `${metric.id} ${metric.label}`.toLowerCase();
    return candidates.some((candidate) => haystack.includes(candidate.toLowerCase()));
  })?.id;
}

export function inferMaxRoundsForBible(bible: StoryBible): number {
  const chapterScore = Math.max(4, Math.min(7, bible.chapters.length || 4));
  const roleScore = Math.max(1, Math.min(4, bible.roles.length || 4));
  const eventScore = Math.max(1, Math.ceil((bible.events.length || 4) / 2));
  return Math.max(10, Math.min(18, chapterScore * 2 + roleScore + eventScore));
}
