const path = require('path');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const ClinicalRecord = require('../models/ClinicalRecord');
const NurseObservation = require('../models/NurseObservation');

function getReportsPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'reports.html'));
}

async function getReports(req, res) {
  const reports = {
    patients: await Patient.countDocuments(),
    appointments: await Appointment.countDocuments(),
    activeStaff: await User.countDocuments({ role: { $ne: 'patient' }, isActive: true }),
    doctors: await User.countDocuments({ role: 'doctor', isActive: true }),
    nurses: await User.countDocuments({ role: 'nurse', isActive: true }),
    reception: await User.countDocuments({ role: 'reception', isActive: true }),
    scheduledAppointments: await Appointment.countDocuments({ status: 'Scheduled' }),
    completedAppointments: await Appointment.countDocuments({ status: 'Completed' }),
    cancelledAppointments: await Appointment.countDocuments({ status: 'Cancelled' }),
    clinicalRecords: await ClinicalRecord.countDocuments(),
    nurseObservations: await NurseObservation.countDocuments()
  };

  res.json({ success: true, reports });
}

module.exports = { getReportsPage, getReports };