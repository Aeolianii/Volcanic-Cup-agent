import { NextResponse } from "next/server";
import { enhanceStorySeedWithLLM } from "@/lib/llmProvider";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await enhanceStorySeedWithLLM({
      genre: String(body.genre || ""),
      opening: String(body.opening || ""),
      ending: String(body.ending || ""),
      characters: String(body.characters || ""),
      character_details: String(body.character_details || ""),
      world_setting: String(body.world_setting || ""),
      playability_score: typeof body.playability_score === "number" ? body.playability_score : undefined,
      suggested_fixes: Array.isArray(body.suggested_fixes) ? body.suggested_fixes.map(String) : [],
    });

    return NextResponse.json({
      success: true,
      enhanced: result.value,
      provider_status: result.ok
        ? { provider: "llm", ok: true, model: result.model, base_url: result.baseUrl }
        : { provider: "fallback", ok: false, reason: result.reason, model: result.model, base_url: result.baseUrl },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
