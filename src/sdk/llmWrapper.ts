import { LLMProvider, ProviderOptions } from './provider.interface';
import prisma from '../config/prisma';
import { redactPII } from '../utils/redactPII';

export interface LLMWrapperOptions {
  provider: LLMProvider;
}

export class LLMWrapper {
  private provider: LLMProvider;

  constructor(opts: LLMWrapperOptions) {
    this.provider = opts.provider;
  }

  async generate(conversationId: string, prompt: string, opts: ProviderOptions = {}) {
    const start = Date.now();
    try {
      const result = await this.provider.generate(prompt, opts);
      const end = Date.now();
      const latency = Math.max(0, end - start);

      const promptTokens = result.usage?.prompt_tokens ?? 0;
      const completionTokens = result.usage?.completion_tokens ?? 0;
      const totalTokens = result.usage?.total_tokens ?? promptTokens + completionTokens;
      const providerName = this.provider.providerName;
      const model = opts.model ?? this.provider.defaultModel;

      await prisma.inferenceLog.create({
        data: {
          conversationId,
          provider: providerName,
          model,
          latency,
          promptTokens,
          completionTokens,
          totalTokens,
          status: 'success',
          inputPreview: redactPII(prompt).slice(0, 1000),
          outputPreview: redactPII(result.text).slice(0, 1000),
        },
      });

      return result.text;
    } catch (err: unknown) {
      const end = Date.now();
      const latency = Math.max(0, end - start);
      const providerName = this.provider.providerName;
      const model = opts.model ?? this.provider.defaultModel;

      await prisma.inferenceLog.create({
        data: {
          conversationId,
          provider: providerName,
          model,
          latency,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          status: 'error',
          inputPreview: redactPII(prompt).slice(0, 1000),
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        },
      });
      throw err;
    }
  }
}
