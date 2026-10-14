const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { verifyGitHubSignature, isDuplicateDelivery } = require('../utils/webhookVerifier');

test('verifyGitHubSignature returns true for valid HMAC SHA256 signature', () => {
  const secret = 'super-secret-key-123';
  const body = JSON.stringify({ action: 'opened', pull_request: { number: 4 } });
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const signature = `sha256=${hash}`;

  assert.equal(verifyGitHubSignature(body, signature, secret), true);
});

test('verifyGitHubSignature returns false for altered body or wrong secret', () => {
  const secret = 'super-secret-key-123';
  const body = JSON.stringify({ action: 'opened', pull_request: { number: 4 } });
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const signature = `sha256=${hash}`;

  assert.equal(verifyGitHubSignature(body + 'tampered', signature, secret), false);
  assert.equal(verifyGitHubSignature(body, signature, 'wrong-secret'), false);
  assert.equal(verifyGitHubSignature(body, 'invalid-signature-format', secret), false);
});

test('isDuplicateDelivery prevents duplicate processing of same delivery ID', () => {
  const deliveryId = `delivery-${Date.now()}`;

  // First time: not a duplicate
  assert.equal(isDuplicateDelivery(deliveryId), false);

  // Second time (retry): duplicate detected
  assert.equal(isDuplicateDelivery(deliveryId), true);
});
