const express = require('express');
const syncService = require('../services/syncService');

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const data = await syncService.getDashboardData();
    res.json({
      syncedAt: new Date().toISOString(),
      summary: data.summary,
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to determine sync status.', error: error.message });
  }
});

router.post('/all', async (req, res) => {
  try {
    const result = await syncService.runSync();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Full sync failed.', error: error.message });
  }
});

router.post('/github', async (req, res) => {
  try {
    const result = await syncService.runSync();
    res.json({ ...result, source: 'github' });
  } catch (error) {
    res.status(500).json({ message: 'GitHub sync failed.', error: error.message });
  }
});

router.post('/jira', async (req, res) => {
  try {
    const result = await syncService.runSync();
    res.json({ ...result, source: 'jira' });
  } catch (error) {
    res.status(500).json({ message: 'Jira sync failed.', error: error.message });
  }
});

module.exports = router;
