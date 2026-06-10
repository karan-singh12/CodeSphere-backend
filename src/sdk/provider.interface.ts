export interface ProviderResponse {
  text: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  provider?: string;
  model?: string;
}

export interface ProviderOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMProvider {
  providerName: string;
  defaultModel: string;
  supportedModels: string[];
  generate(prompt: string, opts?: ProviderOptions): Promise<ProviderResponse>;
}
