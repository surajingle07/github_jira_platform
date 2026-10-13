const mongoose = require('mongoose');

const SyncLogSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['github', 'jira', 'combined'], required: true },
    syncType: { type: String, enum: ['manual', 'webhook', 'incremental', 'full'], default: 'manual' },
    status: { type: String, enum: ['success', 'partial', 'failed'], required: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    recordsFetched: { type: Number, default: 0 },
    recordsUpdated: { type: Number, default: 0 },
    message: { type: String },
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SyncLog', SyncLogSchema);
