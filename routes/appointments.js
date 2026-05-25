const router = require('express').Router();
const appointmentController = require('../controllers/appointmentController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get(
  '/',
  ensureAuthenticated,
  allowRoles('admin', 'reception', 'doctor', 'nurse', 'patient'),
  appointmentController.getAppointmentsPage
);

router.get(
  '/new',
  ensureAuthenticated,
  allowRoles('admin', 'reception'),
  appointmentController.getCreateAppointmentPage
);

router.get(
  '/data',
  ensureAuthenticated,
  allowRoles('admin', 'reception', 'doctor', 'nurse', 'patient'),
  appointmentController.listAppointments
);

router.get(
  '/options',
  ensureAuthenticated,
  allowRoles('admin', 'reception'),
  appointmentController.getAppointmentOptions
);

router.get(
  '/availability',
  ensureAuthenticated,
  allowRoles('admin', 'reception'),
  appointmentController.getDoctorAvailability
);

router.post(
  '/',
  ensureAuthenticated,
  allowRoles('admin', 'reception'),
  appointmentController.createAppointment
);

router.post(
  '/:id/status',
  ensureAuthenticated,
  allowRoles('admin', 'reception', 'doctor'),
  appointmentController.updateAppointmentStatus
);

router.patch(
  '/:id/reschedule',
  ensureAuthenticated,
  allowRoles('admin', 'reception'),
  appointmentController.rescheduleAppointment
);

module.exports = router;
