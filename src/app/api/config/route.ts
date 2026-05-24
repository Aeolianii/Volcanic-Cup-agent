import { NextRequest, NextResponse } from "next/server";
import { setRuntimeLLMConfig, getRuntimeLLMConfig } from "@/lib/runtimeConfig";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, baseUrl, model } = body;

    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 3) {
      return NextResponse.json({ success: false, error: "API Key 无效" }, { status: 400 });
    }

    const resolvedBaseUrl = typeof baseUrl === "string" && baseUrl.length > 0
      ? baseUrl
      : "https://api.deepseek.com";

    const resolvedModel = typeof model === "string" && model.length > 0
      ? model
      : "deepseek-v4-pro";

    setRuntimeLLMConfig({
      apiKey: apiKey.trim(),
      baseUrl: resolvedBaseUrl.trim(),
      model: resolvedModel.trim(),
    });

    return NextResponse.json({
      success: true,
      config: {
        baseUrl: resolvedBaseUrl,
        model: resolvedModel,
        hasKey: true,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "请求解析失败" }, { status: 400 });
  }
}

export async function GET() {
  const config = getRuntimeLLMConfig();
  return NextResponse.json({
    hasConfig: !!config,
    config: config
      ? { baseUrl: config.baseUrl, model: config.model, hasKey: true }
      : null,
  });
}
