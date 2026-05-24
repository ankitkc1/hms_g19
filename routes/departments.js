const router = require('express').Router();

const departmentController = require('../controllers/departmentController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get(
  '/',
  ensureAuthenticated,
  allowRoles('admin'),
  departmentController.getDepartmentsPage
);

router.get(
  '/data',
  ensureAuthenticated,
  allowRoles('admin'),
  departmentController.getAllDepartments
);

router.post(
  '/',
  ensureAuthenticated,
  allowRoles('admin'),
  departmentController.createDepartment
);

router.patch(
  '/:id/deactivate',
  ensureAuthenticated,
  allowRoles('admin'),
  departmentController.deactivateDepartment
);

router.patch(
  '/:id/activate',
  ensureAuthenticated,
  allowRoles('admin'),
  departmentController.activateDepartment
);

module.exports = router;