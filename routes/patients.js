const router = require('express').Router();
const patientController = require('../controllers/patientController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get(
  '/new',
  ensureAuthenticated,
  allowRoles('admin', 'reception'),
  patientController.getCreatePatient
);

router.post(
  '/',
  ensureAuthenticated,
  allowRoles('admin', 'reception'),
  patientController.createPatient
);

module.exports = router;
