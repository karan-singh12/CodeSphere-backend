import { LLMProvider, ProviderOptions, ProviderResponse } from '../provider.interface';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const ANTHROPIC_API_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

export class ClaudeProvider implements LLMProvider {
  public providerName = 'claude';
  public defaultModel = 'claude-3-5-haiku-20241022';
  public supportedModels = [
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
  ];

  async generate(prompt: string, opts: ProviderOptions = {}): Promise<ProviderResponse> {
    const model = opts.model ?? this.defaultModel;

    if (!ANTHROPIC_API_KEY) {
      return this.generateMock(prompt, model, 'Anthropic API key is not configured.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const body: Record<string, any> = {
        model,
        max_tokens: opts.maxTokens ?? 1024,
        messages: [{ role: 'user', content: prompt }],
      };

      if (opts.temperature !== undefined) {
        body.temperature = opts.temperature;
      }

      if (opts.systemPrompt) {
        body.system = opts.systemPrompt;
      }

      const res = await fetch(`${ANTHROPIC_API_BASE_URL}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Anthropic HTTP error ${res.status}: ${errorText}`);
      }

      const data: any = await res.json();
      const text: string = data?.content?.[0]?.text ?? '';

      const usage = data?.usage
        ? {
            prompt_tokens: data.usage.input_tokens ?? 0,
            completion_tokens: data.usage.output_tokens ?? 0,
            total_tokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : {
            prompt_tokens: Math.ceil(prompt.length / 4),
            completion_tokens: Math.ceil(text.length / 4),
            total_tokens: Math.ceil((prompt.length + text.length) / 4),
          };

      return { text, usage, provider: this.providerName, model };
    } catch (err: any) {
      console.warn(`Claude API error. Falling back to mock. Error: ${err?.message ?? err}`);
      return this.generateMock(prompt, model, err?.message ?? 'API call failed');
    }
  }

  private async generateMock(prompt: string, model: string, reason: string): Promise<ProviderResponse> {
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
    const mockResponseText = `[Simulated Claude Response] I received your prompt: "${prompt.slice(0, 120)}...". The Anthropic API is unavailable (${reason}), so this is a mock fallback response.`;
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
