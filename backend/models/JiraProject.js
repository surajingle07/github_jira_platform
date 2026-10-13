const mongoose = require('mongoose');

const JiraProjectSchema = new mongoose.Schema(
  {
    jiraId: { type: String, required: true, unique: true },
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    projectTypeKey: { type: String },
    url: { type: String },
    lastSyncedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('JiraProject', JiraProjectSchema);
