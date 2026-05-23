import { NextRequest, NextResponse } from "next/server";
import { generateStoryBible } from "@/engine/storyBibleGenerator";
import { validateStoryBible } from "@/engine/storyBibleValidator";
import { roomManager } from "@/lib/roomManager";
import type { StorySeed } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seed: StorySeed = {
      genre: body.genre || "西幻",
      opening: body.opening || "",
      ending: body.ending || "",
      characters: body.characters || "",
      world_setting: body.world_setting || "",
      source_type: "manual",
    };

    const bible = await generateStoryBible(seed);
    const validation = validateStoryBible(bible);

    // Store bible for later use
    roomManager.setStoryBible(bible);

    return NextResponse.json({
      success: true,
      story_bible: bible,
      validation,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
