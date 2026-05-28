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
  placeholder = "输入你的行动，例如：我要假扮修士潜入地下室，偷听主教和大法师的谈话...",
}: FreeActionInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSubmitAction(input.trim());
    setInput("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="panel">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-fantasy text-amber-400 text-sm">自由行动</h3>
        <span className="badge-amber text-[10px]">Enter 提交</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "行动处理中，请稍候..." : placeholder}
          disabled={disabled}
          className="input-field text-sm flex-1"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="btn-primary text-sm px-5 whitespace-nowrap"
        >
          {disabled ? "处理中" : "执行行动"}
        </button>
      </div>
      <p className="text-[11px] text-parchment-600 mt-2">
        描述你想做什么，系统会自动解析为结构化行动并联动规则引擎。
      </p>
    </div>
  );
}
