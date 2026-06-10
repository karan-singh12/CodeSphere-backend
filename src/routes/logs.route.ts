import { Router } from 'express';
import * as logsController from '../controllers/logs.controller';
import { validateBody } from '../middleware/validate.middleware';
import { logSchema } from '../validators/schemas';

const router = Router();

router.post('/', validateBody(logSchema), logsController.ingestLog);

export default router;
