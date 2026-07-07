import prisma from '../config/prisma';
import { createProvider, ProviderKey } from '../sdk/providerFactory';
import { LLMWrapper } from '../sdk/llmWrapper';
import { ModelRouter } from '../sdk/modelRouter';

export const sendMessage = async (conversationId: string, prompt: string) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: prompt,
    },
  });

  // Intelligent routing: pick the optimal provider + model for this prompt
  const routingDecision = ModelRouter.routeForChat(prompt);
  const providerKey = (routingDecision.provider as ProviderKey) ?? (conversation.provider as ProviderKey) ?? 'gemini';
  const provider = createProvider(providerKey);
  const wrapper = new LLMWrapper({ provider });

  const responseText = await wrapper.generate(conversationId, prompt, {
    model: routingDecision.model,
  });

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: responseText,
    },
  });

  return assistantMessage;
};
