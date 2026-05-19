const router = require('express').Router();

const staffController = require('../controllers/staffController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

/*
=========================================
Staff Page
=========================================
*/
router.get(
  '/',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.getStaffPage
);

/*
=========================================
Get Staff Data
=========================================
*/
router.get(
  '/data',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.getAllStaff
);

/*
=========================================
Create Staff
=========================================
*/
router.post(
  '/',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.createStaff
);

/*
=========================================
Delete Staff
=========================================
*/
router.delete(
  '/:id',
  ensureAuthenticated,
  allowRoles('admin'),
  staffController.deleteStaff
);

module.exports = router;