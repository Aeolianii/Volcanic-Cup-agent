import { NextRequest, NextResponse } from "next/server";
import { generateStoryBible } from "@/engine/storyBibleGenerator";
import { validateStoryBible } from "@/engine/storyBibleValidator";
import { analyzeStoryPlayability, applyPlayabilityToBible } from "@/engine/storyPlayabilityAnalyzer";
import { roomManager } from "@/lib/roomManager";
import type { StorySeed } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seed = normalizeStorySeed(body);

    const playability = await analyzeStoryPlayability(seed);
    const bible = applyPlayabilityToBible(await generateStoryBible(seed), playability);
    const validation = validateStoryBible(bible);

    if (validation.valid && playability.merged.playable) {
      roomManager.setStoryBible(bible);
    }

    return NextResponse.json({
      success: validation.valid && playability.merged.playable,
      story_bible: bible,
      validation,
      playability,
      error: validation.valid && playability.merged.playable
        ? undefined
        : "故事暂未达到可开局标准，请根据可玩性建议补充设定。",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

function normalizeStorySeed(body: Record<string, unknown>): StorySeed {
  const storyIdea = stringValue(body.story_idea || body.seed || body.idea || body.prompt);
  const genreInput = stringValue(body.genre);
  const openingInput = stringValue(body.opening);
  const endingInput = stringValue(body.ending);
  const charactersInput = cleanCharactersInput(stringValue(body.characters));
  const characterDetailsInput = stringValue(body.character_details);
  const worldSettingInput = stringValue(body.world_setting);
  const fullText = [
    storyIdea,
    genreInput,
    openingInput,
    endingInput,
    charactersInput,
    characterDetailsInput,
    worldSettingInput,
  ].filter(Boolean).join("\n");

  return {
    genre: normalizeGenre(genreInput, fullText),
    opening: openingInput || storyIdea,
    ending: endingInput,
    characters: charactersInput || extractCharacters(storyIdea),
    character_details: characterDetailsInput,
    world_setting: worldSettingInput || storyIdea,
    source_type: "manual",
  };
}

function normalizeGenre(input: string, text: string): string {
  const inferred = inferGenre(text);
  if (!input || input === "西幻") return inferred;
  return input;
}

function inferGenre(text: string): string {
  if (/校园|高中|大学|学生会|社团|同桌|青梅竹马|青春|校草|校花/.test(text) && /言情|恋爱|攻略|暗恋|告白|表白|暧昧|心动/.test(text)) {
    return "校园言情";
  }
  if (/搞笑|喜剧|轻喜剧|整活|沙雕|爆笑|乌龙|吐槽/.test(text)) return "搞笑";
  if (/言情|恋爱|爱情|攻略|暗恋|告白|表白|暧昧|复合/.test(text)) return "恋爱";
  if (/推理|侦探|案件|线索|嫌疑|密室|破案|悬疑/.test(text)) return "推理";
  if (/恐怖|怪谈|灵异|惊悚|诡异|逃生/.test(text)) return "恐怖";
  if (/职场|公司|同事|老板|客户|项目|办公室/.test(text)) return "职场";
  if (/权谋|王国|王室|贵族|宫廷|帝国|继承|政变/.test(text)) return "权谋";
  if (/武侠|江湖|门派|朝廷|侠客|帮派/.test(text)) return "武侠";
  if (/科幻|星际|空间站|飞船|赛博|机器人/.test(text)) return "科幻";
  if (/西幻|奇幻|魔法|骑士|王子|圣女|刺客|圣杯/.test(text)) return "西幻";
  return "通用互动故事";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanCharactersInput(input: string): string {
  return input
    .split(/[\n；;]+/)
    .map((line) => line.trim())
    .filter((line) => line && !/(公开目标|秘密目标|人物性格|性格|关系冲突|冲突|目标是|秘密是|公开目的|秘密目的)/.test(line))
    .join("，")
    .split(/[，,、/]+/)
    .map((name) => name.trim().replace(/^(人物|角色)\s*[：:]/, ""))
    .filter((name) => name && name.length <= 12 && !/(目标|秘密|冲突|关系|性格)/.test(name))
    .slice(0, 8)
    .join("，");
}

function extractCharacters(text: string): string {
  const match = text.match(/(?:角色|人物|玩家角色)\s*[：:]\s*([^。\n\r；;]+)/);
  if (!match) return "";
  return match[1]
    .split(/[，,、\/\s]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join("，");
}
