const path = require('path');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');

function getAppointmentsPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'appointments', 'index.html'));
}

function getCreateAppointmentPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'appointments', 'create.html'));
}

function normaliseAppointmentDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setSeconds(0, 0);
  return date;
}

async function getAppointmentOptions(req, res) {
  try {
    const patients = await Patient.find()
      .sort({ firstName: 1, lastName: 1 })
      .select('patientId firstName lastName phone email');

    const doctors = await User.find({ role: 'doctor' })
      .sort({ email: 1 })
      .select('email role');

    return res.status(200).json({
      success: true,
      patients,
      doctors
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not load patients and doctors.'
    });
  }
}

async function listAppointments(req, res) {
  try {
    const user = req.session.user;
    const query = {};

    // Doctor only sees their own scheduled patient visits
    if (user.role === 'doctor') {
      query.doctor = user.id;
    }

    // Patient role can only see own linked appointments if linkedUser exists
    if (user.role === 'patient') {
      const patient = await Patient.findOne({ linkedUser: user.id });
      query.patient = patient ? patient._id : null;
    }

    const appointments = await Appointment.find(query)
      .populate('patient')
      .populate('doctor')
      .sort({ appointmentDate: 1 });

    return res.status(200).json({
      success: true,
      appointments
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not load appointments.'
    });
  }
}

async function createAppointment(req, res) {
  const errors = {};
  const { patient, doctor, appointmentDate, reason } = req.body;

  if (!patient || !mongoose.Types.ObjectId.isValid(patient)) {
    errors.patient = 'Please select a valid patient.';
  }

  if (!doctor || !mongoose.Types.ObjectId.isValid(doctor)) {
    errors.doctor = 'Please select a valid doctor.';
  }

  const cleanDate = normaliseAppointmentDate(appointmentDate);

  if (!cleanDate) {
    errors.appointmentDate = 'Please select a valid appointment date and time.';
  }

  if (!reason || !String(reason).trim()) {
    errors.reason = 'Reason is required.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please fix the highlighted fields.',
      errors
    });
  }

  try {
    const patientExists = await Patient.findById(patient);

    if (!patientExists) {
      return res.status(404).json({
        success: false,
        message: 'Selected patient was not found.'
      });
    }

    const doctorExists = await User.findOne({
      _id: doctor,
      role: 'doctor'
    });

    if (!doctorExists) {
      return res.status(404).json({
        success: false,
        message: 'Selected doctor was not found.'
      });
    }

    const existingAppointment = await Appointment.findOne({
      doctor,
      appointmentDate: cleanDate,
      status: { $ne: 'Cancelled' }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: 'This doctor is already booked at the selected date and time.'
      });
    }

    const appointment = await Appointment.create({
      patient,
      doctor,
      appointmentDate: cleanDate,
      reason: String(reason).trim(),
      createdBy: req.session.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Appointment created successfully.',
      appointment
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Double booking blocked: this doctor already has an appointment at this time.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while creating the appointment.'
    });
  }
}

async function updateAppointmentStatus(req, res) {
  const allowedStatuses = ['Scheduled', 'Completed', 'Cancelled'];

  if (!allowedStatuses.includes(req.body.status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid appointment status.'
    });
  }

  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    if (
      req.session.user.role === 'doctor' &&
      appointment.doctor.toString() !== req.session.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own appointments.'
      });
    }

    appointment.status = req.body.status;
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: 'Appointment status updated.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not update appointment status.'
    });
  }
}

module.exports = {
  getAppointmentsPage,
  getCreateAppointmentPage,
  getAppointmentOptions,
  listAppointments,
  createAppointment,
  updateAppointmentStatus
};