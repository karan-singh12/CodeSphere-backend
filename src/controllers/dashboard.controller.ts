import { Request, Response } from 'express';
import prisma from '../config/prisma';
import * as apiRes from '../utils/apiResponse';

export const summary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const filter = {
      OR: [
        { workspace: { userId } },
        { conversation: { userId } }
      ]
    };

    const totalRequests = await prisma.inferenceLog.count({ where: filter });
    const totalTokens = (await prisma.inferenceLog.aggregate({
      where: filter,
      _sum: { totalTokens: true }
    }))._sum.totalTokens || 0;
    const avg = await prisma.inferenceLog.aggregate({
      where: filter,
      _avg: { latency: true }
    });
    const averageLatency = Math.round(avg._avg.latency || 0);
    const errors = await prisma.inferenceLog.count({
      where: { ...filter, status: 'error' }
    });
    const errorRate = totalRequests === 0 ? 0 : errors / totalRequests;

    return apiRes.successResponse(res, 'Dashboard summary', { totalRequests, totalTokens, averageLatency, errorRate });
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not fetch summary', 400);
  }
};

export const dailyRequests = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;

    const rows = await prisma.$queryRaw<Array<{ day: string; count: any }>>`
      SELECT to_char(il.timestamp::date, 'YYYY-MM-DD') as day, COUNT(il.id) as count
      FROM "InferenceLog" il
      LEFT JOIN "Workspace" w ON il."workspaceId" = w.id
      LEFT JOIN "Conversation" c ON il."conversationId" = c.id
      WHERE w."userId" = ${userId} OR c."userId" = ${userId}
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `;

    const serializedRows = rows.map((row) => ({
      ...row,
      count: Number(row.count),
    }));

    return apiRes.successResponse(res, 'Daily requests', serializedRows);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not fetch daily requests', 400);
  }
};

export const providerUsage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const filter = {
      OR: [
        { workspace: { userId } },
        { conversation: { userId } }
      ]
    };

    const rows = await prisma.inferenceLog.groupBy({
      where: filter,
      by: ['provider'],
      _sum: { totalTokens: true },
      _count: { provider: true }
    });
    const data = rows.map((r) => ({ provider: r.provider, totalTokens: r._sum.totalTokens ?? 0, requests: r._count.provider }));
    return apiRes.successResponse(res, 'Provider usage', data);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not fetch provider usage', 400);
  }
};

export const latencyTrends = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;

    const rows = await prisma.$queryRaw<Array<{ day: string; avg_latency: any }>>`
      SELECT to_char(il.timestamp::date, 'YYYY-MM-DD') as day, ROUND(AVG(il.latency)) as avg_latency
      FROM "InferenceLog" il
      LEFT JOIN "Workspace" w ON il."workspaceId" = w.id
      LEFT JOIN "Conversation" c ON il."conversationId" = c.id
      WHERE w."userId" = ${userId} OR c."userId" = ${userId}
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `;

    const serializedRows = rows.map((row) => ({
      ...row,
      avg_latency: Number(row.avg_latency),
    }));

    return apiRes.successResponse(res, 'Latency trends', serializedRows);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not fetch latency trends', 400);
  }
};

export const anomalies = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const filter = {
      OR: [
        { workspace: { userId } },
        { conversation: { userId } }
      ]
    };

    const logs = await prisma.inferenceLog.findMany({
      where: filter,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    const anomaliesList = logs
      .map((log) => {
        const list: any[] = [];
        
        if (log.status === 'error') {
          list.push({
            id: `${log.id}-error`,
            logId: log.id,
            type: 'error',
            severity: 'critical',
            message: `Request failed on model ${log.model} (${log.provider})`,
            timestamp: log.timestamp,
            details: log.errorMessage || 'Unknown provider error',
            latency: log.latency,
            tokens: log.totalTokens,
            model: log.model,
            provider: log.provider,
          });
        }
        
        if (log.latency > 3000) {
          list.push({
            id: `${log.id}-latency`,
            logId: log.id,
            type: 'latency',
            severity: log.latency > 8000 ? 'critical' : 'high',
            message: `Unusually high latency detected: ${log.latency}ms`,
            timestamp: log.timestamp,
            details: `Model ${log.model} responded in ${log.latency}ms (threshold is 3000ms).`,
            latency: log.latency,
            tokens: log.totalTokens,
            model: log.model,
            provider: log.provider,
          });
        }
        
        if (log.totalTokens > 3500) {
          list.push({
            id: `${log.id}-tokens`,
            logId: log.id,
            type: 'token_usage',
            severity: log.totalTokens > 6000 ? 'high' : 'medium',
            message: `Excessive token usage: ${log.totalTokens} tokens`,
            timestamp: log.timestamp,
            details: `Model ${log.model} consumed ${log.totalTokens} tokens (threshold is 3500).`,
            latency: log.latency,
            tokens: log.totalTokens,
            model: log.model,
            provider: log.provider,
          });
        }

        return list;
      })
      .flat();

    const criticalCount = anomaliesList.filter((a) => a.severity === 'critical').length;
    const highCount = anomaliesList.filter((a) => a.severity === 'high').length;
    const mediumCount = anomaliesList.filter((a) => a.severity === 'medium').length;
    
    const totalDeduction = (criticalCount * 15) + (highCount * 8) + (mediumCount * 3);
    const healthScore = Math.max(0, 100 - totalDeduction);

    return apiRes.successResponse(res, 'Dashboard anomalies', {
      anomalies: anomaliesList,
      summary: {
        total: anomaliesList.length,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        healthScore
      }
    });
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not fetch anomalies', 400);
  }
};
