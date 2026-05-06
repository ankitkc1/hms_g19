const path = require('path');

function getDashboard(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html'));
}

module.exports = {
  getDashboard
};
