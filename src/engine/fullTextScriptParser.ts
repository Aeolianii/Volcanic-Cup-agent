import type { StorySeed } from "@/types";

export interface FullTextScriptParseResult {
  seed: Partial<StorySeed>;
  characters: ParsedScriptCharacter[];
  endings: string[];
  factions: string[];
  confidence: number;
}

export interface ParsedScriptCharacter {
  name: string;
  gender?: string;
  age?: string;
  public_identity?: string;
  raw: string;
}

const SECTION_TITLES = [
  "剧本基础信息",
  "世界观设定",
  "世界观",
  "背景设定",
  "故事背景",
  "五人角色人设",
  "角色人设",
  "人物介绍",
  "角色介绍",
  "玩家角色",
  "完整人物羁绊",
  "核心真相",
  "故事开篇",
  "主持人开场词",
  "开本流程",
  "流程",
  "四大群像结局",
  "群像结局",
  "结局设定",
  "多结局",
  "结局",
];

export function parseFullTextScript(input: string): FullTextScriptParseResult {
  const text = normalizeText(input);
  if (!text) return { seed: {}, characters: [], endings: [], factions: [], confidence: 0 };

  const title = extractTitle(text);
  const world = extractSection(text, ["世界观设定", "世界观", "背景设定", "故事背景"]);
  const opening = extractSection(text, ["故事开篇", "主持人开场词", "开场", "故事开场"]);
  const truth = extractSection(text, ["完整人物羁绊", "核心真相", "真相", "人物羁绊"]);
  const roleBlock = extractSection(text, ["五人角色人设", "角色人设", "人物介绍", "角色介绍", "玩家角色"]);
  const endingBlock = extractSection(text, ["四大群像结局", "群像结局", "结局设定", "多结局", "结局"]);

  const characters = parseCharacters(roleBlock || text);
  const endings = parseEndings(endingBlock || text);
  const factions = inferFactions(text, characters);

  const seed: Partial<StorySeed> = {
    genre: inferGenre(text),
    opening: compact(opening) || extractOpeningFallback(text),
    ending: endings.length > 0 ? endings.join("；") : compact(endingBlock || truth),
    characters: characters.map((character) => character.name).join("；"),
    world_setting: compact([title, world].filter(Boolean).join("\n\n")) || compact(text.slice(0, 900)),
    full_text: text,
    source_type: "manual",
  };

  return {
    seed,
    characters,
    endings,
    factions,
    confidence: scoreParse(text, characters, endings, world || truth),
  };
}

export function extractFullTextRoleNames(input: string): string[] {
  return parseCharacters(normalizeText(input)).map((character) => character.name);
}

function normalizeText(input: string): string {
  return String(input || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[【]/g, "[")
    .replace(/[】]/g, "]")
    .replace(/[｜]/g, "|")
    .replace(/\u00a0/g, " ")
    .trim();
}

function extractTitle(text: string): string {
  const scriptName = text.match(/剧本名\s*[:：]\s*([^\n]+)/);
  if (scriptName) return scriptName[1].trim();
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine && firstLine.length <= 50 ? firstLine.replace(/^\[|\]$/g, "") : "";
}

function extractSection(text: string, names: string[]): string {
  const titlePattern = names.map(escapeRegExp).join("|");
  const nextTitlePattern = SECTION_TITLES.map(escapeRegExp).join("|");
  const pattern = new RegExp(
    `(?:^|\\n)\\s*\\[\\s*(?:${titlePattern})(?:[^\\]]*)\\]\\s*\\n?([\\s\\S]*?)(?=\\n\\s*\\[\\s*(?:${nextTitlePattern})(?:[^\\]]*)\\]|$)`,
    "i"
  );
  return compact(text.match(pattern)?.[1] || "");
}

function parseCharacters(text: string): ParsedScriptCharacter[] {
  const lines = text.split("\n");
  const characters: ParsedScriptCharacter[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const match = line.match(/^(男|女)\s*([0-9一二三四五六七八九十]+)\s*\|\s*([^|\n]+?)\s*\|\s*(.+)$/);
    if (!match) continue;

    const [, gender, , nameAgeText, identityText] = match;
    const age = nameAgeText.match(/\d{1,3}\s*岁/)?.[0];
    const name = nameAgeText.replace(/\d{1,3}\s*岁.*/, "").trim();
    if (!name || /^(人数|题材|时长|特色|世界观|流程|结局)$/.test(name)) continue;

    const detailLines: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextLine = lines[next].trim();
      if (!nextLine) continue;
      if (/^(男|女)\s*[0-9一二三四五六七八九十]+\s*\|/.test(nextLine)) break;
      if (/^\[.+\]$/.test(nextLine)) break;
      detailLines.push(nextLine);
    }

    const publicIdentity = compact([age, identityText.trim()].filter(Boolean).join(" | "));
    const raw = compact([line, ...detailLines].join("\n"));
    characters.push({ name, gender, age, public_identity: publicIdentity, raw });
  }

  return dedupeByName(characters).slice(0, 8);
}

function extractOpeningFallback(text: string): string {
  const systemNotice = text.match(/(?:光屏|系统公告|公告)[：:]?\s*([^\n]{20,260})/);
  if (systemNotice) return compact(systemNotice[1]);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^\[.+\]$/.test(line) && !/^(男|女)\s*[0-9一二三四五六七八九十]+\s*\|/.test(line));
  return compact(lines.slice(0, 5).join("\n")).slice(0, 700);
}

function parseEndings(text: string): string[] {
  const endings: string[] = [];
  const regex = /结局[一二三四五六七八九十0-9]*[：:]\s*([^\n]+)(?:\n([^结]{0,260}))?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    endings.push(compact([match[1], match[2]].filter(Boolean).join(" ")));
  }
  return endings.filter(Boolean).slice(0, 8);
}

function inferFactions(text: string, characters: ParsedScriptCharacter[]): string[] {
  if (/言情|关系|情感|无凶案/.test(text) && !/阵营|势力|王室|刺客|军团|派系/.test(text)) return [];
  const explicit = Array.from(text.matchAll(/(?:阵营|势力|派系|组织)[：:]\s*([^\n]+)/g))
    .flatMap((match) => match[1].split(/[、，,；;]/))
    .map((item) => compact(item))
    .filter(Boolean);
  if (explicit.length > 0) return Array.from(new Set(explicit)).slice(0, 6);
  if (/王室|刺客|教会|法师|军团|议会|贵族|反抗军/.test(text)) {
    return ["公开秩序方", "隐秘行动方", "观望中立方"];
  }
  return characters.length >= 5 && /权谋|战争|西幻|政治/.test(text)
    ? ["秩序维护方", "破局行动方"]
    : [];
}

function inferGenre(text: string): string {
  if (/战争|军团|战线|补给|战役|指挥|士气/.test(text)) return "战争";
  if (/权谋|宫廷|王室|议会|继承|政变|贵族|派系/.test(text)) return "权谋";
  if (/西幻|奇幻|魔法|王国|圣杯|神器|骑士|法师|古神|龙/.test(text)) return "西幻";
  if (/悬疑|推理|凶案|线索|证据|嫌疑|密室|侦探|解密|探险/.test(text) && !/无凶案|无案件|无推理/.test(text)) return "悬疑";
  if (/赛博|科幻|AI|人工智能|全息|系统|数据|记忆|未来都市|2047/.test(text)) return "科幻";
  if (/言情|心动|爱意|恋人|暗恋|奔赴真心|虚妄|情感抉择/.test(text)) return "群像言情";
  if (/关系|羁绊|误会|和解|友情|亲情|同伴/.test(text)) return "关系";
  return "通用群像故事";
}

function scoreParse(text: string, characters: ParsedScriptCharacter[], endings: string[], worldOrTruth: string): number {
  let score = 20;
  if (extractTitle(text)) score += 10;
  if (characters.length >= 3) score += 25;
  if (characters.length >= 5) score += 10;
  if (worldOrTruth.length > 80) score += 15;
  if (endings.length >= 2) score += 15;
  if (extractOpeningFallback(text).length > 50) score += 5;
  return Math.min(100, score);
}

function dedupeByName(characters: ParsedScriptCharacter[]): ParsedScriptCharacter[] {
  const seen = new Set<string>();
  return characters.filter((character) => {
    if (seen.has(character.name)) return false;
    seen.add(character.name);
    return true;
  });
}

function compact(text: string): string {
  return String(text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
