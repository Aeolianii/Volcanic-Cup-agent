"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UIBuilder } from "@/components/ui/UIBuilder";
import { GameContext, gameReducer, initialGameState } from "@/lib/gameStore";
import type { ChatMessage, Room, SuggestedAction } from "@/types";

type AvailableRole = {
  id: string;
  name: string;
  public_identity: string;
};

type RoomWithRoles = Room & {
  available_roles?: AvailableRole[];
};

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

  const refreshPlayerView = useCallback(
    async (suggestedActionsOverride?: SuggestedAction[]) => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/players/${playerId}/view`);
        const data = await res.json();
        if (!data.success) return;

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
      } catch {
        // Player view refresh is retried by later interactions.
      }
    },
    [playerId, roomId, state.chatMessages.length]
  );

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/state`);
        const data = await res.json();

        if (!data.success) {
          setError(data.error || "房间不存在。");
          setLoading(false);
          return;
        }

        const room: Room = data.room;
        if (data.story_bible) {
          dispatch({ type: "SET_STORY_BIBLE", bible: data.story_bible });
        }

        if (!room.players.some((player) => player.player_id === playerId)) {
          const joinRes = await fetch(`/api/rooms/${roomId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ player_id: playerId, player_name: playerName }),
          });
          const joinData = await joinRes.json();
          if (joinData.success) {
            dispatch({ type: "SET_ROOM", room: joinData.room });
          } else {
            setError("加入房间失败。");
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
        setError("网络错误，请稍后重试。");
        setLoading(false);
      }
    };

    init();
    localStorage.setItem("player_id", playerId);
  }, [playerId, playerName, roomId]);

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
      setError("选择角色失败。");
    }
  };

  const handleStartStory = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/start`, { method: "POST" });
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
      setError("开始故事失败。");
    }
  };

  const replaceSuggestedActions = useCallback(
    (actions: SuggestedAction[]) => {
      if (!state.playerView) return;
      dispatch({
        type: "SET_PLAYER_VIEW",
        view: { ...state.playerView, suggested_actions: actions },
      });
    },
    [state.playerView]
  );

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
        // Message is already shown optimistically.
      }
    },
    [playerId, playerName, roomId]
  );

  const handleSendAction = useCallback(
    async (actionText: string) => {
      if (actionPending) return;

      const previousActions = state.playerView?.suggested_actions || [];
      setActionPending(true);
      setPendingActionId("free_action");
      setActionFeedback(`已提交行动：“${actionText}”。正在解析与结算...`);

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

        if (!data.success) {
          replaceSuggestedActions(previousActions);
          setActionFeedback(`行动失败：${data.error || "未知错误"}`);
          return;
        }

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
        setActionFeedback(formatGMProviderStatus(data.gm_provider_status) || "行动已结算，结果已写入 GM 叙事。");

        if (data.ending) {
          dispatch({ type: "SET_PHASE", phase: "ending" });
          router.push(`/ending/${roomId}?ending_id=${data.ending.id}`);
          return;
        }

        await refreshPlayerView(nextSuggestedActions);
      } catch {
        replaceSuggestedActions(previousActions);
        setActionFeedback("网络错误，行动没有成功提交。");
      } finally {
        setActionPending(false);
        setPendingActionId(null);
      }
    },
    [actionPending, playerId, refreshPlayerView, replaceSuggestedActions, roomId, router, state.playerView]
  );

  const handleSelectSuggestedAction = useCallback(
    async (action: SuggestedAction) => {
      if (actionPending) return;

      const previousActions = state.playerView?.suggested_actions || [];
      replaceSuggestedActions(previousActions.filter((item) => item.id !== action.id));
      setActionPending(true);
      setPendingActionId(action.id);
      setActionFeedback(`已选择推荐行动：“${action.label}”。正在结算...`);

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

        if (!data.success) {
          replaceSuggestedActions(previousActions);
          setActionFeedback(`行动失败：${data.error || "未知错误"}`);
          return;
        }

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
        setActionFeedback(formatGMProviderStatus(data.gm_provider_status) || "行动已结算，结果已写入 GM 叙事。");

        if (data.ending) {
          dispatch({ type: "SET_PHASE", phase: "ending" });
          router.push(`/ending/${roomId}?ending_id=${data.ending.id}`);
          return;
        }

        await refreshPlayerView(nextSuggestedActions);
      } catch {
        replaceSuggestedActions(previousActions);
        setActionFeedback("网络错误，行动没有成功提交。");
      } finally {
        setActionPending(false);
        setPendingActionId(null);
      }
    },
    [actionPending, playerId, refreshPlayerView, replaceSuggestedActions, roomId, router, state.playerView]
  );

  const handleConvertToAction = useCallback(
    (messageId: string) => {
      const msg = state.chatMessages.find((message) => message.id === messageId);
      if (msg) {
        handleSendAction(msg.content);
      }
    },
    [handleSendAction, state.chatMessages]
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-lg text-parchment-500">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <p className="mb-4 text-lg text-red-400">{error}</p>
        <button onClick={() => router.push("/")} className="btn-primary">
          返回首页
        </button>
      </div>
    );
  }

  if (state.phase === "lobby" && state.room) {
    const room = state.room as RoomWithRoles;
    const isOwner = room.owner_id === playerId;
    const currentPlayer = room.players.find((player) => player.player_id === playerId);
    const availableRoles = room.available_roles || [];

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="panel p-6 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/70">waiting room</p>
          <h2 className="section-title mb-3 text-3xl">房间等待中</h2>
          <p className="mb-2 font-mono text-4xl tracking-[0.24em] text-amber-200">{room.room_id}</p>
          <p className="text-sm text-parchment-400">分享房间号给其他玩家</p>
          <p className="mt-1 text-xs text-parchment-500">
            状态：{room.status === "waiting" ? "等待玩家" : "准备开始"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="panel">
            <h3 className="section-title mb-3 text-lg">
              玩家 ({room.players.length}/{room.max_players})
            </h3>
            <div className="space-y-2">
              {room.players.map((player) => (
                <div
                  key={player.player_id}
                  className="flex items-center justify-between gap-3 rounded border border-midnight-500/60 bg-midnight-900/30 p-3"
                >
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-parchment-100">{player.name}</span>
                    {player.is_owner && <span className="text-xs text-amber-300">房主</span>}
                  </div>
                  <span className="shrink-0 text-xs text-parchment-500">
                    {player.role ? `已选：${player.role.name}` : "未选角色"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {!currentPlayer?.role && (
            <section className="panel">
              <h3 className="section-title mb-3 text-lg">选择角色</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {availableRoles.length > 0 ? (
                  availableRoles.map((role) => (
                    <RoleButton
                      key={role.id}
                      role={role}
                      disabled={room.players.some((player) => player.role_id === role.id)}
                      onSelect={handleSelectRole}
                    />
                  ))
                ) : (
                  <RoleSelector
                    roomId={roomId}
                    onSelect={handleSelectRole}
                    takenRoles={room.players.filter((player) => player.role_id).map((player) => player.role_id!)}
                  />
                )}
              </div>
            </section>
          )}
        </div>

        {isOwner ? (
          <button
            onClick={handleStartStory}
            disabled={room.players.some((player) => !player.role_id)}
            className="btn-primary w-full py-3 text-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            开始故事
          </button>
        ) : (
          <p className="text-center text-sm text-parchment-500">等待房主开始故事...</p>
        )}
      </div>
    );
  }

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
        <div className="space-y-4">
          {actionFeedback && (
            <div className="flex items-start gap-3 rounded border border-amber-500/50 bg-midnight-800/90 p-3 text-sm text-amber-200 shadow-lg">
              {actionPending && <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-300" />}
              <span className="flex-1 leading-6">{actionFeedback}</span>
              <button
                onClick={() => setActionFeedback("")}
                className="shrink-0 text-parchment-500 transition-colors hover:text-parchment-200 disabled:opacity-50"
                disabled={actionPending}
              >
                关闭
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

function RoleButton({
  role,
  disabled,
  onSelect,
}: {
  role: AvailableRole;
  disabled: boolean;
  onSelect: (roleId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role.id)}
      disabled={disabled}
      className="interactive-card rounded-lg border border-midnight-500/70 bg-midnight-900/30 p-4 text-left disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
    >
      <span className="block font-medium text-parchment-100">{role.name}</span>
      <span className="mt-1 block text-xs leading-5 text-parchment-500">{role.public_identity}</span>
    </button>
  );
}

function formatGMProviderStatus(status: unknown): string {
  if (!status || typeof status !== "object") return "";

  const data = status as Record<string, unknown>;
  const ok = data.ok === true;
  const reason = typeof data.reason === "string" ? data.reason : "未知原因";
  const model = typeof data.model === "string" ? data.model : "";
  const baseUrl = typeof data.base_url === "string" ? data.base_url : "";

  if (ok) {
    return `行动已结算，AI GM 已通过大模型生成本次叙事${model ? `（模型：${model}）` : ""}。`;
  }

  const configHint = [model ? `模型：${model}` : "", baseUrl ? `地址：${baseUrl}` : ""].filter(Boolean).join("；");
  return `行动已结算，但 AI GM 没有成功调用大模型，已使用备用叙事。原因：${reason}${configHint ? `（${configHint}）` : ""}`;
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
  return String(target || "current_location");
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
  const [roles, setRoles] = useState<AvailableRole[]>([]);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/state`)
      .then((response) => response.json())
      .then((data) => {
        const room = data.room as RoomWithRoles | undefined;
        if (room?.available_roles?.length) {
          setRoles(room.available_roles);
        }
      })
      .catch(() => {});
  }, [roomId]);

  if (roles.length === 0) {
    return <p className="col-span-full text-sm text-parchment-500">加载角色中...</p>;
  }

  return (
    <>
      {roles.map((role) => (
        <RoleButton
          key={role.id}
          role={role}
          disabled={takenRoles.includes(role.id)}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}
