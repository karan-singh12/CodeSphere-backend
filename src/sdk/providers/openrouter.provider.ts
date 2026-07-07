/**
 * OpenRouterProvider — Unified access to 200+ LLMs via OpenRouter.
 *
 * OpenRouter exposes an OpenAI-compatible `/chat/completions` endpoint,
 * so the implementation is very similar to OpenAI/Groq providers.
 *
 * Free models (marked `:free`) are used by default to minimise cost.
 * Paid/premium models can be selected via `opts.model`.
 *
 * Docs: https://openrouter.ai/docs
 */

import { LLMProvider, ProviderOptions, ProviderResponse } from '../provider.interface';
import { OPENROUTER_API_KEY } from '../../config/env';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Free models available on OpenRouter (no billing required)
export const FREE_MODELS = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.2-1b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-3-27b-it:free',
  'google/gemma-3-12b-it:free',
  'qwen/qwen3-8b:free',
  'deepseek/deepseek-r1-0528:free',
];

// Paid/premium models for high-quality tasks
export const PREMIUM_MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-3-5-haiku',
  'anthropic/claude-3-5-sonnet',
  'google/gemini-2.5-flash',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mixtral-8x7b-instruct',
];

export class OpenRouterProvider implements LLMProvider {
  public providerName = 'openrouter';
  /** Default: free Llama 3.2 3B — zero cost, good for simple tasks */
  public defaultModel = 'meta-llama/llama-3.2-3b-instruct:free';
  public supportedModels = [...FREE_MODELS, ...PREMIUM_MODELS];

  async generate(prompt: string, opts: ProviderOptions = {}): Promise<ProviderResponse> {
    const model = opts.model ?? this.defaultModel;

    if (!OPENROUTER_API_KEY) {
      return this.generateMock(prompt, model, 'OpenRouter API key is not configured.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const messages: { role: string; content: string }[] = [];

      if (opts.systemPrompt) {
        messages.push({ role: 'system', content: opts.systemPrompt });
      }

      messages.push({ role: 'user', content: prompt });

      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          // Recommended by OpenRouter for analytics / rate-limit tiers
          'HTTP-Referer': 'https://kscode-ai.vercel.app',
          'X-Title': 'KsCode AI',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errorBody}`);
      }

      const data: any = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? '';

      const usage = data?.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens ?? 0,
            completion_tokens: data.usage.completion_tokens ?? 0,
            total_tokens: data.usage.total_tokens ?? 0,
          }
        : {
            prompt_tokens: Math.ceil(prompt.length / 4),
            completion_tokens: Math.ceil(text.length / 4),
            total_tokens: Math.ceil((prompt.length + text.length) / 4),
          };

      return { text, usage, provider: this.providerName, model };
    } catch (err: any) {
      console.warn(`OpenRouter API error. Falling back to mock. Error: ${err?.message ?? err}`);
      return this.generateMock(prompt, model, err?.message ?? 'API call failed');
    }
  }

  private async generateMock(prompt: string, model: string, reason: string): Promise<ProviderResponse> {
    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 1000));
    const mockResponseText = `[Simulated OpenRouter Response via ${model}] I received your prompt: "${prompt.slice(0, 120)}...". OpenRouter is unavailable (${reason}), so this is a mock fallback response.`;
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
      model,
    };
  }
}
