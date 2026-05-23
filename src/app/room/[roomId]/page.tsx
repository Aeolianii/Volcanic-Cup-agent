"use client";

import { useState, useEffect, useCallback, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import { UIBuilder } from "@/components/ui/UIBuilder";
import { gameReducer, initialGameState, GameContext } from "@/lib/gameStore";
import type { Room, WorldState, PlayerView, ChatMessage } from "@/types";

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
  const refreshPlayerView = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/players/${playerId}/view`);
      const data = await res.json();
      if (data.success) {
        dispatch({ type: "SET_PLAYER_VIEW", view: data.player_view });
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
              },
            });
          }
        }
      }
    } catch {
      // Silently fail - will retry
    }
  };

  // Send chat message
  const handleSendMessage = useCallback(
    async (content: string) => {
      const tempMsg: ChatMessage = {
        id: `msg_temp_${Date.now()}`,
        room_id: roomId,
        sender_id: playerId,
        sender_type: "player",
        sender_name: playerName,
        content,
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: "ADD_CHAT_MESSAGE", message: tempMsg });

      try {
        const res = await fetch(`/api/rooms/${roomId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: playerId, content }),
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
      setActionFeedback("");
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
          // Add GM response
          if (data.gm_message) {
            dispatch({ type: "ADD_CHAT_MESSAGE", message: data.gm_message });
          }

          // Update world state
          if (data.world_state) {
            dispatch({ type: "SET_WORLD_STATE", state: data.world_state });
          }

          setActionFeedback(data.rule_result?.public_result || "");

          // Check ending
          if (data.ending) {
            dispatch({ type: "SET_PHASE", phase: "ending" });
            router.push(`/ending/${roomId}?ending_id=${data.ending.id}`);
            return;
          }

          // Refresh view
          await refreshPlayerView();

          // Auto NPC turn
          try {
            await fetch(`/api/rooms/${roomId}/npc-turn`, { method: "POST" });
          } catch {
            // NPC turn is optional
          }
        } else {
          setActionFeedback("行动失败: " + (data.error || "未知错误"));
        }
      } catch {
        setActionFeedback("网络错误");
      }
    },
    [roomId, playerId, state.playerView]
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
      setActionFeedback("");
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
          setActionFeedback(data.rule_result?.public_result || "");

          if (data.ending) {
            dispatch({ type: "SET_PHASE", phase: "ending" });
            router.push(`/ending/${roomId}?ending_id=${data.ending.id}`);
            return;
          }

          await refreshPlayerView();
        }
      } catch {
        setActionFeedback("网络错误");
      }
    },
    [roomId, playerId]
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-parchant-500 text-lg">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-red-400 text-lg mb-4">{error}</p>
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="panel text-center">
          <h2 className="font-fantasy text-2xl text-amber-400 mb-2">房间等待中</h2>
          <p className="text-3xl font-mono text-amber-300 tracking-widest mb-2">{room.room_id}</p>
          <p className="text-parchant-500 text-sm">分享房间号给其他玩家</p>
          <p className="text-xs text-parchant-600 mt-1">
            状态: {room.status === "waiting" ? "等待玩家" : "准备开始"}
          </p>
        </div>

        {/* Player List */}
        <div className="panel">
          <h3 className="font-fantasy text-amber-400 mb-3">
            玩家 ({room.players.length}/{room.max_players})
          </h3>
          <div className="space-y-2">
            {room.players.map((p) => (
              <div
                key={p.player_id}
                className="flex items-center justify-between p-2 rounded bg-midnight-700/50"
              >
                <div>
                  <span className="text-parchant-200">{p.name}</span>
                  {p.is_owner && (
                    <span className="text-amber-500 text-xs ml-2">[房主]</span>
                  )}
                </div>
                <span className="text-xs text-parchant-500">
                  {p.role ? `已选择: ${p.role.name}` : "未选择角色"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Role Selection */}
        {!currentPlayer?.role && (
          <div className="panel">
            <h3 className="font-fantasy text-amber-400 mb-3">选择角色</h3>
            <div className="grid grid-cols-2 gap-3">
              {(room as Room & { available_roles?: { id: string; name: string; public_identity: string }[] }).available_roles?.length
                ? (room as Room & { available_roles: { id: string; name: string; public_identity: string }[] }).available_roles.map((role: { id: string; name: string; public_identity: string }) => (
                    <button
                      key={role.id}
                      onClick={() => handleSelectRole(role.id)}
                      disabled={room.players.some((p: { role_id: string | null }) => p.role_id === role.id)}
                      className="p-3 rounded border border-midnight-600 hover:border-amber-500/50 text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="text-parchant-200 font-medium block">{role.name}</span>
                      <span className="text-xs text-parchant-500">{role.public_identity}</span>
                    </button>
                  ))
                : (
                  // Fetch roles from the story bible via API
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
        {isOwner && (
          <button
            onClick={handleStartStory}
            disabled={room.players.some((p: { role_id: string | null }) => !p.role_id)}
            className="btn-primary w-full py-3 text-lg"
          >
            开始故事
          </button>
        )}

        {!isOwner && (
          <p className="text-center text-parchant-600 text-sm">
            等待房主开始故事...
          </p>
        )}
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
        <div>
          {actionFeedback && (
            <div className="mb-4 bg-midnight-700 border border-amber-600/50 rounded p-3 text-sm text-amber-300">
              {actionFeedback}
              <button
                onClick={() => setActionFeedback("")}
                className="float-right text-parchant-600 hover:text-parchant-300"
              >
                ✕
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
          />
        </div>
      </GameContext.Provider>
    );
  }

  return null;
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
          // Fetch story bible roles
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
    return <p className="text-parchant-500 text-sm col-span-2">加载角色中...</p>;
  }

  return (
    <>
      {roles.map((role) => (
        <button
          key={role.id}
          onClick={() => onSelect(role.id)}
          disabled={takenRoles.includes(role.id)}
          className="p-3 rounded border border-midnight-600 hover:border-amber-500/50 text-left disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="text-parchant-200 font-medium block">{role.name}</span>
          <span className="text-xs text-parchant-500">{role.public_identity}</span>
        </button>
      ))}
    </>
  );
}
