import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate.middleware';
import { loginSchema, signUpSchema } from '../validators/schemas';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', validateBody(signUpSchema), authController.signUp);
router.post('/login', validateBody(loginSchema), authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/upgrade', authMiddleware, authController.upgradePlan);

export default router;
