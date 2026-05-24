const path = require('path');
const AuditLog = require('../models/AuditLog');

function getAuditPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'audit.html'));
}

async function getAuditLogs(req, res) {
  try {
    const logs = await AuditLog.find()
      .populate('user', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load audit logs.' });
  }
}

module.exports = { getAuditPage, getAuditLogs };