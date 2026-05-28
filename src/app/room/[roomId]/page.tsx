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
        await refreshPlayerView();
      }
    } catch {
      setError("开始故事失败");
    }
  };

  const refreshPlayerView = async (suggestedActionsOverride?: SuggestedAction[]) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/players/${playerId}/view`);
      const data = await res.json();
      if (data.success) {
        dispatch({
          type: "SET_PLAYER_VIEW",
          view: suggestedActionsOverride
            ? { ...data.player_view, suggested_actions: suggestedActionsOverride }
            : data.player_view,
        });
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
      // Silently fail
    }
  };

  const replaceSuggestedActions = useCallback((actions: SuggestedAction[]) => {
    if (!state.playerView) return;
    dispatch({
      type: "SET_PLAYER_VIEW",
      view: { ...state.playerView, suggested_actions: actions },
    });
  }, [state.playerView]);

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: playerId, content, channel_id: channelId }),
        });
        const data = await res.json();
        if (data.success && data.action_hint) {
          setActionFeedback(data.action_hint.suggestion);
        }
      } catch {
        // Sent optimistically
      }
    },
    [roomId, playerId, playerName]
  );

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_id: playerId,
            raw_input: actionText,
            action_source: "free_action",
            current_location: state.playerView?.known_locations?.[0],
          }),
        });
        const data = await res.json();

        if (data.success) {
          if (data.gm_message) {
            dispatch({ type: "ADD_CHAT_MESSAGE", message: data.gm_message });
          }
          if (data.world_state) {
            dispatch({ type: "SET_WORLD_STATE", state: data.world_state });
          }
          const nextSuggestedActions = normalizeSuggestedActions(data.suggested_actions);
          replaceSuggestedActions(nextSuggestedActions);

          const gmStatusText = formatGMProviderStatus(data.gm_provider_status);
          setActionFeedback(gmStatusText || "行动已结算，结果已写入 GM 叙事。");

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
    [actionPending, roomId, playerId, state.playerView, replaceSuggestedActions]
  );

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
          headers: { "Content-Type": "application/json" },
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
          if (data.gm_message) {
            dispatch({ type: "ADD_CHAT_MESSAGE", message: data.gm_message });
          }
          if (data.world_state) {
            dispatch({ type: "SET_WORLD_STATE", state: data.world_state });
          }
          const nextSuggestedActions = normalizeSuggestedActions(data.suggested_actions);
          replaceSuggestedActions(nextSuggestedActions);
          const gmStatusText = formatGMProviderStatus(data.gm_provider_status);
          setActionFeedback(gmStatusText || "行动已结算，结果已写入 GM 叙事。");

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
    [actionPending, roomId, playerId, state.playerView, replaceSuggestedActions]
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-amber-600/30 border-t-amber-400 animate-spin" />
        <p className="text-parchment-500 text-lg">正在进入故事世界...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="panel-glow text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-rose-900/20 border border-rose-700/30 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-rose-400"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </div>
          <p className="text-rose-300 text-lg mb-1">出错了</p>
          <p className="text-parchment-500 mb-6">{error}</p>
          <button onClick={() => router.push("/")} className="btn-primary w-full">
            返回首页
          </button>
        </div>
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
        <div className="panel-glow text-center">
          <p className="text-xs text-parchment-600 uppercase tracking-widest mb-2">房间等待中</p>
          <h2 className="text-3xl font-bold font-mono text-amber-300 tracking-[0.3em] mb-2">{room.room_id}</h2>
          <p className="text-parchment-500 text-sm">分享房间号给其他玩家加入</p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-midnight-800/60 border border-midnight-600/50">
            <span className={`w-2 h-2 rounded-full ${room.players.length > 1 ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
            <span className="text-xs text-parchment-400">
              {room.status === "waiting" ? "等待玩家加入" : "准备开始"} &middot; {room.players.length}/{room.max_players}
            </span>
          </div>
        </div>

        {/* Player List */}
        <div className="panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-fantasy text-amber-400 text-sm">当前玩家</h3>
            <span className="text-xs text-parchment-600">{room.players.length}/{room.max_players}</span>
          </div>
          <div className="space-y-2">
            {room.players.map((p, i) => (
              <div
                key={p.player_id}
                className="flex items-center justify-between p-3 rounded-lg bg-midnight-800/50 border border-midnight-700/40 animate-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600/20 to-amber-800/10 border border-amber-700/20 flex items-center justify-center">
                    <span className="text-sm text-amber-400 font-fantasy">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-parchment-200 font-medium">{p.name}</span>
                    {p.is_owner && (
                      <span className="badge-amber ml-2">房主</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs ${p.role ? "text-emerald-400" : "text-parchment-600"}`}>
                  {p.role ? p.role.name : "未选择角色"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Role Selection */}
        {!currentPlayer?.role && (
          <div className="panel-glow animate-in">
            <h3 className="font-fantasy text-amber-400 text-sm mb-4">选择你的角色</h3>
            <div className="grid grid-cols-2 gap-3">
              {(room as Room & { available_roles?: { id: string; name: string; public_identity: string }[] }).available_roles?.length
                ? (room as Room & { available_roles: { id: string; name: string; public_identity: string }[] }).available_roles.map((role: { id: string; name: string; public_identity: string }) => {
                    const taken = room.players.some((p: { role_id: string | null }) => p.role_id === role.id);
                    return (
                      <button
                        key={role.id}
                        onClick={() => handleSelectRole(role.id)}
                        disabled={taken}
                        className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                          taken
                            ? "border-midnight-700/30 bg-midnight-800/30 opacity-40 cursor-not-allowed"
                            : "border-midnight-600/50 bg-midnight-800/40 hover:border-amber-600/50 hover:bg-midnight-800/60 hover:shadow-lg hover:shadow-amber-500/5"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-700/20 flex items-center justify-center mb-3">
                          <span className="text-amber-400 font-fantasy text-sm">{role.name.charAt(0)}</span>
                        </div>
                        <span className="text-parchment-200 font-medium block mb-1">{role.name}</span>
                        <span className="text-xs text-parchment-500">{role.public_identity}</span>
                        {taken && (
                          <span className="block text-xs text-amber-600 mt-2">已被选择</span>
                        )}
                      </button>
                    );
                  })
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

        {/* Start / Wait */}
        <div className="text-center">
          {isOwner ? (
            <button
              onClick={handleStartStory}
              disabled={room.players.some((p: { role_id: string | null }) => !p.role_id)}
              className="btn-primary w-full py-4 text-lg font-fantasy tracking-wider"
            >
              开始故事
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-amber-600/20 border-t-amber-500 animate-spin" />
              <p className="text-parchment-500 text-sm">等待房主开始故事...</p>
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
            <div className="mb-4 flex items-start gap-3 glass-strong border border-amber-700/30 rounded-xl p-4 text-sm text-amber-200 animate-in">
              {actionPending && (
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              )}
              <span className="flex-1">{actionFeedback}</span>
              <button
                onClick={() => setActionFeedback("")}
                className="text-parchment-500 hover:text-parchment-300 shrink-0 transition-colors"
                disabled={actionPending}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

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

function formatGMProviderStatus(status: unknown): string {
  if (!status || typeof status !== "object") return "";

  const data = status as Record<string, unknown>;
  const ok = data.ok === true;
  const provider = data.provider === "llm" ? "大模型" : "备用模板";
  const reason = typeof data.reason === "string" ? data.reason : "";
  const model = typeof data.model === "string" ? data.model : "";

  if (ok) {
    return `AI GM 已通过大模型完成叙事${model ? `（${model}）` : ""}。`;
  }
  return `AI GM 使用备用叙事${reason ? `，原因：${reason}` : ""}${model ? `（${model}）` : ""}。`;
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
      label: sanitizeSuggestedActionText(action.label),
      action_type: action.action_type,
      target: sanitizeSuggestedActionTarget(action.target || "current_location"),
      method: action.method || "direct",
      intent: action.intent || action.action_type,
      risk_level: action.risk_level || "medium",
      context: sanitizeSuggestedActionText(action.context || ""),
    }));
}

function sanitizeSuggestedActionTarget(target: unknown): string {
  const raw = String(target || "current_location");
  if (/^(current_location|connected_location|current_event|self_goal|public_situation|all_players|unknown)$/.test(raw)) {
    return raw;
  }
  return raw;
}

function sanitizeSuggestedActionText(text: unknown): string {
  let output = String(text || "");
  const replacements: Array<[RegExp, string]> = [
    [/\bcurrent_location\b/g, "当前位置"],
    [/\bconnected_location\b/g, "相关地点"],
    [/\bcurrent_event\b/g, "当前事件"],
    [/\bself_goal\b/g, "自己的目标"],
    [/\bpublic_situation\b/g, "公开局势"],
    [/\ball_players\b/g, "所有玩家"],
    [/\binformed_npc\b/g, "知情者"],
    [/\bunknown\b/g, "当前目标"],
    [/\btruth_progress\b/g, "真相进度"],
    [/\bsituation_stability\b/g, "局势稳定度"],
    [/\bfaction_power\b/g, "势力值"],
    [/\btrust\b/g, "信任度"],
    [/\bsuspicion\b/g, "怀疑度"],
  ];

  for (const [pattern, label] of replacements) {
    output = output.replace(pattern, label);
  }

  return output
    .replace(/\brole_(\d+)\b/gi, "角色 $1")
    .replace(/\bnpc_([a-z0-9_]+)\b/gi, "相关人物")
    .replace(/\bevt_([a-z0-9_]+)\b/gi, "相关事件")
    .replace(/\bevent_([a-z0-9_]+)\b/gi, "相关事件")
    .replace(/\blocation_([a-z0-9_]+)\b/gi, "相关地点")
    .replace(/\bplayer_([a-z0-9_]+)\b/gi, "玩家")
    .replace(/\b[a-z]+(?:_[a-z0-9]+){2,}\b/gi, "相关条目");
}

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
        <div className="w-6 h-6 rounded-full border-2 border-amber-600/20 border-t-amber-400 animate-spin" />
        <span className="text-parchment-500 text-sm ml-3">加载角色中...</span>
      </div>
    );
  }

  return (
    <>
      {roles.map((role) => {
        const taken = takenRoles.includes(role.id);
        return (
          <button
            key={role.id}
            onClick={() => onSelect(role.id)}
            disabled={taken}
            className={`p-4 rounded-xl border text-left transition-all duration-300 ${
              taken
                ? "border-midnight-700/30 bg-midnight-800/30 opacity-40 cursor-not-allowed"
                : "border-midnight-600/50 bg-midnight-800/40 hover:border-amber-600/50 hover:bg-midnight-800/60 hover:shadow-lg hover:shadow-amber-500/5"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-700/20 flex items-center justify-center mb-3">
              <span className="text-amber-400 font-fantasy text-sm">{role.name.charAt(0)}</span>
            </div>
            <span className="text-parchment-200 font-medium block mb-1">{role.name}</span>
            <span className="text-xs text-parchment-500">{role.public_identity}</span>
            {taken && (
              <span className="block text-xs text-amber-600 mt-2">已被选择</span>
            )}
          </button>
        );
      })}
    </>
  );
}
