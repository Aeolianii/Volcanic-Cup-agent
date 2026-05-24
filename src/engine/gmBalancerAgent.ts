import type { Player, PlayerAdvantageScore, StateUpdate, StoryBible, WorldState } from "@/types";

export interface GMBalancerResult {
  scores: PlayerAdvantageScore[];
  updates: StateUpdate[];
  narrative_hint?: string;
}

const BALANCE_INTERVAL = 2;
const ADVANTAGE_GAP = 35;

export function runGMBalancerAgent(
  players: Player[],
  state: WorldState,
  bible: StoryBible
): GMBalancerResult {
  if (state.turn - state.balance_state.last_balance_turn < BALANCE_INTERVAL) {
    return { scores: state.balance_state.player_advantage_scores, updates: [] };
  }

  const activePlayers = players.filter((player) => player.role_id);
  const scores = activePlayers.map((player) => calculatePlayerAdvantage(player, state, bible));
  if (scores.length < 2) return { scores, updates: [] };

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const gap = strongest.score - weakest.score;
  const updates: StateUpdate[] = [
    {
      type: "record_balance_event",
      value: `第 ${state.turn} 回合完成优势评估，最高 ${strongest.player_id}:${strongest.score}，最低 ${weakest.player_id}:${weakest.score}`,
    },
  ];

  if (gap >= ADVANTAGE_GAP) {
    updates.push(...buildSoftBalancingUpdates(strongest, weakest, bible));
  }

  return {
    scores,
    updates,
    narrative_hint: gap >= ADVANTAGE_GAP ? "局势出现明显倾斜，GM 生成了保持参与感的软平衡事件。" : undefined,
  };
}

function calculatePlayerAdvantage(
  player: Player,
  state: WorldState,
  bible: StoryBible
): PlayerAdvantageScore {
  const roleId = player.role_id || player.player_id;
  const knowledge = state.knowledge_state.player_knowledge[player.player_id] ||
    state.knowledge_state.player_knowledge[roleId];
  const model = bible.character_models?.find((item) => item.id === roleId);
  const factionId = model?.faction_id || bible.factions.find((faction) => faction.members.includes(roleId))?.id;
  const factionState = factionId ? state.faction_states[factionId] : undefined;
  const relationships = state.relationships.filter((relationship) =>
    relationship.source_id === player.player_id ||
    relationship.source_id === roleId ||
    relationship.target_id === player.player_id ||
    relationship.target_id === roleId
  );
  const relationshipScore = relationships.reduce((sum, relationship) => sum + Math.max(0, relationship.value), 0) / 5;
  const attributes = model?.attributes.base || {};

  const factors = {
    information: (knowledge?.known_facts.length || 0) * 4 + (knowledge?.evidence.length || 0) * 6,
    relationships: relationshipScore,
    combat: Math.max(0, Number(attributes.combat || 50) - 50),
    influence: Math.max(0, Number(attributes.influence || 50) - 50),
    resources: factionState ? (factionState.resources + factionState.power + factionState.public_support) / 6 : 0,
  };

  return {
    player_id: player.player_id,
    score: Math.round(Object.values(factors).reduce((sum, value) => sum + value, 0)),
    factors,
  };
}

function buildSoftBalancingUpdates(
  strongest: PlayerAdvantageScore,
  weakest: PlayerAdvantageScore,
  bible: StoryBible
): StateUpdate[] {
  const pressureMetric = findMetricId(bible, ["suspicion", "pressure", "tension", "influence", "power"]);
  const progressMetric = findMetricId(bible, ["truth_progress", "progress", "clue", "evidence"]);
  const updates: StateUpdate[] = [];

  if (pressureMetric) {
    updates.push({
      type: "metric_change",
      metric: pressureMetric,
      delta: 4,
    });
  }
  updates.push({
    type: "add_false_information",
    target: strongest.player_id,
    fact_id: `balance_exposure_risk_${Date.now()}`,
    value: "你最近的优势引来了额外关注，一些传闻开始围绕你的行动扩散。",
    metric: "gm_balance",
    delta: 50,
  });

  if (progressMetric) {
    updates.push({
      type: "add_discovered_clue",
      target: weakest.player_id,
      fact_id: `balance_opportunity_${Date.now()}`,
      value: "gm_balance",
      delta: 65,
    });
    updates.push({
      type: "add_known_fact",
      target: weakest.player_id,
      fact_id: "你意外获得了一个重新参与局势的机会，但它仍需要后续行动验证。",
    });
  }

  return updates;
}

function findMetricId(bible: StoryBible, candidates: string[]): string | undefined {
  return bible.metrics.find((metric) => {
    const haystack = `${metric.id} ${metric.label}`.toLowerCase();
    return candidates.some((candidate) => haystack.includes(candidate));
  })?.id;
}
