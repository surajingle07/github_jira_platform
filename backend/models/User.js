const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    githubUsername: { type: String },
    jiraAccountId: { type: String },
    role: { type: String, enum: ['admin', 'developer', 'viewer'], default: 'viewer' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
