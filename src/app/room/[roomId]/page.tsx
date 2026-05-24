"use client";

import { useState, useEffect, useCallback, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import { UIBuilder } from "@/components/ui/UIBuilder";
import { gameReducer, initialGameState, GameContext } from "@/lib/gameStore";
import type { Room, WorldState, PlayerView, ChatMessage, SuggestedAction } from "@/types";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [playerId] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("player_id") || `player_${Date.now()}`
      : `player_${Date.now()}`
  );
  const [playerName] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("player_name") || "冒险者"
      : "冒险者"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [llmBaseUrl, setLlmBaseUrl] = useState(() => typeof window !== "undefined" ? localStorage.getItem("llm_base_url") || "" : "");
  const [llmModel, setLlmModel] = useState(() => typeof window !== "undefined" ? localStorage.getItem("llm_model") || "" : "");
  const [llmApiKey, setLlmApiKey] = useState(() => typeof window !== "undefined" ? localStorage.getItem("llm_api_key") || "" : "");

  const llmHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (llmBaseUrl.trim()) headers["x-llm-base-url"] = llmBaseUrl.trim();
    if (llmModel.trim()) headers["x-llm-model"] = llmModel.trim();
    if (llmApiKey.trim()) headers["x-llm-api-key"] = llmApiKey.trim();
    return headers;
  }, [llmBaseUrl, llmModel, llmApiKey]);

  // Initialize: fetch room state
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/state`);
        const data = await res.json();

        if (!data.success) {
          setError(data.error || "房间不存在");
          setLoading(false);
          return;
        }

        const room: Room = data.room;
        if (data.story_bible) {
          dispatch({ type: "SET_STORY_BIBLE", bible: data.story_bible });
        }

        // If player not in room, try to join
        if (!room.players.some((p: { player_id: string }) => p.player_id === playerId)) {
          const joinRes = await fetch(`/api/rooms/${roomId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ player_id: playerId, player_name: playerName }),
          });
          const joinData = await joinRes.json();
          if (joinData.success) {
            dispatch({ type: "SET_ROOM", room: joinData.room });
          } else {
            setError("加入房间失败");
            setLoading(false);
            return;
          }
        } else {
          dispatch({ type: "SET_ROOM", room });
        }

        if (data.world_state) {
          dispatch({ type: "SET_WORLD_STATE", state: data.world_state });
          dispatch({ type: "SET_PHASE", phase: "playing" });
        }

        dispatch({ type: "SET_CURRENT_PLAYER", playerId });
        setLoading(false);
      } catch {
        setError("网络错误");
        setLoading(false);
      }
    };

    init();
    localStorage.setItem("player_id", playerId);
  }, [roomId, playerId, playerName]);

  // Select Role
  const handleSelectRole = async (roleId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/select-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, role_id: roleId }),
      });
      const data = await res.json();
      if (data.success) {
        dispatch({ type: "SET_ROOM", room: data.room });
      }
    } catch {
      setError("选择角色失败");
    }
  };

  // Start Story
  const handleStartStory = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        dispatch({ type: "SET_ROOM", room: data.room });
        if (data.world_state) {
          dispatch({ type: "SET_WORLD_STATE", state: data.world_state });
        }
        dispatch({ type: "SET_PHASE", phase: "playing" });

        // Fetch initial player view
        await refreshPlayerView();
      }
    } catch {
      setError("开始故事失败");
    }
  };

  // Refresh player view
  const refreshPlayerView = async (suggestedActionsOverride?: SuggestedAction[]) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/players/${playerId}/view`, { headers: llmHeaders() });
      const data = await res.json();
      if (data.success) {
        dispatch({
          type: "SET_PLAYER_VIEW",
          view: suggestedActionsOverride
            ? { ...data.player_view, suggested_actions: suggestedActionsOverride }
            : data.player_view,
        });
        // Add GM opening narration if first view
        if (state.chatMessages.length === 0) {
          const openingContent =
            data.gm_narrative?.narration || data.player_view?.active_events?.[0]?.description || "";
          if (openingContent) {
            dispatch({
              type: "ADD_CHAT_MESSAGE",
              message: {
                id: `msg_gm_init_${Date.now()}`,
                room_id: roomId,
                sender_id: "gm",
                sender_type: "gm",
                sender_name: "GM",
                content: openingContent,
                timestamp: new Date().toISOString(),
                channel_id: "public",
                channel_type: "public",
                highlighted: true,
              },
            });
          }
        }
      }
    } catch {
      // Silently fail - will retry
    }
  };

  const replaceSuggestedActions = useCallback((actions: SuggestedAction[]) => {
    if (!state.playerView) return;
    dispatch({
      type: "SET_PLAYER_VIEW",
      view: { ...state.playerView, suggested_actions: actions },
    });
  }, [state.playerView]);

  // Send chat message
  const handleSendMessage = useCallback(
    async (content: string, channelId = "public") => {
      const tempMsg: ChatMessage = {
        id: `msg_temp_${Date.now()}`,
        room_id: roomId,
        sender_id: playerId,
        sender_type: "player",
        sender_name: playerName,
        content,
        timestamp: new Date().toISOString(),
        channel_id: channelId,
        channel_type: channelId.startsWith("faction:") ? "faction" : channelId.startsWith("pm:") ? "private" : "public",
      };
      dispatch({ type: "ADD_CHAT_MESSAGE", message: tempMsg });

      try {
        const res = await fetch(`/api/rooms/${roomId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...llmHeaders() },
          body: JSON.stringify({ player_id: playerId, content, channel_id: channelId }),
        });
        const data = await res.json();
        if (data.success && data.action_hint) {
          setActionFeedback(data.action_hint.suggestion);
        }
      } catch {
        // Message sent optimistically
      }
    },
    [roomId, playerId, playerName]
  );

  // Send action
  const handleSendAction = useCallback(
    async (actionText: string) => {
      if (actionPending) return;

      const previousActions = state.playerView?.suggested_actions || [];
      setActionPending(true);
      setPendingActionId("free_action");
      setActionFeedback(`已提交行动："${actionText}"。正在解析与结算...`);
      try {
        const res = await fetch(`/api/rooms/${roomId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...llmHeaders() },
          body: JSON.stringify({
            player_id: playerId,
            raw_input: actionText,
            action_source: "free_action",
            current_location: state.playerView?.known_locations?.[0],
          }),
        });
        const data = await res.json();

        if (data.success) {
          setActionFeedback(
            data.rule_result?.public_result
              ? `${data.rule_result.public_result} GM 正在续写下一段...`
              : "行动已结算，GM 正在续写下一段..."
          );

          if (data.gm_message) {
            dispatch({ type: "ADD_CHAT_MESSAGE", message: data.gm_message });
          }

          if (data.world_state) {
            dispatch({ type: "SET_WORLD_STATE", state: data.world_state });
          }
          const nextSuggestedActions = normalizeSuggestedActions(data.suggested_actions);
          replaceSuggestedActions(nextSuggestedActions);

          setActionFeedback("行动已结算，结果已写入 GM 叙事。");

          if (data.ending) {
            dispatch({ type: "SET_PHASE", phase: "ending" });
            router.push(`/ending/${roomId}?ending_id=${data.ending.id}`);
            return;
          }

          await refreshPlayerView(nextSuggestedActions);

          try {
            await fetch(`/api/rooms/${roomId}/npc-turn`, { method: "POST" });
          } catch {
            // NPC turn is optional
          }
        } else {
          replaceSuggestedActions(previousActions);
          setActionFeedback("行动失败：" + (data.error || "未知错误"));
        }
      } catch {
        replaceSuggestedActions(previousActions);
        setActionFeedback("网络错误，行动没有成功提交。");
      } finally {
        setActionPending(false);
        setPendingActionId(null);
      }
    },
    [actionPending, roomId, playerId, state.playerView, replaceSuggestedActions, llmHeaders]
  );

  // Handle suggested action
  const handleSelectSuggestedAction = useCallback(
    async (action: {
      id: string;
      label: string;
      action_type: string;
      target: string;
      method: string;
      intent: string;
      risk_level: "low" | "medium" | "high";
      context: string;
    }) => {
      if (actionPending) return;

      const previousActions = state.playerView?.suggested_actions || [];
      replaceSuggestedActions(previousActions.filter((item) => item.id !== action.id));
      setActionPending(true);
      setPendingActionId(action.id);
      setActionFeedback(`已选择推荐行动："${action.label}"。正在结算...`);
      try {
        const res = await fetch(`/api/rooms/${roomId}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...llmHeaders() },
          body: JSON.stringify({
            player_id: playerId,
            action_source: "suggested_action",
            label: action.label,
            suggestion: {
              action_type: action.action_type,
              target: action.target,
              method: action.method,
              intent: action.intent,
              risk_level: action.risk_level,
            },
          }),
        });
        const data = await res.json();

        if (data.success) {
          setActionFeedback(
            data.rule_result?.public_result
              ? `${data.rule_result.public_result} GM 正在续写下一段...`
              : "行动已结算，GM 正在续写下一段..."
          );

          if (data.gm_message) {
            dispatch({ type: "ADD_CHAT_MESSAGE", message: data.gm_message });
          }
          if (data.world_state) {
            dispatch({ type: "SET_WORLD_STATE", state: data.world_state });
          }
          const nextSuggestedActions = normalizeSuggestedActions(data.suggested_actions);
          replaceSuggestedActions(nextSuggestedActions);
          setActionFeedback("行动已结算，结果已写入 GM 叙事。");

          if (data.ending) {
            dispatch({ type: "SET_PHASE", phase: "ending" });
            router.push(`/ending/${roomId}?ending_id=${data.ending.id}`);
            return;
          }

          await refreshPlayerView(nextSuggestedActions);
        } else {
          replaceSuggestedActions(previousActions);
          setActionFeedback("行动失败：" + (data.error || "未知错误"));
        }
      } catch {
        replaceSuggestedActions(previousActions);
        setActionFeedback("网络错误，行动没有成功提交。");
      } finally {
        setActionPending(false);
        setPendingActionId(null);
      }
    },
    [actionPending, roomId, playerId, state.playerView, replaceSuggestedActions, llmHeaders]
  );

  const handleConvertToAction = useCallback(
    (messageId: string) => {
      const msg = state.chatMessages.find((m) => m.id === messageId);
      if (msg) {
        handleSendAction(msg.content);
      }
    },
    [state.chatMessages, handleSendAction]
  );

  // ---- RENDER ----

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
        <p className="text-parchment-500 text-lg animate-pulse">正在连接房间...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl mb-4">
          !
        </div>
        <p className="text-red-400 text-lg mb-6">{error}</p>
        <button onClick={() => router.push("/")} className="btn-primary">
          返回首页
        </button>
      </div>
    );
  }

  // ---- WAITING ROOM ----
  if (state.phase === "lobby" && state.room) {
    const room = state.room;
    const isOwner = room.owner_id === playerId;
    const currentPlayer = room.players.find((p) => p.player_id === playerId);

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Room Header */}
        <div className="panel text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent rounded-full" />
          <h2 className="font-fantasy text-2xl text-amber-400 mb-3">等待玩家加入</h2>
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-midnight-700/50 border border-midnight-600 mb-3">
            <span className="text-xs text-parchment-500 uppercase tracking-wider">房间号</span>
            <span className="text-3xl font-mono text-amber-300 tracking-[0.3em]">{room.room_id}</span>
          </div>
          <p className="text-parchment-500 text-sm">分享房间号给其他玩家</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`w-2 h-2 rounded-full ${room.status === "waiting" ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
            <span className="text-xs text-parchment-600">
              {room.status === "waiting" ? "等待玩家加入" : "准备开始"}
            </span>
          </div>
        </div>

        {/* Player List */}
        <div className="panel">
          <div className="section-title mb-4">
            玩家 ({room.players.length}/{room.max_players})
          </div>
          <div className="space-y-2">
            {room.players.map((p, i) => (
              <div
                key={p.player_id}
                className="flex items-center justify-between p-3 rounded-lg bg-midnight-700/40 border border-midnight-600/30 animate-fade-in-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400">
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-parchment-200 font-medium">{p.name}</span>
                    {p.is_owner && (
                      <span className="text-amber-500 text-xs ml-2 bg-amber-500/10 px-1.5 py-0.5 rounded-full">房主</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  p.role
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-midnight-600/50 text-parchment-500 border border-midnight-500/30"
                }`}>
                  {p.role ? p.role.name : "未选择角色"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Role Selection */}
        {!currentPlayer?.role && (
          <div className="panel animate-fade-in-up">
            <div className="section-title mb-4">选择角色</div>
            <div className="grid grid-cols-2 gap-3">
              {(room as Room & { available_roles?: { id: string; name: string; public_identity: string }[] }).available_roles?.length
                ? (room as Room & { available_roles: { id: string; name: string; public_identity: string }[] }).available_roles.map((role: { id: string; name: string; public_identity: string }) => (
                    <button
                      key={role.id}
                      onClick={() => handleSelectRole(role.id)}
                      disabled={room.players.some((p: { role_id: string | null }) => p.role_id === role.id)}
                      className="p-4 rounded-xl border border-midnight-600/60 hover:border-amber-500/40 hover:bg-midnight-700/50 text-left disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 group"
                    >
                      <span className="text-parchment-200 font-medium block mb-1 group-hover:text-amber-200 transition-colors">{role.name}</span>
                      <span className="text-xs text-parchment-500">{role.public_identity}</span>
                    </button>
                  ))
                : (
                  <RoleSelector
                    roomId={roomId}
                    onSelect={handleSelectRole}
                    takenRoles={room.players.filter((p: { role_id: string | null }) => p.role_id).map((p: { role_id: string | null }) => p.role_id!)}
                  />
                )}
            </div>
          </div>
        )}

        {/* Start Button */}
        <div className="animate-fade-in-up animate-delay-200">
          {isOwner ? (
            <button
              onClick={handleStartStory}
              disabled={room.players.some((p: { role_id: string | null }) => !p.role_id)}
              className="btn-primary w-full py-3.5 text-lg font-fantasy tracking-wider"
            >
              开始故事
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3 text-parchment-600 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 animate-pulse" />
              等待房主开始故事...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- GAME INTERFACE ----
  if (state.phase === "playing" && state.room) {
    const bible = state.storyBible;
    const widgets = bible?.ui_config.widgets || [
      { key: "NarrativePanel", position: "center" as const, order: 1, visible: true },
      { key: "ChatPanel", position: "bottom" as const, order: 2, visible: true },
      { key: "SuggestedActionsPanel", position: "right" as const, order: 3, visible: true },
      { key: "FreeActionInput", position: "bottom" as const, order: 4, visible: true },
      { key: "RolePanel", position: "left" as const, order: 5, visible: true },
      { key: "MetricPanel", position: "left" as const, order: 6, visible: true },
      { key: "EventPanel", position: "right" as const, order: 7, visible: true },
      { key: "EvidencePanel", position: "left" as const, order: 8, visible: true },
      { key: "PlayerInfoPanel", position: "right" as const, order: 9, visible: true },
    ];

    return (
      <GameContext.Provider value={{ state, dispatch }}>
        <div className="animate-fade-in">
          {actionFeedback && (
            <div className={`mb-5 flex items-start gap-3 rounded-xl p-4 text-sm border backdrop-blur-sm transition-all duration-300 animate-fade-in-down ${
              actionPending
                ? "bg-amber-500/5 border-amber-500/30 text-amber-200"
                : "bg-emerald-500/5 border-emerald-500/30 text-emerald-200"
            }`}>
              <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                actionPending ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
              }`} />
              <span className="flex-1">{actionFeedback}</span>
              <button
                onClick={() => setActionFeedback("")}
                className="text-parchment-500 hover:text-parchment-200 shrink-0 transition-colors"
                disabled={actionPending}
              >
                ✕
              </button>
            </div>
          )}

          <div className="mb-4 rounded-xl border border-midnight-600/50 bg-midnight-800/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-amber-300 font-medium">GM API 设置</div>
                <div className="text-xs text-parchment-500">留空则使用服务器 .env.local 配置；填写后仅保存在当前浏览器。</div>
              </div>
              <button
                type="button"
                onClick={() => setShowAIConfig((value) => !value)}
                className="text-xs px-3 py-1.5 rounded-full border border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              >
                {showAIConfig ? "收起" : "配置"}
              </button>
            </div>
            {showAIConfig && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_180px_1fr_auto] gap-2">
                <input className="input-field text-xs" placeholder="Base URL，例如 https://api.deepseek.com" value={llmBaseUrl} onChange={(event) => setLlmBaseUrl(event.target.value)} />
                <input className="input-field text-xs" placeholder="模型名" value={llmModel} onChange={(event) => setLlmModel(event.target.value)} />
                <input className="input-field text-xs" placeholder="API Key" type="password" value={llmApiKey} onChange={(event) => setLlmApiKey(event.target.value)} />
                <button
                  type="button"
                  className="btn-primary text-xs px-4"
                  onClick={() => {
                    localStorage.setItem("llm_base_url", llmBaseUrl.trim());
                    localStorage.setItem("llm_model", llmModel.trim());
                    localStorage.setItem("llm_api_key", llmApiKey.trim());
                    setActionFeedback("GM API 设置已保存到当前浏览器。");
                  }}
                >
                  保存
                </button>
              </div>
            )}
          </div>

          <UIBuilder
            widgets={widgets}
            gameState={state}
            onSendMessage={handleSendMessage}
            onSendAction={handleSendAction}
            onSelectSuggestedAction={handleSelectSuggestedAction}
            onConvertToAction={handleConvertToAction}
            disabled={actionPending}
            pendingActionId={pendingActionId}
          />
        </div>
      </GameContext.Provider>
    );
  }

  return null;
}

function normalizeSuggestedActions(actions: unknown): SuggestedAction[] {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter((action): action is Omit<SuggestedAction, "id"> & { id?: string } => {
      if (!action || typeof action !== "object") return false;
      const item = action as Record<string, unknown>;
      return typeof item.label === "string" && typeof item.action_type === "string";
    })
    .map((action, index) => ({
      id: action.id || `sa_next_${Date.now()}_${index}`,
      label: action.label,
      action_type: action.action_type,
      target: action.target || "current_location",
      method: action.method || "direct",
      intent: action.intent || action.action_type,
      risk_level: action.risk_level || "medium",
      context: action.context || "",
    }));
}

// Role selector sub-component
function RoleSelector({
  roomId,
  onSelect,
  takenRoles,
}: {
  roomId: string;
  onSelect: (roleId: string) => void;
  takenRoles: string[];
}) {
  const [roles, setRoles] = useState<{ id: string; name: string; public_identity: string }[]>([]);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/state`)
      .then((r) => r.json())
      .then((data) => {
        if (data.room) {
          fetch(`/api/stories/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ genre: "demo" }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.story_bible?.roles) {
                setRoles(d.story_bible.roles);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [roomId]);

  if (roles.length === 0) {
    return (
      <div className="col-span-2 flex items-center justify-center py-8">
        <span className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin mr-3" />
        <span className="text-parchment-500 text-sm">加载角色中...</span>
      </div>
    );
  }

  return (
    <>
      {roles.map((role) => (
        <button
          key={role.id}
          onClick={() => onSelect(role.id)}
          disabled={takenRoles.includes(role.id)}
          className="p-4 rounded-xl border border-midnight-600/60 hover:border-amber-500/40 hover:bg-midnight-700/50 text-left disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 group"
        >
          <span className="text-parchment-200 font-medium block mb-1 group-hover:text-amber-200 transition-colors">{role.name}</span>
          <span className="text-xs text-parchment-500">{role.public_identity}</span>
        </button>
      ))}
    </>
  );
}
