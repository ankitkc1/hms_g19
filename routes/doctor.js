const router = require('express').Router();

const doctorController = require('../controllers/doctorController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get(
  '/patients',
  ensureAuthenticated,
  allowRoles('doctor'),
  doctorController.getAssignedPatientsPage
);

router.get(
  '/patients/data',
  ensureAuthenticated,
  allowRoles('doctor'),
  doctorController.getAssignedPatients
);

router.get(
  '/patients/:patientId',
  ensureAuthenticated,
  allowRoles('doctor'),
  doctorController.getPatientDetailsPage
);

router.get(
  '/patients/:patientId/data',
  ensureAuthenticated,
  allowRoles('doctor'),
  doctorController.getAssignedPatientDetails
);

router.post(
  '/patients/:patientId/clinical-records',
  ensureAuthenticated,
  allowRoles('doctor'),
  doctorController.addClinicalRecord
);

module.exports = router;