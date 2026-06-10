import prisma from '../config/prisma';

export const createConversation = async (userId: string, provider?: string, model?: string) => {
  const conversation = await prisma.conversation.create({
    data: {
      userId,
      title: 'New Conversation',
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
    },
  });
  return conversation;
};

export const listConversations = async (userId: string) => {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      sessionId: true,
      provider: true,
      model: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getConversationById = async (id: string, userId: string) => {
  return prisma.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
};
