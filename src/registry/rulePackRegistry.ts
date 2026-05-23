import type { RulePackRef } from "@/types";

export interface RulePack {
  pack_id: string;
  pack_type: string;
  name: string;
  description: string;
  features: string[];
  rules: RuleDefinition[];
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  condition: string; // expression evaluated against state
  effect: string;    // effect description
}

const registry = new Map<string, RulePack>();

export function registerRulePack(pack: RulePack): void {
  registry.set(pack.pack_id, pack);
}

export function getRulePack(packId: string): RulePack | undefined {
  return registry.get(packId);
}

export function getEnabledPacks(refs: RulePackRef[]): RulePack[] {
  return refs
    .filter((ref) => ref.enabled)
    .map((ref) => registry.get(ref.pack_id))
    .filter((p): p is RulePack => p !== undefined);
}

// ---- MVP Rule Packs ----

export const FACTION_PACK: RulePack = {
  pack_id: "faction_pack",
  pack_type: "faction",
  name: "阵营规则包",
  description: "处理阵营关系、声望、联盟和背叛",
  features: ["has_factions", "has_conflict"],
  rules: [
    {
      id: "faction_reputation",
      name: "阵营声望",
      description: "玩家行动影响阵营声望",
      condition: "action_involves_faction",
      effect: "modify_faction_reputation",
    },
    {
      id: "faction_alliance",
      name: "阵营联盟",
      description: "足够好感可结盟",
      condition: "faction_reputation > 60",
      effect: "form_alliance",
    },
    {
      id: "faction_betrayal",
      name: "阵营背叛",
      description: "负声望触发敌对",
      condition: "faction_reputation < -30",
      effect: "trigger_hostility",
    },
  ],
};

export const MYSTERY_PACK: RulePack = {
  pack_id: "mystery_pack",
  pack_type: "mystery",
  name: "推理规则包",
  description: "处理线索发现、证据收集、真相揭示",
  features: ["has_mystery"],
  rules: [
    {
      id: "clue_discovery",
      name: "线索发现",
      description: "调查行动可发现线索",
      condition: "action_type == 'investigate'",
      effect: "reveal_clue",
    },
    {
      id: "evidence_chain",
      name: "证据链",
      description: "收集足够证据可解锁新推理",
      condition: "evidence_count >= 3",
      effect: "unlock_deduction",
    },
    {
      id: "truth_reveal",
      name: "真相揭示",
      description: "真相进度达到 100 揭示最终真相",
      condition: "truth_progress >= 100",
      effect: "reveal_truth",
    },
  ],
};

export const RELATIONSHIP_PACK: RulePack = {
  pack_id: "relationship_pack",
  pack_type: "relationship",
  name: "关系规则包",
  description: "处理角色关系变化、信任与怀疑",
  features: ["has_relationships"],
  rules: [
    {
      id: "trust_building",
      name: "信任建立",
      description: "合作行动增加信任",
      condition: "action_type in ['ally', 'confess', 'talk']",
      effect: "increase_trust",
    },
    {
      id: "trust_decay",
      name: "信任衰减",
      description: "欺骗和背叛降低信任",
      condition: "action_type in ['deceive', 'betray', 'threaten']",
      effect: "decrease_trust",
    },
    {
      id: "suspicion_trigger",
      name: "怀疑触发",
      description: "秘密行动被发现增加怀疑值",
      condition: "stealth_action_failed",
      effect: "increase_suspicion",
    },
  ],
};

export function initRulePackRegistry(): void {
  registerRulePack(FACTION_PACK);
  registerRulePack(MYSTERY_PACK);
  registerRulePack(RELATIONSHIP_PACK);
}
