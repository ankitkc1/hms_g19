const mongoose = require('mongoose');

const nurseObservationSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    nurse: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    observation: { type: String, required: true, trim: true, maxlength: 1500 },
    careNote: { type: String, required: true, trim: true, maxlength: 1500 },
    temperature: { type: String, trim: true },
    bloodPressure: { type: String, trim: true },
    heartRate: { type: String, trim: true },
    oxygenSaturation: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('NurseObservation', nurseObservationSchema);