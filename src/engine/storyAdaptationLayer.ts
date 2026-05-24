import type {
  CharacterModel,
  Faction,
  FactionModel,
  KnowledgeGraph,
  KnowledgeGraphFact,
  RelationshipGraph,
  StoryBible,
  StoryGenreProfile,
  StoryRuntimeModules,
  StorySeed,
  VictoryCondition,
} from "@/types";

const BASE_ATTRIBUTES = {
  influence: 50,
  intelligence: 50,
  combat: 50,
  wealth: 50,
  reputation: 50,
  loyalty: 50,
  suspicion: 0,
};

export function enrichStoryBibleForSimulation(bible: StoryBible, seed?: StorySeed): StoryBible {
  const genreText = [
    seed?.genre,
    seed?.opening,
    seed?.ending,
    seed?.world_setting,
    bible.title,
    bible.world_setting.atmosphere,
  ].join(" ");

  return {
    ...bible,
    character_models: buildCharacterModels(bible, genreText),
    faction_models: buildFactionModels(bible),
    relationship_graph: buildRelationshipGraph(bible),
    knowledge_graph: buildKnowledgeGraph(bible),
    victory_conditions: buildVictoryConditions(bible),
    runtime_modules: bible.runtime_modules || buildRuntimeModules(bible, genreText),
  };
}

export function buildRuntimeModules(bible: StoryBible, sourceText = ""): StoryRuntimeModules {
  const text = [
    sourceText,
    bible.title,
    bible.world_setting.era,
    bible.world_setting.location,
    bible.world_setting.atmosphere,
    bible.world_setting.magic_system,
    bible.world_setting.technology_level,
    ...(bible.world_setting.special_rules || []),
    ...bible.roles.map((role) => `${role.name} ${role.public_identity} ${role.public_goal} ${role.secret_goal}`),
    ...bible.npcs.map((npc) => `${npc.name} ${npc.public_identity} ${npc.goal} ${npc.secret_goal}`),
    ...bible.factions.map((faction) => `${faction.name} ${faction.description} ${faction.goals.join(" ")}`),
    ...bible.events.map((event) => `${event.title} ${event.description}`),
  ].join(" ");
  const profile = inferRuntimeProfile(text);
  const lethalSignals = /死亡|谋杀|刺杀|处刑|献祭|战争|战斗|恐怖|命案|末日|杀戮|assassin|murder|death|execution|war|horror|combat/i.test(text);
  const hasFactions = bible.factions.length > 0;
  const hasMystery = /推理|侦探|案件|线索|调查|谜|mystery|detective|clue|case/i.test(text);
  const isRelationship = profile === "campus_romance" || profile === "romance";
  const isComedy = profile === "comedy";
  const isLethal = !isComedy && !isRelationship && lethalSignals;

  return {
    genre_profile: profile,
    tone_tags: buildToneTags(profile, text),
    enabled: {
      knowledge_fog: true,
      investigation: hasMystery || hasFactions || profile !== "comedy",
      misinformation: hasMystery || hasFactions || profile === "political_intrigue",
      factions: hasFactions,
      private_chat: true,
      relationship_routes: isRelationship || profile === "workplace" || isComedy,
      combat: isLethal || profile === "combat_adventure",
      character_death: isLethal,
      ghost_mode: isLethal,
      failure_screen: !isComedy,
      comic_setbacks: isComedy,
      gm_balancer: true,
      auto_simulation_after_exit: isLethal || profile === "political_intrigue" || hasFactions,
    },
    consequence_mode: isLethal
      ? "lethal"
      : isComedy
      ? "comic_setback"
      : isRelationship
      ? "romance_failure"
      : hasMystery
      ? "investigation_failure"
      : "social_setback",
    disabled_action_types: isLethal ? [] : ["assassinate", "execute", "sacrifice", "ambush", "duel"],
    consequence_labels: {
      lethal: "角色死亡",
      non_lethal: isComedy ? "整活翻车" : isRelationship ? "攻略失败" : "行动受挫",
      failed_route: isRelationship ? "关系线失败" : hasMystery ? "推理受阻" : "目标暂时失败",
      setback: isComedy ? "笑点反噬" : "局势受挫",
    },
  };
}

function inferRuntimeProfile(text: string): StoryGenreProfile {
  if (/校园|青春|高中|大学|同学|学生|社团|campus|school/i.test(text) && /恋爱|言情|爱情|暗恋|告白|攻略|romance|love/i.test(text)) {
    return "campus_romance";
  }
  if (/搞笑|喜剧|欢乐|沙雕|爆笑|整活|乌龙|comedy|funny/i.test(text)) return "comedy";
  if (/恋爱|言情|爱情|暗恋|告白|攻略|romance|love/i.test(text)) return "romance";
  if (/恐怖|惊悚|怪谈|灵异|逃生|horror/i.test(text)) return "horror";
  if (/权谋|政治|王国|宫廷|议会|阵营|politic|court|kingdom/i.test(text)) return "political_intrigue";
  if (/战争|战斗|冒险|武侠|骑士|刺客|combat|battle|adventure/i.test(text)) return "combat_adventure";
  if (/推理|侦探|案件|线索|调查|谜|mystery|detective|clue|case/i.test(text)) return "mystery";
  if (/职场|公司|项目|同事|workplace|office/i.test(text)) return "workplace";
  return "generic";
}

function buildToneTags(profile: StoryGenreProfile, text: string): string[] {
  const tags: string[] = [profile];
  if (/轻松|欢乐|搞笑|喜剧|comedy|funny/i.test(text)) tags.push("轻松");
  if (/黑暗|残酷|恐怖|血|dark|horror/i.test(text)) tags.push("高风险");
  if (/恋爱|关系|情感|love|romance/i.test(text)) tags.push("关系驱动");
  if (/推理|线索|调查|mystery|clue/i.test(text)) tags.push("调查驱动");
  return Array.from(new Set(tags));
}

function buildCharacterModels(bible: StoryBible, genreText: string): CharacterModel[] {
  const factionByMember = new Map<string, string>();
  for (const faction of bible.factions) {
    for (const member of faction.members) factionByMember.set(member, faction.id);
  }

  return [
    ...bible.roles.map((role): CharacterModel => ({
      id: role.id,
      name: role.name,
      kind: "player",
      faction_id: factionByMember.get(role.id),
      public_identity: role.public_identity,
      attributes: {
        base: tuneBaseAttributes(role.name, role.public_identity),
        genre_specific: genreAttributes(genreText, role.name),
      },
      public_information: [role.public_identity, role.public_goal],
      self_information: [role.private_background, role.secret_goal],
      starting_known_facts: role.initial_knowledge,
    })),
    ...bible.npcs.map((npc): CharacterModel => ({
      id: npc.id,
      name: npc.name,
      kind: "npc",
      faction_id: factionByMember.get(npc.id),
      public_identity: npc.public_identity,
      attributes: {
        base: tuneBaseAttributes(npc.name, `${npc.public_identity} ${npc.personality}`),
        genre_specific: genreAttributes(genreText, npc.name),
      },
      public_information: [npc.public_identity],
      self_information: [npc.goal, npc.secret_goal],
      starting_known_facts: npc.initial_knowledge,
    })),
  ];
}

function tuneBaseAttributes(name: string, text: string): Record<string, number> {
  const value = { ...BASE_ATTRIBUTES };
  const haystack = `${name} ${text}`;
  if (/王|国王|公主|王子|领袖|首领|官|贵族|会长|captain|leader|prince|king|queen/i.test(haystack)) {
    value.influence += 15;
    value.reputation += 10;
  }
  if (/法师|学者|侦探|医生|科学|智|archmage|scholar|detective|doctor|scientist/i.test(haystack)) {
    value.intelligence += 15;
  }
  if (/骑士|刺客|战士|武|guard|knight|assassin|fighter/i.test(haystack)) {
    value.combat += 15;
  }
  if (/商|富|贵族|merchant|wealth|noble/i.test(haystack)) {
    value.wealth += 15;
  }
  return clampAttributes(value);
}

function genreAttributes(text: string, name: string): Record<string, number> {
  const haystack = `${text} ${name}`;
  if (/恋爱|爱情|暗恋|告白|romance|love/i.test(haystack)) {
    return { affection: 50, trust: 50, jealousy: 10 };
  }
  if (/权谋|政治|王国|宫廷|议会|politic|court|kingdom/i.test(haystack)) {
    return { authority: 50, prestige: 50 };
  }
  if (/侦探|推理|案件|谜|线索|detective|mystery|case/i.test(haystack)) {
    return { deduction: 50 };
  }
  return {};
}

function clampAttributes(attributes: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [key, Math.max(0, Math.min(100, value))])
  );
}

function buildFactionModels(bible: StoryBible): FactionModel[] {
  return bible.factions.map((faction) => {
    const publicMembers = inferPublicMembers(faction, bible);
    return {
      id: faction.id,
      name: faction.name,
      public_members: publicMembers,
      hidden_members: faction.members.filter((member) => !publicMembers.includes(member)),
      state: {
        power: 50,
        resources: 50,
        public_support: 50,
        hidden_information: [],
      },
    };
  });
}

function inferPublicMembers(faction: Faction, bible: StoryBible): string[] {
  const factionText = `${faction.name} ${faction.description}`;
  const isOpenFaction = /王室|教会|学生会|官方|议会|公开|royal|church|council|official/i.test(factionText);
  if (!isOpenFaction) return [];
  return faction.members.filter((memberId) => {
    const role = bible.roles.find((item) => item.id === memberId);
    const npc = bible.npcs.find((item) => item.id === memberId);
    const text = `${role?.public_identity || ""} ${npc?.public_identity || ""}`;
    return !/隐藏|秘密|刺客|卧底|unknown|secret|hidden|assassin/i.test(text);
  });
}

function buildRelationshipGraph(bible: StoryBible): RelationshipGraph {
  const edges = bible.factions.flatMap((faction) =>
    Object.entries(faction.relationships).map(([targetId, value]) => ({
      source_id: faction.id,
      target_id: targetId,
      type: value > 20 ? "alliance" as const : value < -20 ? "hostility" as const : "neutral" as const,
      value,
      known_by: faction.members,
    }))
  );
  return { edges };
}

function buildKnowledgeGraph(bible: StoryBible): KnowledgeGraph {
  const facts: KnowledgeGraphFact[] = bible.knowledge.map((entry) => ({
    id: entry.id,
    title: entry.title,
    content: entry.content,
    truth_status: "true",
    source: entry.category === "public" ? "public" : "world_truth",
    visibility: entry.category === "public" ? "public" : entry.known_by.length > 0 ? "restricted" : "hidden",
    known_by: entry.revealed ? ["all"] : entry.known_by,
  }));

  for (const faction of bible.factions) {
    facts.push({
      id: `truth_faction_membership_${faction.id}`,
      title: `${faction.name}成员真相`,
      content: `${faction.name}的完整成员名单属于世界真相，只有被公开或被调查发现后才能进入角色视野。`,
      truth_status: "true",
      source: "world_truth",
      visibility: "hidden",
      known_by: [],
    });
  }

  return { facts };
}

function buildVictoryConditions(bible: StoryBible): VictoryCondition[] {
  return [
    ...bible.factions.map((faction) => ({
      id: `victory_faction_${faction.id}`,
      scope: "faction" as const,
      owner_id: faction.id,
      description: faction.goals.join("；") || `${faction.name}达成阵营目标`,
      condition_refs: faction.goals,
    })),
    ...bible.roles.map((role) => ({
      id: `victory_personal_${role.id}`,
      scope: "personal" as const,
      owner_id: role.id,
      description: role.secret_goal || role.public_goal,
      condition_refs: [role.secret_goal || role.public_goal],
    })),
  ];
}
