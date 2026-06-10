import { LLMProvider, ProviderOptions, ProviderResponse } from '../provider.interface';
import { GROQ_API_KEY, GROQ_API_BASE_URL } from '../../config/env';

export class GroqProvider implements LLMProvider {
  public providerName = 'groq';
  public defaultModel = 'llama-3.1-8b-instant';
  public supportedModels = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];

  async generate(prompt: string, opts: ProviderOptions = {}): Promise<ProviderResponse> {
    const model = opts.model ?? this.defaultModel;
    const apiKey = GROQ_API_KEY;
    const apiBaseUrl = GROQ_API_BASE_URL;

    if (!apiKey) {
      return this.generateMock(prompt, model, 'Groq API key is not configured in environment.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${apiBaseUrl}/openai/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data: any = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      const usage = data?.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens ?? 0,
            completion_tokens: data.usage.completion_tokens ?? 0,
            total_tokens: data.usage.total_tokens ?? 0,
          }
        : undefined;

      return {
        text,
        usage,
        provider: this.providerName,
        model,
      };
    } catch (err: any) {
      console.warn(`Groq API error. Falling back to mock response. Error: ${err?.message || err}`);
      return this.generateMock(prompt, model, err?.message || 'API call failed');
    }
  }

  private async generateMock(prompt: string, model: string, reason: string): Promise<ProviderResponse> {
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
    const mockResponseText = `[Simulated Groq Response] I received your prompt: "${prompt}". Currently, the Groq API is unavailable or unconfigured (${reason}), so this response was generated in mock fallback mode.`;
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
