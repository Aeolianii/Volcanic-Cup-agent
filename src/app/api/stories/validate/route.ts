import { NextRequest, NextResponse } from "next/server";
import { validateStoryBible } from "@/engine/storyBibleValidator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateStoryBible(body.story_bible);

    return NextResponse.json({ success: true, validation });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
