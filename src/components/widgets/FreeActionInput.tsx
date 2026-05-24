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
  placeholder = "输入你的行动，例如：我要伪装成修士潜入地下室，偷听主教和大法师的谈话...",
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
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="section-title text-base">自由行动</h3>
        <span className="rounded bg-midnight-900/50 px-2 py-1 text-[10px] text-parchment-500">
          Enter 提交
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "行动处理中，请稍候..." : placeholder}
          disabled={disabled}
          className="input-field flex-1 text-sm"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="btn-primary whitespace-nowrap px-4 text-sm disabled:cursor-wait disabled:opacity-60"
        >
          {disabled ? "处理中" : "执行行动"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-parchment-600">
        描述你想做什么，系统会自动解析为结构化行动。
      </p>
    </div>
  );
}
