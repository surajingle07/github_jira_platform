// backend/models/Commit.js
const mongoose = require('mongoose');

const CommitSchema = new mongoose.Schema(
    {
        sha: { type: String, required: true, unique: true },
        message: { type: String, required: true },
        author: { type: String, required: true },
        url: { type: String },
        repoFullName: { type: String, required: true },
        createdAt: { type: Date, required: true },
        jiraIssueKey: { type: String, index: true },
        pullRequestNumber: { type: Number, index: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Commit', CommitSchema);
