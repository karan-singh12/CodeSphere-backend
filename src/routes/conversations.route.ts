import { Router } from 'express';
import * as conversationController from '../controllers/conversation.controller';

const router = Router();

router.post('/', conversationController.createConversation);
router.get('/', conversationController.listConversations);
router.get('/:id', conversationController.getConversationById);

export default router;
