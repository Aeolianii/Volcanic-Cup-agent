import type { StoryFeatures } from "./featureExtractor";
import type { RulePackRef } from "@/types";

export function selectRulePacks(features: StoryFeatures): RulePackRef[] {
  const packs: RulePackRef[] = [];

  if (features.has_factions || features.has_conflict) {
    packs.push({ pack_id: "faction_pack", pack_type: "faction", enabled: true });
  }
  if (features.has_mystery) {
    packs.push({ pack_id: "mystery_pack", pack_type: "mystery", enabled: true });
  }
  if (features.has_relationships) {
    packs.push({ pack_id: "relationship_pack", pack_type: "relationship", enabled: true });
  }

  return packs;
}
