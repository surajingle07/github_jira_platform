const express = require('express');
const syncService = require('../services/syncService');

const router = express.Router();

router.get('/overview', async (req, res) => {
  try {
    const dashboard = await syncService.getDashboardData();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ message: 'Unable to build dashboard overview.', error: error.message });
  }
});

module.exports = router;
