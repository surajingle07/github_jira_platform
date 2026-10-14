const express = require('express');
const syncService = require('../services/syncService');
const { verifyGitHubSignature, isDuplicateDelivery } = require('../utils/webhookVerifier');

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

router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const logs = await syncService.getRecentSyncLogs(limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Unable to retrieve sync logs.', error: error.message });
  }
});

router.post('/all', async (req, res) => {
  try {
    const result = await syncService.runSync({ provider: 'combined', syncType: 'manual' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Full sync failed.', error: error.message });
  }
});

router.post('/github', async (req, res) => {
  try {
    const result = await syncService.runSync({ provider: 'github', syncType: 'manual' });
    res.json({ ...result, source: 'github' });
  } catch (error) {
    res.status(500).json({ message: 'GitHub sync failed.', error: error.message });
  }
});

router.post('/jira', async (req, res) => {
  try {
    const result = await syncService.runSync({ provider: 'jira', syncType: 'manual' });
    res.json({ ...result, source: 'jira' });
  } catch (error) {
    res.status(500).json({ message: 'Jira sync failed.', error: error.message });
  }
});

// GitHub Webhook Endpoint (FR-10) with signature verification & idempotency
router.post('/webhook/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const deliveryId = req.headers['x-github-delivery'];
    const event = req.headers['x-github-event'] || 'unknown';

    // Verify signature if secret configured
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret && !verifyGitHubSignature(req.rawBody || JSON.stringify(req.body), signature, secret)) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    // Check duplicate delivery
    if (deliveryId && isDuplicateDelivery(deliveryId)) {
      return res.status(200).json({ status: 'ignored', message: 'Duplicate webhook event skipped.' });
    }

    const outcome = await syncService.handleGitHubWebhook(event, req.body, deliveryId);
    res.status(200).json(outcome);
  } catch (error) {
    res.status(500).json({ message: 'Webhook processing failed.', error: error.message });
  }
});

// Jira Webhook Endpoint (FR-10)
router.post('/webhook/jira', async (req, res) => {
  try {
    const event = req.body?.webhookEvent || 'jira:unknown';
    const outcome = await syncService.handleJiraWebhook(event, req.body);
    res.status(200).json(outcome);
  } catch (error) {
    res.status(500).json({ message: 'Jira webhook processing failed.', error: error.message });
  }
});

module.exports = router;
