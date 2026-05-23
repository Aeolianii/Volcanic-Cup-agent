import type { NPC, NPCLocalView, ActionProposal } from "@/types";
import type { AIProvider } from "@/types";

/**
 * AI NPC Planner
 * Generates NPC Action Proposals based on limited local view.
 * In production, delegates to AI; MVP uses behavioral rules.
 */
export async function generateNPCActionProposal(
  npc: NPC,
  localView: NPCLocalView,
  aiProvider: AIProvider
): Promise<ActionProposal> {
  // Try AI first (mock returns null, triggering fallback)
  try {
    const aiOutput = await aiProvider.generateNPCAction({
      npc_id: npc.id,
      npc_name: npc.name,
      npc_personality: npc.personality,
      npc_goal: npc.goal,
      npc_secret_goal: npc.secret_goal,
      local_view: localView,
    });

    if (aiOutput) {
      return {
        npc_id: npc.id,
        intention: aiOutput.intention,
        action_type: aiOutput.action_type as ActionProposal["action_type"],
        target: aiOutput.target,
        method: aiOutput.method,
        reasoning_visible: aiOutput.reasoning_visible,
        risk_level: aiOutput.risk_level,
        requires_rule_check: true,
      };
    }
  } catch {
    // Fall through to behavioral rules
  }

  // Fallback: behavioral rule-based planning
  return behavioralPlanner(npc, localView);
}

function behavioralPlanner(npc: NPC, localView: NPCLocalView): ActionProposal {
  const { personality, goal, behavior_style } = npc;

  // NPC with high deception tries to deceive
  if (behavior_style.deception > 50 && localView.known_players.length > 0) {
    const target = localView.known_players[0];
    return {
      npc_id: npc.id,
      intention: `隐藏真实意图，误导 ${target.name}`,
      action_type: "deceive",
      target: target.id,
      method: "misdirection",
      reasoning_visible: `${npc.name} 似乎话中有话...`,
      risk_level: "medium",
      requires_rule_check: true,
    };
  }

  // NPC with high cooperation tries to ally or talk
  if (behavior_style.cooperation > 50 && localView.known_players.length > 0) {
    const target = localView.known_players[0];
    return {
      npc_id: npc.id,
      intention: `与 ${target.name} 建立联系，推进 ${goal}`,
      action_type: "talk",
      target: target.id,
      method: "conversation",
      reasoning_visible: `${npc.name} 似乎想与你交流什么...`,
      risk_level: "low",
      requires_rule_check: false,
    };
  }

  // NPC with high aggression threatens or attacks
  if (behavior_style.aggression > 60 && localView.known_players.length > 0) {
    const target = localView.known_players[0];
    return {
      npc_id: npc.id,
      intention: `向 ${target.name} 施压，展示力量`,
      action_type: "threaten",
      target: target.id,
      method: "intimidation",
      reasoning_visible: `${npc.name} 的语气变得咄咄逼人...`,
      risk_level: "medium",
      requires_rule_check: true,
    };
  }

  // Default: NPC does something related to their goal
  return {
    npc_id: npc.id,
    intention: `推进自己的目标: ${goal}`,
    action_type: "talk",
    target: localView.known_players[0]?.id || "unknown",
    method: "conversation",
    reasoning_visible: `${npc.name} 按照自己的计划行事。`,
    risk_level: "low",
    requires_rule_check: false,
  };
}
