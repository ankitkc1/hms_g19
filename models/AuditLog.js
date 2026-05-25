const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);