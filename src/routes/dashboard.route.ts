import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

router.get('/summary', dashboardController.summary);
router.get('/daily-requests', dashboardController.dailyRequests);
router.get('/provider-usage', dashboardController.providerUsage);
router.get('/latency-trends', dashboardController.latencyTrends);
router.get('/anomalies', dashboardController.anomalies);
// Returns the workspace list for the project filter on the monitoring page
router.get('/workspaces', dashboardController.workspaceList);

export default router;
