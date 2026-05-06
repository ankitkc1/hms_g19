function ensureAuthenticated(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  return next();
}

function ensureGuest(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }

  return next();
}

module.exports = {
  ensureAuthenticated,
  ensureGuest
};