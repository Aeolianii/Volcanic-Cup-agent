import { NextResponse } from "next/server";
import { roomManager } from "@/lib/roomManager";
import { generateGMNarrative } from "@/engine/aiGM";
import { mockAIProvider } from "@/mock/mockAIProvider";
import type { PlayerView } from "@/types";

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
      mockAIProvider,
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

    const playerView: PlayerView = {
      role_sheet: player.role,
      known_facts: pk.known_facts,
      known_npcs: pk.known_npcs,
      known_locations: pk.known_locations,
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
      suggested_actions: gmOutput.suggested_actions.map((sa, i) => ({
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

    return NextResponse.json({ success: true, player_view: playerView });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
