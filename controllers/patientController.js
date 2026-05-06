const path = require('path');
const Patient = require('../models/Patient');

function getCreatePatient(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'patients', 'create.html'));
}

function validatePatientInput(data) {
  const errors = {};

  if (!data.firstName) {
    errors.firstName = 'First name is required.';
  }

  if (!data.lastName) {
    errors.lastName = 'Last name is required.';
  }

  if (!data.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required.';
  }

  if (!data.gender) {
    errors.gender = 'Gender is required.';
  }

  if (!data.phone) {
    errors.phone = 'Phone number is required.';
  }

  if (!data.address) {
    errors.address = 'Address is required.';
  }

  if (!data.emergencyContactName) {
    errors.emergencyContactName = 'Emergency contact name is required.';
  }

  if (!data.emergencyContactPhone) {
    errors.emergencyContactPhone = 'Emergency contact phone is required.';
  }

  return errors;
}

async function generatePatientId() {
  const count = await Patient.countDocuments();
  return `PAT-${String(count + 1).padStart(4, '0')}`;
}

async function createPatient(req, res) {
  const patientData = {
    firstName: String(req.body.firstName || '').trim(),
    lastName: String(req.body.lastName || '').trim(),
    dateOfBirth: req.body.dateOfBirth,
    gender: req.body.gender,
    phone: String(req.body.phone || '').trim(),
    email: String(req.body.email || '').trim().toLowerCase(),
    address: String(req.body.address || '').trim(),
    emergencyContactName: String(req.body.emergencyContactName || '').trim(),
    emergencyContactPhone: String(req.body.emergencyContactPhone || '').trim()
  };

  const errors = validatePatientInput(patientData);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Please fix the highlighted fields.',
      errors
    });
  }

  try {
    const patientId = await generatePatientId();

    const patient = await Patient.create({
      ...patientData,
      patientId,
      createdBy: req.session.user.id
    });

    return res.status(201).json({
      success: true,
      message: `Patient registered successfully. Patient ID: ${patient.patientId}`,
      patient
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A patient with this information already exists.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while registering the patient.'
    });
  }
}

module.exports = {
  getCreatePatient,
  createPatient
};
