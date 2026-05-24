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

router.patch(
  '/:id/non-clinical',
  ensureAuthenticated,
  allowRoles('admin', 'reception', 'doctor', 'nurse'),
  patientController.updatePatientNonClinical
);

module.exports = router;
