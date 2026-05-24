const path = require('path');
const User = require('../models/User');

function getLoginPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
}

function validateLoginInput(email, password) {
  const errors = {};

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

function getDashboardUrl(role) {
  if (role === 'admin') return '/dashboard/admin';
  if (role === 'reception') return '/dashboard/reception';
  if (role === 'doctor') return '/dashboard/doctor';
  if (role === 'nurse') return '/dashboard/nurse';
  if (role === 'patient') return '/dashboard/patient';

  return '/dashboard';
}


async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const errors = validateLoginInput(email, password);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please fix the highlighted fields.',
      errors
    });
  }

  try {
    const user = await User.findOne({ email, isActive: true });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email is not registered'
      });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Please enter a valid password'
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: 'Could not start a secure session.'
        });
      }

      req.session.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role
      };

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        redirectUrl: getDashboardUrl(user.role)

      });
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong while logging in.'
    });
  }
}

function logout(req, res) {
  req.session.destroy((error) => {
    res.clearCookie('hms.sid');

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Logout failed. Please try again.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'You have been logged out securely.',
      redirectUrl: '/login'
    });
  });
}

function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    user: req.session.user
  });
}

module.exports = {
  getLoginPage,
  login,
  logout,
  getCurrentUser
};