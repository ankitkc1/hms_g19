const path = require('path');
const Patient = require('../models/Patient');

function getProfilePage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'profile.html'));
}

async function getMyProfile(req, res) {
  try {
    const patient = await Patient.findOne({
      linkedUser: req.session.user.id
    }).populate('linkedUser', 'email role');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'No patient profile is linked to your account.'
      });
    }

    return res.status(200).json({
      success: true,
      patient
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not load your profile.'
    });
  }
}

module.exports = {
  getProfilePage,
  getMyProfile
};