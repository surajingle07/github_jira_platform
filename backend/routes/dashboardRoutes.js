const express = require('express');
const syncService = require('../services/syncService');
const githubService = require('../services/githubService');
const jiraService = require('../services/jiraService');

const router = express.Router();

router.get('/overview', async (req, res) => {
  try {
    const { repository, project } = req.query;
    const dashboard = await syncService.getDashboardData({ repository, project });
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ message: 'Unable to build dashboard overview.', error: error.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 25), 100);
    const logs = await syncService.getRecentAuditLogs(limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch audit logs.', error: error.message });
  }
});

router.get('/diagnostics', async (req, res) => {
  try {
    const [ghHealth, jiraHealth] = await Promise.all([
      githubService.verifyConnection(),
      jiraService.verifyConnection(),
    ]);

    const memoryUsage = process.memoryUsage();
    res.json({
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
      database: {
        connected: Boolean(global.isMongoConnected),
        status: global.isMongoConnected ? 'connected' : 'disconnected',
      },
      github: ghHealth,
      jira: jiraHealth,
    });
  } catch (error) {
    res.status(500).json({ message: 'Diagnostics check failed.', error: error.message });
  }
});

module.exports = router;
