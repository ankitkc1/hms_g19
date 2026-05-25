const path = require('path');
const NurseObservation = require('../models/NurseObservation');
const Patient = require('../models/Patient');
const logAction = require('../utils/auditLogger');

function getObservationPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'nurse-observations.html'));
}

async function getPatientObservations(req, res) {
  try {
    const observations = await NurseObservation.find({ patient: req.params.patientId })
      .populate('nurse', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({ success: true, observations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load observations.' });
  }
}

async function createObservation(req, res) {
  const observation = String(req.body.observation || '').trim();
  const careNote = String(req.body.careNote || '').trim();

  if (!observation || !careNote) {
    return res.status(400).json({ success: false, message: 'Observation and care note are required.' });
  }

  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' });

    const note = await NurseObservation.create({
      patient: req.params.patientId,
      nurse: req.session.user.id,
      observation,
      careNote,
      temperature: req.body.temperature,
      bloodPressure: req.body.bloodPressure,
      heartRate: req.body.heartRate,
      oxygenSaturation: req.body.oxygenSaturation
    });

    await logAction(req, 'CREATE_NURSE_OBSERVATION', 'NurseObservation', note._id, {
      patient: req.params.patientId
    });

    res.status(201).json({ success: true, message: 'Nurse observation added successfully.', observation: note });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not add observation.' });
  }
}

module.exports = { getObservationPage, getPatientObservations, createObservation };