import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import { validateBody } from '../middleware/validate.middleware';
import { chatSchema } from '../validators/schemas';

const router = Router();

router.post('/', validateBody(chatSchema), chatController.sendMessage);

export default router;
