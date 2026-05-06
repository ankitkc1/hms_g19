const router = require('express').Router();

const { getDashboard } = require('../controllers/dashboardController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get('/', ensureAuthenticated, getDashboard);

router.get('/admin', ensureAuthenticated, allowRoles('admin'), getDashboard);
router.get('/reception', ensureAuthenticated, allowRoles('reception'), getDashboard);
router.get('/doctor', ensureAuthenticated, allowRoles('doctor'), getDashboard);
router.get('/nurse', ensureAuthenticated, allowRoles('nurse'), getDashboard);
router.get('/patient', ensureAuthenticated, allowRoles('patient'), getDashboard);

module.exports = router;
