import type { AIProvider } from "@/types";
import { llmAIProvider } from "./llmProvider";

export function getAIProvider(): AIProvider {
  return llmAIProvider;
}
