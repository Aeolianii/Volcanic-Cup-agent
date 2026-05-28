export interface RuntimeLLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

let runtimeConfig: RuntimeLLMConfig | null = null;

export function setRuntimeLLMConfig(config: RuntimeLLMConfig) {
  runtimeConfig = { ...config };
}

export function getRuntimeLLMConfig(): RuntimeLLMConfig | null {
  return runtimeConfig;
}

export function clearRuntimeLLMConfig() {
  runtimeConfig = null;
}
