// backend/models/JiraIssue.js
const mongoose = require('mongoose');

const JiraIssueSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true }, // e.g. PROJ-123
        summary: { type: String, required: true },
        status: { type: String, required: true },
        issueType: { type: String },
        priority: { type: String },
        assignee: { type: String },
        sprint: { type: String },
        projectId: { type: String },
        url: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model('JiraIssue', JiraIssueSchema);
