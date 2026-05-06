const router = require('express').Router();

const {
  getLoginPage,
  login,
  logout,
  getCurrentUser
} = require('../controllers/authController');

const {
  ensureGuest,
  ensureAuthenticated
} = require('../middleware/authMiddleware');

router.get('/login', ensureGuest, getLoginPage);
router.post('/login', ensureGuest, login);
router.post('/logout', ensureAuthenticated, logout);
router.get('/me', ensureAuthenticated, getCurrentUser);

module.exports = router;