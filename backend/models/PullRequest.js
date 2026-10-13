// backend/models/PullRequest.js
const mongoose = require('mongoose');

const PullRequestSchema = new mongoose.Schema(
    {
        githubId: { type: Number, required: true, unique: true },
        number: { type: Number, required: true },
        title: { type: String, required: true },
        state: { type: String, enum: ['open', 'closed', 'merged'], required: true },
        author: { type: String, required: true },
        sourceBranch: { type: String, required: true },
        targetBranch: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        mergedAt: { type: Date },
        closedAt: { type: Date },
        reviewers: [{ type: String }],          // GitHub usernames
        jiraIssueKey: { type: String, index: true }, // e.g. PROJ-123
    },
    { timestamps: true }
);

module.exports = mongoose.model('PullRequest', PullRequestSchema);
