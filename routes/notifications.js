const router = require('express').Router();

const notificationController = require('../controllers/notificationController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get(
  '/notif',
  ensureAuthenticated,
  allowRoles('admin'),
  notificationController.getNotificationPage
);

router.get(
  '/new',
  ensureAuthenticated,
  allowRoles('admin'),
  notificationController.getNotificationPage
);

router.get(
  '/staff',
  ensureAuthenticated,
  allowRoles('admin'),
  notificationController.getStaffOptions
);

router.get(
  '/mine',
  ensureAuthenticated,
  allowRoles('admin', 'reception', 'doctor', 'nurse'),
  notificationController.getMyNotifications
);

router.post(
  '/',
  ensureAuthenticated,
  allowRoles('admin'),
  notificationController.sendNotification
);

router.post(
  '/read',
  ensureAuthenticated,
  allowRoles('admin', 'reception', 'doctor', 'nurse'),
  notificationController.markNotificationsRead
);

module.exports = router;
