import { LLMProvider, ProviderOptions, ProviderResponse } from '../provider.interface';

export class MockProvider implements LLMProvider {
  public providerName = 'mock';
  public defaultModel = 'mock-model';
  public supportedModels = ['mock-model'];

  async generate(prompt: string, opts: ProviderOptions = {}): Promise<ProviderResponse> {
    // Simulate slight latency
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));
    const mockResponseText = `[Mock Response] I received your prompt: "${prompt}". This is a mock response generated entirely locally.`;
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
}
