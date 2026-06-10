import { Router } from "express";
import authRouter from "./auth.route";
import chatRouter from "./chat.route";
import conversationsRouter from "./conversations.route";
import dashboardRouter from "./dashboard.route";
import logsRouter from "./logs.route";
import workspacesRouter from "./workspaces.route";
import authMiddleware from "../middleware/auth.middleware";

const router = Router();

router.use("/auth", authRouter);
router.use("/conversations", authMiddleware, conversationsRouter);
router.use("/chat", authMiddleware, chatRouter);
router.use("/dashboard", authMiddleware, dashboardRouter);
router.use("/logs", authMiddleware, logsRouter);
router.use("/workspaces", authMiddleware, workspacesRouter);

export default router;
