const router = require('express').Router();
const auditController = require('../controllers/auditController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get('/', ensureAuthenticated, allowRoles('admin'), auditController.getAuditPage);
router.get('/data', ensureAuthenticated, allowRoles('admin'), auditController.getAuditLogs);

module.exports = router;