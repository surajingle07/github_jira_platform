const mongoose = require('mongoose');

const ActionAuditLogSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      enum: ['add_comment', 'transition_issue', 'webhook_received', 'manual_sync', 'verify_connection'],
      required: true,
    },
    targetSystem: {
      type: String,
      enum: ['jira', 'github', 'system'],
      required: true,
    },
    targetEntity: {
      type: String,
      default: '',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: String,
      enum: ['success', 'failed', 'ignored'],
      default: 'success',
    },
    initiatedBy: {
      type: String,
      default: 'system',
    },
    message: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActionAuditLog', ActionAuditLogSchema);
