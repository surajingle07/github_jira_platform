const mongoose = require('mongoose');

const IntegrationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, enum: ['github', 'jira'], required: true },
  externalId: { type: String, required: true }, // GitHub user ID or Jira account ID
  status: { type: String, enum: ['connected', 'error'], default: 'connected' },
  lastChecked: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Integration', IntegrationSchema);
