"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

interface EndingData {
  ending: {
    id: string;
    title: string;
    description: string;
  } | null;
  all_endings_status: {
    ending_id: string;
    title: string;
    conditions_met: number;
    total_conditions: number;
    progress: number;
  }[];
  victory_settlement?: {
    player_id: string;
    player_name?: string;
    role_id: string | null;
    role_name?: string;
    faction_id?: string;
    faction_name?: string;
    faction_victory: boolean;
    personal_victory: boolean;
    life_status: string;
    notes: string[];
  }[];
  ending_narrative: string;
  ending_recap?: {
    truth: {
      title: string;
      content: string;
      source: string;
    }[];
    chronicle: {
      turn: number;
      title: string;
      description: string;
      trigger_reason: string;
    }[];
    player_actions: {
      id: string;
      turn: number;
      actor_id: string;
      actor_display_name: string;
      actor_type: "human_player" | "ai_player_role" | "npc";
      action_type: string;
      action_label: string;
      target_display_name: string;
      method: string;
      intent: string;
      risk_level: "low" | "medium" | "high";
      success: boolean;
      public_result: string;
      raw_input?: string;
    }[];
    gm_reviews: {
      player_id: string;
      display_name: string;
      kind: "human_player" | "ai_player_role";
      score: number;
      highlights: string[];
      gm_comment: string;
    }[];
    mvp: {
      player_id: string;
      display_name: string;
      kind: "human_player" | "ai_player_role";
      score: number;
      gm_comment: string;
    } | null;
  };
}

export default function EndingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const endingId = searchParams.get("ending_id");

  const [data, setData] = useState<EndingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnding = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/endings/check`, {
          method: "POST",
        });
        const result = await res.json();
        if (result.success) {
          setData(result);
        }
      } catch {
        // Keep page functional
      } finally {
        setLoading(false);
      }
    };

    fetchEnding();
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-14 h-14 rounded-full border-2 border-amber-600/20 border-t-amber-400 animate-spin" />
        <p className="text-parchment-400 text-lg">命运之线正在编织...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-700/30 bg-amber-900/20 text-amber-400 text-xs mb-6 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          故事终章
        </div>
        <h1 className="font-fantasy text-4xl text-amber-300 mb-3 text-shadow-glow">
          {data?.ending?.title || "故事结束"}
        </h1>
        <p className="text-parchment-500 text-lg max-w-lg mx-auto">
          {data?.ending?.description || "命运之线已经编织完毕..."}
        </p>
        <div className="divider-ornament max-w-sm mx-auto" />
      </div>

      {/* Ending Narrative */}
      {data?.ending_narrative && (
        <div className="panel-immerse mb-10">
          <div className="prose prose-invert max-w-none text-parchment-200 leading-relaxed whitespace-pre-wrap text-base">
            {sanitizeSettlementText(data.ending_narrative)}
          </div>
        </div>
      )}

      {/* Recap Sections */}
      {data?.ending_recap && (
        <div className="space-y-6 mb-10">
          {/* MVP */}
          {data.ending_recap.mvp && (
            <div className="panel-glow border-amber-500/30 animate-in">
              <div className="flex items-center gap-2 mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="text-xs text-amber-500 uppercase tracking-widest">MVP</span>
              </div>
              <h3 className="font-fantasy text-2xl text-amber-300 mb-2">
                {sanitizeSettlementText(data.ending_recap.mvp.display_name)}
              </h3>
              <p className="text-sm text-amber-600/80 mb-3">贡献分：{data.ending_recap.mvp.score}</p>
              <p className="text-parchant-300 leading-relaxed">
                {sanitizeSettlementText(data.ending_recap.mvp.gm_comment)}
              </p>
            </div>
          )}

          {/* Truth */}
          {data.ending_recap.truth.length > 0 && (
            <div className="panel animate-in stagger-1">
              <h3 className="font-fantasy text-amber-400 mb-5 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-500"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                事件真相公开
              </h3>
              <div className="space-y-4">
                {data.ending_recap.truth.map((item, index) => (
                  <div key={`${item.title}_${index}`} className="border-l-2 border-amber-600/40 pl-4 py-1">
                    <p className="text-parchant-100 font-medium mb-1">{sanitizeSettlementText(item.title)}</p>
                    <p className="text-sm text-parchant-400 leading-relaxed whitespace-pre-wrap">
                      {sanitizeSettlementText(item.content)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronicle */}
          {data.ending_recap.chronicle.length > 0 && (
            <div className="panel animate-in stagger-2">
              <h3 className="font-fantasy text-amber-400 mb-5 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-500"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
                事件编年史
              </h3>
              <div className="space-y-3">
                {data.ending_recap.chronicle.map((item, index) => (
                  <div key={`${item.title}_${index}`} className="glass p-4">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="badge-amber text-xs">第 {item.turn} 回合</span>
                      <span className="text-parchant-100 font-medium">{sanitizeSettlementText(item.title)}</span>
                    </div>
                    <p className="text-sm text-parchant-400 leading-relaxed">{sanitizeSettlementText(item.description)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Player Actions */}
          {data.ending_recap.player_actions.length > 0 && (
            <div className="panel animate-in stagger-3">
              <h3 className="font-fantasy text-amber-400 mb-5 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-500"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                所有行动记录
              </h3>
              <div className="space-y-3">
                {data.ending_recap.player_actions.map((action) => (
                  <div key={action.id} className="glass p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-parchant-100 font-medium text-sm">
                        第 {action.turn} 回合 &middot; {sanitizeSettlementText(action.actor_display_name)}
                      </span>
                      <span className={`badge ${action.success ? "badge-emerald" : "badge-rose"}`}>
                        {action.success ? "成功" : "失败"} &middot; {sanitizeSettlementText(action.action_label)}
                      </span>
                    </div>
                    <p className="text-sm text-parchant-400 mb-1">
                      目标：{sanitizeSettlementText(action.target_display_name || "未知")}；意图：{sanitizeSettlementText(action.intent)}
                    </p>
                    <p className="text-sm text-parchant-300">{sanitizeSettlementText(action.public_result)}</p>
                    {action.raw_input && (
                      <p className="text-xs text-parchant-600 mt-1">原始输入：{sanitizeSettlementText(action.raw_input)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GM Reviews */}
          {data.ending_recap.gm_reviews.length > 0 && (
            <div className="panel animate-in stagger-4">
              <h3 className="font-fantasy text-amber-400 mb-5 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-500"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                GM 玩家点评
              </h3>
              <div className="space-y-3">
                {data.ending_recap.gm_reviews.map((review) => (
                  <div key={review.player_id} className="glass p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-parchant-100 font-medium">{sanitizeSettlementText(review.display_name)}</span>
                      <span className="badge-amber">贡献分 {review.score}</span>
                    </div>
                    <p className="text-sm text-parchant-300 leading-relaxed">{sanitizeSettlementText(review.gm_comment)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Victory Settlement */}
      {data?.victory_settlement && data.victory_settlement.length > 0 && (
        <div className="panel-glow mb-10 animate-in stagger-5">
          <h3 className="font-fantasy text-amber-400 mb-5">胜利结算</h3>
          <div className="space-y-3">
            {data.victory_settlement.map((item) => (
              <div key={item.player_id} className="glass p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-parchant-200 font-medium">{settlementDisplayName(item)}</span>
                  <span className="badge-blue">{lifeStatusLabel(item.life_status)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className={`flex items-center gap-2 ${item.faction_victory ? "text-emerald-300" : "text-parchant-500"}`}>
                    <span className={`w-2 h-2 rounded-full ${item.faction_victory ? "bg-emerald-400" : "bg-midnight-600"}`} />
                    阵营胜利：{item.faction_victory ? "是" : "否"}
                  </div>
                  <div className={`flex items-center gap-2 ${item.personal_victory ? "text-emerald-300" : "text-parchant-500"}`}>
                    <span className={`w-2 h-2 rounded-full ${item.personal_victory ? "bg-emerald-400" : "bg-midnight-600"}`} />
                    个人胜利：{item.personal_victory ? "是" : "否"}
                  </div>
                </div>
                {item.notes.length > 0 && (
                  <p className="text-xs text-parchant-500 mt-3">{item.notes.map(sanitizeSettlementText).join("；")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Endings Status */}
      {data?.all_endings_status && data.all_endings_status.length > 0 && (
        <div className="panel mb-10 animate-in stagger-6">
          <h3 className="font-fantasy text-amber-400 mb-5">所有可能结局</h3>
          <div className="space-y-3">
            {data.all_endings_status.map((es) => {
              const isAchieved = es.ending_id === endingId;
              return (
                <div
                  key={es.ending_id}
                  className={`rounded-xl border p-4 transition-all ${
                    isAchieved
                      ? "border-amber-600/50 bg-amber-950/15 shadow-lg shadow-amber-500/5"
                      : "border-midnight-700/40 bg-midnight-800/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`font-medium ${
                      isAchieved ? "text-amber-300" : "text-parchant-400"
                    }`}>
                      {sanitizeSettlementText(es.title)}
                      {isAchieved && (
                        <span className="badge-amber ml-2">已达成</span>
                      )}
                    </span>
                    <span className="text-xs text-parchant-600">
                      {es.conditions_met}/{es.total_conditions} 条件
                    </span>
                  </div>
                  <div className="w-full bg-midnight-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${
                        isAchieved ? "bg-amber-500" : "bg-midnight-600"
                      }`}
                      style={{ width: `${es.progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pb-12">
        <button onClick={() => router.push("/")} className="btn-primary px-8 py-3">
          返回首页
        </button>
        <button onClick={() => router.push("/generate")} className="btn-secondary px-8 py-3">
          创建新故事
        </button>
      </div>
    </div>
  );
}

function lifeStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    alive: "存活", dead: "死亡", missing: "失踪",
    imprisoned: "囚禁", defeated: "受挫", setback: "受挫",
  };
  return labels[status] || sanitizeSettlementText(status);
}

function settlementDisplayName(item: {
  player_id: string;
  player_name?: string;
  role_id: string | null;
  role_name?: string;
}): string {
  if (item.role_name) return sanitizeSettlementText(item.role_name);
  if (item.player_name) return sanitizeSettlementText(item.player_name);

  const roleNames: Record<string, string> = {
    role_1: "王子", role_2: "圣女", role_3: "刺客", role_4: "骑士",
  };

  if (item.role_id && roleNames[item.role_id]) return roleNames[item.role_id];
  if (item.role_id) return sanitizeSettlementText(item.role_id);
  return "未知角色";
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  investigate: "调查", search: "搜索", track: "追踪", eavesdrop: "偷听",
  interrogate: "盘问", decode: "解读", talk: "交谈", persuade: "说服",
  threaten: "威胁", deceive: "欺骗", ally: "结盟", betray: "背叛",
  confess: "坦白", command: "下令", summon_meeting: "召集会议",
  gain_support: "争取支持", coup: "夺权", impeach: "弹劾", appoint: "任命",
  attack: "攻击", assassinate: "刺杀", duel: "决斗", ambush: "伏击",
  defend: "防守", buy: "收买", trade: "交易", steal: "偷取",
  transport: "转移", build: "建造", spy: "暗中观察", divination: "占卜",
  execute: "处决", sacrifice: "献祭",
  gather_intelligence: "收集情报", mislead_player: "误导玩家",
  hide_evidence: "隐藏证据", frame_player: "陷害", manipulate_metric: "操纵局势",
  influence_npc: "影响NPC", protect_secret: "保护秘密", accelerate_plan: "加速计划",
  obstruct_investigation: "阻挠调查", fabricate_false_evidence: "伪造证据",
};

const INTENT_LABELS: Record<string, string> = {
  find_clues: "寻找线索", gather_information: "收集信息",
  eavesdrop: "偷听情报", infiltrate: "潜入探查",
  communicate: "交流沟通", persuade: "说服对方", threaten: "施加威胁",
  gain_information: "获取信息", force_confrontation: "正面对峙",
  create_comic_setback: "制造麻烦", assassinate: "刺杀目标",
  find_truth: "探寻真相", protect_ally: "保护同伴",
  expose_secret: "揭露秘密", hide_secret: "隐藏秘密",
  gain_power: "夺取权力", sabotage: "暗中破坏",
  steal_evidence: "偷取证据", mislead: "误导他人",
  form_alliance: "缔结同盟", break_alliance: "撕毁盟约",
  confess_truth: "坦白真相", spread_rumor: "散播谣言",
  investigate_location: "调查地点", interrogate_npc: "盘问人物",
  track_target: "追踪目标", search_area: "搜索区域",
  decode_message: "解读信息",
};

const TARGET_LABELS: Record<string, string> = {
  current_location: "当前位置", connected_location: "相邻地点",
  current_event: "当前事件", self_goal: "个人目标",
  all_players: "所有玩家", all: "所有人", unknown: "未知",
  informed_npc: "知情者", witness: "证人",
  temple: "圣殿", temple_altar: "圣坛",
  cathedral_basement: "教堂地下室", underground_altar: "地下祭坛",
  throne_room: "王座大厅", royal_library: "皇家图书馆",
  city_streets: "王城街道", tavern: "乌鸦酒馆",
  surroundings: "周围环境", archive: "档案室",
  research_lab: "研究室", command_deck: "指挥甲板",
  meeting_place: "会面地点", quiet_corner: "安静角落",
  npc_archmage: "大法师", npc_old_king: "老国王", npc_bishop: "主教",
  archmage: "大法师", old_king: "老国王", bishop: "主教",
  guard: "守卫", classroom: "教室", library: "图书馆",
  student_council_room: "学生会室", club_room: "社团室",
  sports_field: "操场", cafeteria: "食堂", corridor: "走廊",
  workstation: "工作站", client_site: "委托人所在地",
};

const METRIC_LABELS: Record<string, string> = {
  situation_stability: "局势稳定度", political_stability: "政治稳定度",
  truth_progress: "真相进度", faction_power: "势力值",
  supernatural_pressure: "超自然压力", suspicion: "怀疑度",
  trust: "信任度", evidence_count: "证据数量",
  relationship_trust: "关系信任度", investigation_progress: "调查进度",
  conflict_level: "冲突等级", secret_exposure: "秘密暴露度",
};

const METHOD_LABELS: Record<string, string> = {
  direct: "直接行动", stealth: "隐秘行动", diplomacy: "外交手段",
  intimidation: "威胁恐吓", bribery: "收买贿赂", conversation: "对话交流",
  examine: "仔细检查", search: "搜索", stealth_disguise: "伪装潜入",
  comic_escalation: "闹剧升级", genre_safe_conflict: "象征冲突",
  investigate: "调查", talk: "交谈",
};

function sanitizeSettlementText(text: string | undefined): string {
  let output = String(text || "");

  // Simple regex replacements (string → string)
  const simpleReplacements: Array<[RegExp, string]> = [
    [/\brole_1\b/g, "王子"],
    [/\brole_2\b/g, "圣女"],
    [/\brole_3\b/g, "刺客"],
    [/\brole_4\b/g, "骑士"],
    [/\brole_\d+\b/g, "角色"],
    [/\bplayer[\s_-]?\d+\b/gi, "玩家"],
    [/\bnpc_archmage\b/gi, "大法师"],
    [/\bnpc_old_king\b/gi, "老国王"],
    [/\bnpc_bishop\b/gi, "主教"],
    [/\bevt_([a-z0-9_]+)\b/gi, "相关事件"],
    [/\bevent_([a-z0-9_]+)\b/gi, "相关事件"],
    [/\bending_([a-z0-9_]+)\b/gi, "相关结局"],
    [/\b[a-z]+(?:_[a-z0-9]+){2,}\b/gi, "相关条目"],
  ];

  for (const [pattern, replacement] of simpleReplacements) {
    output = output.replace(pattern, replacement);
  }

  // Function-based replacements for NPC and Location IDs
  output = output.replace(/\bnpc_([a-z0-9_]+)\b/gi, (_m, id: string) => {
    const key = `npc_${id.toLowerCase()}`;
    return TARGET_LABELS[key] || `NPC:${id.replace(/_/g, " ")}`;
  });

  output = output.replace(/\blocation_([a-z0-9_]+)\b/gi, (_m, id: string) => {
    return formatLocationId(id);
  });

  // Apply label dictionaries for standalone action types, intents, targets, methods
  // that appear as full words in the text
  for (const [key, label] of Object.entries(ACTION_TYPE_LABELS)) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, "gi"), label);
  }

  for (const [key, label] of Object.entries(INTENT_LABELS)) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, "gi"), label);
  }

  for (const [key, label] of Object.entries(TARGET_LABELS)) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, "gi"), label);
  }

  for (const [key, label] of Object.entries(METRIC_LABELS)) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, "gi"), label);
  }

  for (const [key, label] of Object.entries(METHOD_LABELS)) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(key)}\\b`, "gi"), label);
  }

  // Capitalized single words that look like untranslated English IDs (e.g., "Workstation", "Client Site")
  output = output.replace(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g, (match: string) => {
    const lower = match.toLowerCase().replace(/\s+/g, "_");
    return TARGET_LABELS[lower] || match;
  });

  return output;
}

function formatLocationId(id: string): string {
  const lower = id.toLowerCase();
  return TARGET_LABELS[lower] || id.replace(/_/g, " ");
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
