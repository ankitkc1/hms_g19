const router = require('express').Router();

const profileController = require('../controllers/profileController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/rolesMiddleware');

router.get(
  '/',
  ensureAuthenticated,
  allowRoles('patient'),
  profileController.getProfilePage
);

router.get(
  '/data',
  ensureAuthenticated,
  allowRoles('patient'),
  profileController.getMyProfile
);

module.exports = router;