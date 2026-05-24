import { NextResponse } from "next/server";
import { generateRandomStorySeedWithLLM } from "@/lib/llmProvider";

export async function POST() {
  try {
    const result = await generateRandomStorySeedWithLLM();

    const repaired = !result.ok && result.reason?.includes("自动提取可用字段");

    return NextResponse.json({
      success: true,
      story: result.value,
      provider_status: result.ok
        ? { provider: "llm", ok: true, model: result.model, base_url: result.baseUrl }
        : repaired
          ? { provider: "llm_repaired", ok: true, warning: result.reason, model: result.model, base_url: result.baseUrl }
          : { provider: "fallback", ok: false, reason: result.reason, model: result.model, base_url: result.baseUrl },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
