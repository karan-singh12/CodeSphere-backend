import prisma from '../config/prisma';
import { createProvider, ProviderKey } from '../sdk/providerFactory';
import { LLMWrapper } from '../sdk/llmWrapper';

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

  const providerKey = (conversation.provider as ProviderKey) ?? 'gemini';
  const provider = createProvider(providerKey);
  const wrapper = new LLMWrapper({ provider });

  const responseText = await wrapper.generate(conversationId, prompt, { model: conversation.model });
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: responseText,
    },
  });

  return assistantMessage;
};
