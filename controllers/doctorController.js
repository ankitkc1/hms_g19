const path = require('path');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');

function getAssignedPatientsPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'doctor', 'patients.html'));
}

function getPatientDetailsPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'doctor', 'records.html'));
}

function formatPatientForDoctor(patient, lastAppointment) {
  return {
    _id: patient._id,
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    lastAppointment
  };
}

async function getAssignedPatients(req, res) {
  try {
    const doctorId = req.session.user.id;

    const appointments = await Appointment.find({ doctor: doctorId })
      .populate('patient')
      .sort({ appointmentDate: -1 });

    const patientMap = new Map();

    appointments.forEach((appointment) => {
      if (!appointment.patient) return;

      const patientId = appointment.patient._id.toString();

      if (!patientMap.has(patientId)) {
        patientMap.set(
          patientId,
          formatPatientForDoctor(appointment.patient, {
            appointmentDate: appointment.appointmentDate,
            reason: appointment.reason,
            status: appointment.status
          })
        );
      }
    });

    return res.status(200).json({
      success: true,
      patients: Array.from(patientMap.values())
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not load assigned patients.'
    });
  }
}

async function getAssignedPatientDetails(req, res) {
  const { patientId } = req.params;
  const doctorId = req.session.user.id;

  if (!mongoose.Types.ObjectId.isValid(patientId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid patient ID.'
    });
  }

  try {
    const appointment = await Appointment.findOne({
      doctor: doctorId,
      patient: patientId
    })
      .populate('patient')
      .populate('doctor', 'fullName email role')
      .sort({ appointmentDate: -1 });

    if (!appointment || !appointment.patient) {
      return res.status(403).json({
        success: false,
        message: 'You can only view records for patients assigned to you.'
      });
    }

    const appointments = await Appointment.find({
      doctor: doctorId,
      patient: patientId
    })
      .sort({ appointmentDate: -1 })
      .select('appointmentDate reason status');

    return res.status(200).json({
      success: true,
      patient: appointment.patient,
      appointments
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not load patient details.'
    });
  }
}

module.exports = {
  getAssignedPatientsPage,
  getPatientDetailsPage,
  getAssignedPatients,
  getAssignedPatientDetails
};