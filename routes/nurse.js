const router = require('express').Router();
const nurseController = require('../controllers/nurseController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get('/observations', ensureAuthenticated, allowRoles('nurse'), nurseController.getObservationPage);
router.get('/patients/:patientId/observations', ensureAuthenticated, allowRoles('nurse'), nurseController.getPatientObservations);
router.post('/patients/:patientId/observations', ensureAuthenticated, allowRoles('nurse'), nurseController.createObservation);

module.exports = router;