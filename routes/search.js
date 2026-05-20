const router = require('express').Router();

const searchController = require('../controllers/searchController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get(
  '/data',
  ensureAuthenticated,
  allowRoles('admin', 'reception', 'doctor', 'nurse'),
  searchController.searchDirectory
);

module.exports = router;
