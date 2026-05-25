const mongoose = require('mongoose');

const clinicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    diagnosis: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    treatmentNotes: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500
    },
    careInstructions: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500
    },
    patientVisible: {
      type: Boolean,
      default: false
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ClinicalRecord', clinicalRecordSchema);