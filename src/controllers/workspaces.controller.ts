import { Request, Response } from "express";
import prisma from "../config/prisma";
import * as apiRes from "../utils/apiResponse";
import * as workspacesService from "../services/workspaces.service";

export const listWorkspaces = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) return apiRes.unauthorizedResponse(res, "Unauthorized");

    const workspaces = await prisma.workspace.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const formattedWorkspaces = workspaces.map((w: any) => {
      const msgs = Array.isArray(w.messages) ? w.messages : [];
      const firstUserMsg = msgs.find(
        (m: any): m is { role: string; content: string } =>
          typeof m === "object" &&
          m !== null &&
          (m as Record<string, unknown>).role === "user"
      );

      return {
        id: w.id,
        title: w.title,
        firstPrompt: firstUserMsg?.content?.slice(0, 120) ?? null,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        messageCount: Array.isArray(w.messages) ? w.messages.length : 0,
      };
    });

    return apiRes.successResponse(res, "Workspaces retrieved", formattedWorkspaces);
  } catch (error: unknown) {
    return apiRes.errorResponse(
      res,
      error instanceof Error ? error.message : "Could not list workspaces",
      400
    );
  }
};

export const getWorkspaceById = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) return apiRes.unauthorizedResponse(res, "Unauthorized");

    const workspaceId = req.params.id;
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId, userId },
      select: {
        id: true,
        title: true,
        messages: true,
        fileData: true,
      },
    });

    if (!workspace) return apiRes.notFoundResponse(res, "Workspace not found");

    return apiRes.successResponse(res, "Workspace retrieved", workspace);
  } catch (error: unknown) {
    return apiRes.errorResponse(
      res,
      error instanceof Error ? error.message : "Could not get workspace",
      400
    );
  }
};

export const deleteWorkspace = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) return apiRes.unauthorizedResponse(res, "Unauthorized");

    const workspaceId = req.params.id;
    await prisma.workspace.deleteMany({
      where: { id: workspaceId, userId },
    });

    return apiRes.successResponse(res, "Workspace deleted successfully");
  } catch (error: unknown) {
    return apiRes.errorResponse(
      res,
      error instanceof Error ? error.message : "Could not delete workspace",
      400
    );
  }
};

export const generateCodeStream = async (req: Request, res: Response) => {
  const authUser = (req as any).user as { userId: string } | undefined;
  const userId = authUser?.userId;
  if (!userId) return apiRes.unauthorizedResponse(res, "Unauthorized");

  const { workspaceId, messages, fileData, template } = req.body;

  if (!messages || !messages.length) {
    return apiRes.errorResponse(res, "No messages provided", 400);
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  try {
    await workspacesService.generateCodeStream(
      { userId, workspaceId, messages, fileData, template },
      res
    );
  } catch (error) {
    console.error("generateCodeStream controller error:", error);
    // Write SSE error event if headers already sent
    res.write(`data: ${JSON.stringify({ type: "error", message: "Internal generation error" })}\n\n`);
    res.end();
  }
};

export const improveCodeStream = async (req: Request, res: Response) => {
  const authUser = (req as any).user as { userId: string } | undefined;
  const userId = authUser?.userId;
  if (!userId) return apiRes.unauthorizedResponse(res, "Unauthorized");

  const { workspaceId, userRequest, fileData } = req.body;

  if (!userRequest) {
    return apiRes.errorResponse(res, "No request provided", 400);
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  try {
    await workspacesService.improveCodeStream(
      { userId, workspaceId, userRequest, fileData },
      res
    );
  } catch (error) {
    console.error("improveCodeStream controller error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", message: "Internal improvement error" })}\n\n`);
    res.end();
  }
};
