"use client";

import { useState } from "react";

interface FreeActionInputProps {
  onSubmitAction: (actionText: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function FreeActionInput({
  onSubmitAction,
  disabled = false,
  placeholder = "输入你的行动，例如：我要假扮修士潜入地下室偷听主教和大法师的谈话...",
}: FreeActionInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSubmitAction(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="panel">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-fantasy text-amber-400 text-sm">自由行动</h3>
        <span className="text-[10px] text-parchment-500 bg-midnight-700 px-1.5 py-0.5 rounded">
          按 Enter 提交
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="input-field text-sm flex-1"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="btn-primary text-sm px-4 whitespace-nowrap"
        >
          执行行动
        </button>
      </div>
      <p className="text-[10px] text-parchment-600 mt-1">
        描述你想做什么，系统会自动解析为结构化行动
      </p>
    </div>
  );
}
