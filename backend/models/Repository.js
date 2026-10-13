const mongoose = require('mongoose');

const RepositorySchema = new mongoose.Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    owner: { type: String, required: true },
    defaultBranch: { type: String, default: 'main' },
    private: { type: Boolean, default: false },
    url: { type: String },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    lastSyncedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Repository', RepositorySchema);
