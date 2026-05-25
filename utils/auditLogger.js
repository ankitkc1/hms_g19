const AuditLog = require('../models/AuditLog');

async function logAction(req, action, entityType, entityId, details = {}) {
  try {
    await AuditLog.create({
      action,
      user: req.session.user ? req.session.user.id : null,
      role: req.session.user ? req.session.user.role : null,
      entityType,
      entityId,
      details
    });
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
}

module.exports = logAction;