import { Request, Response } from 'express';
import * as service from '../services/chat.service';
import { createConversation } from '../services/conversation.service';
import * as apiRes from '../utils/apiResponse';

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { conversationId, prompt } = req.body;
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) return apiRes.unauthorizedResponse(res, 'Unauthorized');

    const conversation = conversationId
      ? conversationId
      : (await createConversation(userId)).id;

    const message = await service.sendMessage(conversation, prompt);
    console.log(message, "yaha message ayga dekhna ")
    return apiRes.successResponse(res, 'Message sent', message);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not send message', 400);
  }
};

