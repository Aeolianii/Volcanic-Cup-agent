import type {
  ChatChannel,
  Player,
  StoryBible,
  VisibleFaction,
  WorldState,
} from "@/types";

export function getCharacterFactionId(characterId: string, bible: StoryBible): string | undefined {
  return bible.character_models?.find((model) => model.id === characterId)?.faction_id ||
    bible.factions.find((faction) => faction.members.includes(characterId))?.id;
}

export function buildVisibleFactionsForPlayer(
  player: Player,
  state: WorldState,
  bible: StoryBible
): VisibleFaction[] {
  const roleId = player.role_id || player.role?.id || player.player_id;
  const ownFactionId = getCharacterFactionId(roleId, bible);
  const knowledge = state.knowledge_state.player_knowledge[player.player_id] ||
    state.knowledge_state.player_knowledge[roleId];
  const knownFacts = new Set([...(knowledge?.known_facts || []), ...(state.knowledge_state.public_knowledge || [])]);

  return bible.factions.reduce<VisibleFaction[]>((visible, faction) => {
      const model = bible.faction_models?.find((item) => item.id === faction.id);
      const canSeeOwnFaction = faction.id === ownFactionId;
      const knownMembers = new Set<string>(model?.public_members || []);

      if (canSeeOwnFaction) {
        for (const member of faction.members) knownMembers.add(member);
      }

      for (const member of faction.members) {
        if (
          knownFacts.has(`faction_member:${faction.id}:${member}`) ||
          knownFacts.has(`truth_faction_membership_${faction.id}`) ||
          knownFacts.has(member)
        ) {
          knownMembers.add(member);
        }
      }

      const shouldShow = canSeeOwnFaction || knownMembers.size > 0 || knownFacts.has(`faction:${faction.id}`);
      if (!shouldShow) return visible;

      const runtime = state.faction_states[faction.id];
      const item: VisibleFaction = {
        id: faction.id,
        name: faction.name,
        description: faction.description,
        goals: canSeeOwnFaction ? faction.goals : [],
        relationships: canSeeOwnFaction ? faction.relationships : {},
        known_members: Array.from(knownMembers),
      };
      if (runtime) {
        item.state = {
          power: runtime.power,
          resources: runtime.resources,
          public_support: runtime.public_support,
        };
      }
      visible.push(item);
      return visible;
    }, []);
}

export function buildChatChannelsForPlayer(
  player: Player,
  roomPlayers: Player[],
  state: WorldState,
  bible: StoryBible
): ChatChannel[] {
  const roleId = player.role_id || player.role?.id || player.player_id;
  const factionId = getCharacterFactionId(roleId, bible);
  const channels: ChatChannel[] = [
    {
      id: "public",
      type: "public",
      label: "公共频道",
      member_ids: roomPlayers.map((item) => item.player_id),
      pinned: true,
      unread_count: 0,
      unlocked: true,
    },
  ];

  if (factionId) {
    const faction = bible.factions.find((item) => item.id === factionId);
    const memberPlayerIds = roomPlayers
      .filter((item) => item.role_id && faction?.members.includes(item.role_id))
      .map((item) => item.player_id);
    channels.push({
      id: `faction:${factionId}`,
      type: "faction",
      label: `${faction?.name || "阵营"}频道`,
      member_ids: memberPlayerIds,
      pinned: true,
      unread_count: 0,
      unlocked: true,
    });
  }

  for (const other of roomPlayers) {
    if (other.player_id === player.player_id) continue;
    const otherFaction = getCharacterFactionId(other.role_id || other.player_id, bible);
    const sameFaction = factionId && otherFaction && factionId === otherFaction;
    const unlocked = sameFaction ||
      hasPrivateChatUnlocked(player.player_id, other.player_id, state) ||
      Boolean(other.role_id && hasPrivateChatUnlocked(player.player_id, other.role_id, state)) ||
      Boolean(player.role_id && hasPrivateChatUnlocked(player.role_id, other.player_id, state)) ||
      Boolean(player.role_id && other.role_id && hasPrivateChatUnlocked(player.role_id, other.role_id, state));
    if (!unlocked) continue;
    channels.push({
      id: privateChannelId(player.player_id, other.player_id),
      type: "private",
      label: `私聊：${other.role?.name || other.name}`,
      member_ids: [player.player_id, other.player_id],
      pinned: false,
      unread_count: 0,
      unlocked: true,
    });
  }

  return channels;
}

export function hasPrivateChatUnlocked(a: string, b: string, state: WorldState): boolean {
  return state.communication_state.unlocked_private_chats.some((unlock) =>
    unlock.participants.includes(a) && unlock.participants.includes(b)
  );
}

export function privateChannelId(a: string, b: string): string {
  return `pm:${[a, b].sort().join(":")}`;
}
