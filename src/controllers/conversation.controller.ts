import { Request, Response } from 'express';
import * as service from '../services/conversation.service';
import * as apiRes from '../utils/apiResponse';

export const createConversation = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) {
      return apiRes.unauthorizedResponse(res, 'Unauthorized');
    }

    const { provider, model } = req.body;
    const conversation = await service.createConversation(userId, provider, model);
    return apiRes.successResponse(res, 'Conversation created', conversation);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not create conversation', 400);
  }
};

export const listConversations = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) {
      return apiRes.unauthorizedResponse(res, 'Unauthorized');
    }

    const conversations = await service.listConversations(userId);
    return apiRes.successResponse(res, 'Conversations retrieved', conversations);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not list conversations', 400);
  }
};

export const getConversationById = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) {
      return apiRes.unauthorizedResponse(res, 'Unauthorized');
    }

    const conversationId = req.params.id;
    const conversation = await service.getConversationById(conversationId, userId);
    if (!conversation) {
      return apiRes.notFoundResponse(res, 'Conversation not found');
    }

    return apiRes.successResponse(res, 'Conversation retrieved', conversation);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not get conversation', 400);
  }
};
