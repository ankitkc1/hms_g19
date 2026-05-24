const router = require('express').Router();

const staffController = require('../controllers/staffController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');


router.get(
  '/',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.getStaffPage
);


router.get(
  '/data',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.getAllStaff
);


router.post(
  '/',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.createStaff
);

router.patch(
  '/:id/deactivate',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.deactivateStaff
);

router.patch(
  '/:id/activate',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.activateStaff
);

module.exports = router;