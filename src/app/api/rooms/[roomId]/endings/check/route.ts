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
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
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
