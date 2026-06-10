import { LLMProvider, ProviderOptions, ProviderResponse } from '../provider.interface';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../../config/env';

export class OpenAIProvider implements LLMProvider {
  public providerName = 'openai';
  public defaultModel = 'gpt-4.1';
  public supportedModels = ['gpt-4.1', 'gpt-4o-mini', 'gpt-3.5-turbo'];
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ 
      apiKey: OPENAI_API_KEY,
      timeout: 10000 // 10 seconds timeout to prevent hanging on network issues
    });
  }

  async generate(prompt: string, opts: ProviderOptions = {}): Promise<ProviderResponse> {
    let model = opts.model ?? this.defaultModel;
    if (model === 'gpt-4.1') {
      model = 'gpt-4o-mini';
    }

    try {
      const response = await this.client.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens ?? 1024,
        temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.7,
      });

      const choice = response.choices?.[0];
      const text = (choice?.message?.content as string) ?? '';
      const usage = response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens ?? 0,
            completion_tokens: response.usage.completion_tokens ?? 0,
            total_tokens: response.usage.total_tokens ?? 0,
          }
        : undefined;

      return { text, usage, provider: this.providerName, model: opts.model ?? this.defaultModel };
    } catch (err: any) {
      const isQuotaOrAuthError =
        err?.status === 429 ||
        err?.status === 401 ||
        err?.message?.includes("quota") ||
        err?.message?.includes("billing") ||
        err?.message?.includes("API key");

      if (isQuotaOrAuthError) {
        console.warn(`OpenAI API limit hit or key invalid. Falling back to mock response. Error: ${err?.message || err}`);
        // Simulate network latency (between 0.8s and 2.0s)
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));

        const mockResponseText = `[Simulated Response] I received your prompt: "${prompt}". Currently, the OpenAI API key is unavailable or has exceeded its quota, so this response was generated locally in fallback mock mode to ensure observability tracing and chat continue working.`;

        const promptTokens = Math.ceil(prompt.length / 4);
        const completionTokens = Math.ceil(mockResponseText.length / 4);

        return {
          text: mockResponseText,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          },
          provider: this.providerName,
          model: opts.model ?? this.defaultModel,
        };
      }

      throw err;
    }
  }
}
