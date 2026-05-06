const path = require('path');

function allowRoles(...roles) {
  return (req, res, next) => {
    const user = req.session && req.session.user;

    if (!user) {
      return res.redirect('/login');
    }

    if (!roles.includes(user.role)) {
      return res.status(403).sendFile(
        path.join(__dirname, '..', 'views', 'partials', 'forbidden.html')
      );
    }

    return next();
  };
}

module.exports = allowRoles;
