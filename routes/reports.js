const router = require('express').Router();
const reportController = require('../controllers/reportController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get('/', ensureAuthenticated, allowRoles('admin'), reportController.getReportsPage);
router.get('/data', ensureAuthenticated, allowRoles('admin'), reportController.getReports);

module.exports = router;