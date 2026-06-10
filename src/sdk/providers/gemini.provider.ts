import { LLMProvider, ProviderOptions, ProviderResponse } from '../provider.interface';
import { GEMINI_API_KEY, GEMINI_API_BASE_URL } from '../../config/env';

export class GeminiProvider implements LLMProvider {
  public providerName = 'gemini';
  public defaultModel = 'gemini-flash-latest';
  public supportedModels = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

  async generate(prompt: string, opts: ProviderOptions = {}): Promise<ProviderResponse> {
    const model = opts.model ?? this.defaultModel;
    const apiKey = GEMINI_API_KEY;
    const apiBaseUrl = GEMINI_API_BASE_URL;

    if (!apiKey) {
      return this.generateMock(prompt, model, 'Gemini API key is not configured in environment.');
    }

    try {
      const url = `${apiBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: opts.maxTokens ?? 1024,
            temperature: opts.temperature ?? 0.7,
          }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP error! status: ${res.status}, body: ${errorText}`);
      }

      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      
      const promptTokens = Math.ceil(prompt.length / 4);
      const completionTokens = Math.ceil(text.length / 4);

      return {
        text,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
        provider: this.providerName,
        model,
      };
    } catch (err: any) {
      console.warn(`Gemini API error. Falling back to mock response. Error: ${err?.message || err}`);
      return this.generateMock(prompt, model, err?.message || 'API call failed');
    }
  }

  private async generateMock(prompt: string, model: string, reason: string): Promise<ProviderResponse> {
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
    const mockResponseText = `[Simulated Gemini Response] I received your prompt: "${prompt}". Currently, the Gemini API is unavailable or unconfigured (${reason}), so this response was generated in mock fallback mode.`;
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
