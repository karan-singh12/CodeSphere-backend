import { LLMProvider, ProviderOptions, ProviderResponse } from '../provider.interface';

export class ClaudeProvider implements LLMProvider {
  public providerName = 'claude';
  public defaultModel = 'claude-v1';
  public supportedModels = ['claude-v1'];

  async generate(_prompt: string, _opts: ProviderOptions = {}): Promise<ProviderResponse> {
    throw new Error('Claude provider is not implemented yet');
  }
}
