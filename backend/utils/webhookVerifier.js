const crypto = require('crypto');

// In-memory set for delivery IDs to prevent duplicate webhook processing (idempotency)
const processedDeliveries = new Set();
const MAX_DELIVERY_CACHE = 1000;

function verifyGitHubSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    // If no secret configured in environment, skip signature verification in development
    return true;
  }

  if (!signatureHeader || !rawBody) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const sourceBuffer = Buffer.from(parts[1], 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sourceBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sourceBuffer, expectedBuffer);
}

function isDuplicateDelivery(deliveryId) {
  if (!deliveryId) return false;

  if (processedDeliveries.has(deliveryId)) {
    return true;
  }

  processedDeliveries.add(deliveryId);

  // Keep cache bounded
  if (processedDeliveries.size > MAX_DELIVERY_CACHE) {
    const firstKey = processedDeliveries.values().next().value;
    processedDeliveries.delete(firstKey);
  }

  return false;
}

module.exports = {
  verifyGitHubSignature,
  isDuplicateDelivery,
};
