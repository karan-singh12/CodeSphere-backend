import { Router } from "express";
import * as workspacesController from "../controllers/workspaces.controller";
import { aiRateLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

// REST endpoints
router.get("/", workspacesController.listWorkspaces);
router.get("/:id", workspacesController.getWorkspaceById);
router.delete("/:id", workspacesController.deleteWorkspace);

// AI Streaming/SSE endpoints (with rate limiting)
router.post("/generate-code", aiRateLimiter, workspacesController.generateCodeStream);
router.post("/improve-code", aiRateLimiter, workspacesController.improveCodeStream);

export default router;
