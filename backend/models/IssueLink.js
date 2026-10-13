const mongoose = require('mongoose');

const IssueLinkSchema = new mongoose.Schema(
  {
    jiraIssueKey: { type: String, required: true, index: true },
    githubRecordType: {
      type: String,
      enum: ['branch', 'commit', 'pull_request'],
      required: true,
    },
    githubRecordId: { type: String, required: true },
    githubRecordName: { type: String },
    source: { type: String, default: 'auto' },
    correlationStatus: {
      type: String,
      enum: ['linked', 'matched', 'ambiguous', 'unmatched'],
      default: 'linked',
    },
    evidence: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('IssueLink', IssueLinkSchema);
