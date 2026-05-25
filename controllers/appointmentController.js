const path = require('path');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');

const APPOINTMENT_SLOT_MINUTES = 15;
const APPOINTMENT_SLOT_MS = APPOINTMENT_SLOT_MINUTES * 60 * 1000;

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

function isValidAppointmentSlot(date) {
  return date.getMinutes() % APPOINTMENT_SLOT_MINUTES === 0;
}

function getDayRange(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return null;
  }

  const start = new Date(`${value}T00:00`);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function formatSlotTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function getUnavailableSlotsForDay(appointments, dayRange) {
  const unavailableTimes = new Set();

  for (
    let slotStart = new Date(dayRange.start);
    slotStart < dayRange.end;
    slotStart = new Date(slotStart.getTime() + APPOINTMENT_SLOT_MS)
  ) {
    const slotEnd = new Date(slotStart.getTime() + APPOINTMENT_SLOT_MS);
    const hasOverlap = appointments.some((appointment) => {
      const appointmentStart = appointment.appointmentDate;
      const appointmentEnd = new Date(appointmentStart.getTime() + APPOINTMENT_SLOT_MS);

      return slotStart < appointmentEnd && slotEnd > appointmentStart;
    });

    if (hasOverlap) {
      unavailableTimes.add(formatSlotTime(slotStart));
    }
  }

  return Array.from(unavailableTimes).map((label) => ({ label }));
}

function getAppointmentStatusSummary(appointments) {
  const summary = {
    total: appointments.length,
    scheduled: 0,
    completed: 0,
    cancelled: 0
  };

  appointments.forEach((appointment) => {
    const status = String(appointment.status || '').toLowerCase();

    if (status === 'scheduled') {
      summary.scheduled += 1;
    }

    if (status === 'completed') {
      summary.completed += 1;
    }

    if (status === 'cancelled') {
      summary.cancelled += 1;
    }
  });

  return summary;
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

async function getDoctorAvailability(req, res) {
  const { doctor, date } = req.query;

  if (!doctor || !mongoose.Types.ObjectId.isValid(doctor)) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid doctor.'
    });
  }

  const dayRange = getDayRange(date);

  if (!dayRange) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid appointment date.'
    });
  }

  try {
    const appointments = await Appointment.find({
      doctor,
      appointmentDate: {
        $gte: dayRange.start,
        $lt: dayRange.end
      },
      status: { $ne: 'Cancelled' }
    })
      .sort({ appointmentDate: 1 })
      .select('appointmentDate');

    return res.status(200).json({
      success: true,
      slotMinutes: APPOINTMENT_SLOT_MINUTES,
      unavailableSlots: getUnavailableSlotsForDay(appointments, dayRange)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not load doctor availability.'
    });
  }
}

async function listAppointments(req, res) {
  try {
    const user = req.session.user;
    const query = {};

    // Doctor only sees appointments assigned to their user account.
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
      appointments,
      summary: getAppointmentStatusSummary(appointments)
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
  } else if (!isValidAppointmentSlot(cleanDate)) {
    errors.appointmentDate = `Appointments must start on a ${APPOINTMENT_SLOT_MINUTES}-minute slot.`;
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

    const slotStart = cleanDate;
    const slotEnd = new Date(slotStart.getTime() + APPOINTMENT_SLOT_MS);
    const previousSlotStart = new Date(slotStart.getTime() - APPOINTMENT_SLOT_MS);

    const existingAppointment = await Appointment.findOne({
      doctor,
      appointmentDate: {
        $gt: previousSlotStart,
        $lt: slotEnd
      },
      status: { $ne: 'Cancelled' }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: `This doctor already has a booking within this ${APPOINTMENT_SLOT_MINUTES}-minute slot.`
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
        message: `Double booking blocked: this doctor already has an appointment in this ${APPOINTMENT_SLOT_MINUTES}-minute slot.`
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

async function rescheduleAppointment(req, res) {
  const { appointmentDate } = req.body;
  const cleanDate = normaliseAppointmentDate(appointmentDate);

  if (!cleanDate) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid appointment date and time.'
    });
  }

  if (!isValidAppointmentSlot(cleanDate)) {
    return res.status(400).json({
      success: false,
      message: `Appointments must start on a ${APPOINTMENT_SLOT_MINUTES}-minute slot.`
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

    const slotStart = cleanDate;
    const slotEnd = new Date(slotStart.getTime() + APPOINTMENT_SLOT_MS);
    const previousSlotStart = new Date(slotStart.getTime() - APPOINTMENT_SLOT_MS);

    const existingAppointment = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctor: appointment.doctor,
      appointmentDate: {
        $gt: previousSlotStart,
        $lt: slotEnd
      },
      status: { $ne: 'Cancelled' }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: `This doctor already has a booking within this ${APPOINTMENT_SLOT_MINUTES}-minute slot.`
      });
    }

    appointment.appointmentDate = cleanDate;
    appointment.status = 'Scheduled';

    await appointment.save();

    return res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully.',
      appointment
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not reschedule appointment.'
    });
  }
}

module.exports = {
  getAppointmentsPage,
  getCreateAppointmentPage,
  getAppointmentOptions,
  getDoctorAvailability,
  listAppointments,
  createAppointment,
  updateAppointmentStatus,
  rescheduleAppointment
};
