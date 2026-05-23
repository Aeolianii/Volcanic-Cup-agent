import type { AIProvider } from "@/types";
import { llmAIProvider } from "./llmProvider";
import { mockAIProvider } from "@/mock/mockAIProvider";

export function getAIProvider(): AIProvider {
  return process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_COMPAT_API_KEY ||
    process.env.CLASSBY_API_KEY ||
    process.env.OPENAI_API_KEY
    ? llmAIProvider
    : mockAIProvider;
}
