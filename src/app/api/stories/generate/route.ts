import { NextRequest, NextResponse } from "next/server";
import { generateStoryBible } from "@/engine/storyBibleGenerator";
import { validateStoryBible } from "@/engine/storyBibleValidator";
import { analyzeStoryPlayability, applyPlayabilityToBible } from "@/engine/storyPlayabilityAnalyzer";
import { extractFullTextRoleNames, parseFullTextScript } from "@/engine/fullTextScriptParser";
import { roomManager } from "@/lib/roomManager";
import type { StorySeed } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seed = normalizeStorySeed(body);
    const isFullTextImport = Boolean(seed.full_text && seed.full_text.length > 200);

    const playability = await analyzeStoryPlayability(seed);
    const bible = applyPlayabilityToBible(await generateStoryBible(seed), playability);
    const validation = validateStoryBible(bible);
    const canUseStory = validation.valid && (playability.merged.playable || isFullTextImport);

    if (canUseStory) {
      roomManager.setStoryBible(bible);
    }

    return NextResponse.json({
      success: canUseStory,
      story_bible: bible,
      validation,
      playability,
      error: canUseStory ? undefined : "故事暂未达到可开局标准，请根据可玩性建议补充设定。",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

function normalizeStorySeed(body: Record<string, unknown>): StorySeed {
  const fullScriptText = stringValue(body.full_script_text || body.script_text || body.full_text);
  const storyIdea = stringValue(body.story_idea || body.seed || body.idea || body.prompt);
  const parsedScript = parseFullTextScript(fullScriptText || storyIdea);
  const genreInput = stringValue(body.genre);
  const openingInput = stringValue(body.opening);
  const endingInput = stringValue(body.ending);
  const charactersInput = stringValue(body.characters);
  const worldSettingInput = stringValue(body.world_setting);
  const fullTextRoleNames = extractFullTextRoleNames(fullScriptText || storyIdea).join("，");
  const fullText = [
    fullScriptText,
    storyIdea,
    genreInput,
    openingInput,
    endingInput,
    charactersInput,
    worldSettingInput,
  ].filter(Boolean).join("\n");

  return {
    genre: normalizeGenre(genreInput || parsedScript.seed.genre || "", fullText),
    opening: openingInput || parsedScript.seed.opening || storyIdea,
    ending: endingInput || parsedScript.seed.ending || "",
    characters: charactersInput || parsedScript.seed.characters || fullTextRoleNames || extractCharacters(storyIdea),
    world_setting: worldSettingInput || parsedScript.seed.world_setting || storyIdea,
    source_type: "manual",
    full_text: fullScriptText || parsedScript.seed.full_text,
  };
}

function normalizeGenre(input: string, text: string): string {
  const inferred = inferGenre(text);
  if (!input || input === "西幻") return inferred;
  return input;
}

function inferGenre(text: string): string {
  if (/校园|高中|大学|学生会|社团|同桌|青梅竹马|青春|校草|校花/.test(text) && /言情|恋爱|暗恋|告白|表白|暧昧|心动/.test(text)) {
    return "校园言情";
  }
  if (/赛博|科幻|星际|空间站|飞船|AI|人工智能|机器人|系统|数据|全息|记忆|未来/.test(text)) return "科幻";
  if (/战争|军团|战线|指挥|补给|战役|士气/.test(text)) return "战争";
  if (/西幻|奇幻|魔法|骑士|王子|圣女|刺客|圣杯|王国|法师/.test(text)) return "西幻";
  if (/权谋|王国|王室|贵族|宫廷|帝国|继承|政变|议会/.test(text)) return "权谋";
  if (/群像言情|言情|恋爱|爱情|暗恋|告白|表白|暧昧|复合|心动|爱意/.test(text)) return "群像言情";
  if (/关系|羁绊|和解|友情|亲情|同伴|误会/.test(text)) return "关系";
  if (/推理|侦探|案件|线索|嫌疑|密室|破案|悬疑/.test(text)) return "推理";
  if (/恐怖|怪谈|灵异|惊悚|诡异|逃生/.test(text)) return "恐怖";
  if (/职场|公司|同事|老板|客户|项目|办公室/.test(text)) return "职场";
  if (/搞笑|喜剧|轻喜剧|整活|沙雕|爆笑|乌龙|吐槽/.test(text)) return "搞笑";
  if (/武侠|江湖|门派|朝廷|侠客|帮派/.test(text)) return "武侠";
  return "通用群像故事";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractCharacters(text: string): string {
  const match = text.match(/(?:角色|人物|玩家角色)\s*[:：]\s*([^\n\r]+)/);
  if (!match) return "";
  return match[1]
    .split(/[，、,/\s]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join("，");
}
