const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const doctorController = require('../controllers/doctorController');
const Appointment = require('../models/Appointment');
const ClinicalRecord = require('../models/ClinicalRecord');
const {
  createMockRequest,
  createMockResponse,
  createQueryChain,
  objectIdLike,
  stub
} = require('./helpers');

function id() {
  return new mongoose.Types.ObjectId().toString();
}

function patient(patientId = id()) {
  return {
    _id: objectIdLike(patientId),
    patientId: 'PAT-0007',
    firstName: 'Sam',
    lastName: 'Patel',
    dateOfBirth: new Date('1991-03-04'),
    gender: 'male',
    phone: '0400 111 222',
    email: 'sam.patel@hms.com',
    address: '10 Kevin Street',
    emergencyContactName: 'Mina Patel',
    emergencyContactPhone: '0400333444'
  };
}

function clinicalNote(overrides = {}) {
  return {
    diagnosis: 'Migraine',
    treatmentNotes: 'Prescribed rest and hydration',
    careInstructions: 'Return if symptoms worsen',
    ...overrides
  };
}

describe('doctorController', () => {
  const original = {};

  beforeEach(() => {
    original.appointmentFind = Appointment.find;
    original.appointmentFindOne = Appointment.findOne;
    original.clinicalRecordFind = ClinicalRecord.find;
    original.clinicalRecordCreate = ClinicalRecord.create;
  });

  afterEach(() => {
    Appointment.find = original.appointmentFind;
    Appointment.findOne = original.appointmentFindOne;
    ClinicalRecord.find = original.clinicalRecordFind;
    ClinicalRecord.create = original.clinicalRecordCreate;
  });

  it('shows each assigned patient once', async () => {
    const doctorId = id();
    const patientId = id();
    Appointment.find = stub(() => createQueryChain([
      {
        patient: patient(patientId),
        appointmentDate: new Date('2026-06-03T13:00:00'),
        reason: 'Review blood pressure',
        status: 'Scheduled'
      },
      {
        patient: patient(patientId),
        appointmentDate: new Date('2026-05-01T09:00:00'),
        reason: 'Initial consult',
        status: 'Completed'
      },
      { patient: null }
    ]));

    const req = createMockRequest({
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.getAssignedPatients(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.patients.length, 1);
    assert.equal(res.body.patients[0].firstName, 'Sam');
    assert.equal(res.body.patients[0].lastAppointment.reason, 'Review blood pressure');
    assert.deepEqual(Appointment.find.calls[0][0], { doctor: doctorId });
  });

  it('rejects patient details with an invalid patient id', async () => {
    Appointment.findOne = stub(() => createQueryChain(null));

    const req = createMockRequest({
      params: { patientId: 'bad-id' },
      sessionUser: { id: id(), role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.getAssignedPatientDetails(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid patient ID.');
    assert.equal(Appointment.findOne.calls.length, 0);
  });

  it('blocks patient details when the patient is not assigned to the doctor', async () => {
    Appointment.findOne = stub(() => createQueryChain(null));

    const req = createMockRequest({
      params: { patientId: id() },
      sessionUser: { id: id(), role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.getAssignedPatientDetails(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'You can only view records for patients assigned to you.');
  });

  it('returns patient details, appointments, and clinical records', async () => {
    const doctorId = id();
    const patientId = id();
    Appointment.findOne = stub(() => createQueryChain({
      patient: patient(patientId),
      doctor: { fullName: 'Dr Ada', email: 'ada@hms.test', role: 'doctor' }
    }));
    Appointment.find = stub(() => createQueryChain([
      { appointmentDate: new Date('2026-06-03T13:00:00'), reason: 'Review' }
    ]));
    ClinicalRecord.find = stub(() => createQueryChain([
      { diagnosis: 'Hypertension' }
    ]));

    const req = createMockRequest({
      params: { patientId },
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.getAssignedPatientDetails(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.patient.patientId, 'PAT-0007');
    assert.equal(res.body.appointments.length, 1);
    assert.equal(res.body.clinicalRecords[0].diagnosis, 'Hypertension');
    assert.deepEqual(ClinicalRecord.find.calls[0][0], {
      patient: patientId,
      doctor: doctorId
    });
  });

  it('does not save a clinical note with bad input', async () => {
    Appointment.findOne = stub(async () => ({}));
    ClinicalRecord.create = stub(async () => ({}));

    const req = createMockRequest({
      params: { patientId: 'bad-id' },
      body: { diagnosis: ' ', treatmentNotes: '', careInstructions: '' },
      sessionUser: { id: id(), role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.addClinicalRecord(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.patient, 'Invalid patient ID.');
    assert.equal(res.body.errors.diagnosis, 'Diagnosis is required.');
    assert.equal(ClinicalRecord.create.calls.length, 0);
  });

  it('does not save a clinical note for an unassigned patient', async () => {
    Appointment.findOne = stub(async () => null);
    ClinicalRecord.create = stub(async () => ({}));

    const req = createMockRequest({
      params: { patientId: id() },
      body: clinicalNote(),
      sessionUser: { id: id(), role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.addClinicalRecord(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'You can only add records for patients assigned to you.');
    assert.equal(ClinicalRecord.create.calls.length, 0);
  });

  it('saves a clinical note for an assigned patient', async () => {
    const doctorId = id();
    const patientId = id();
    Appointment.findOne = stub(async () => ({ _id: id() }));
    ClinicalRecord.create = stub(async (payload) => ({
      _id: id(),
      ...payload
    }));

    const req = createMockRequest({
      params: { patientId },
      body: clinicalNote({
        diagnosis: ' Migraine ',
        treatmentNotes: ' Prescribed rest and hydration ',
        careInstructions: ' Return if symptoms worsen '
      }),
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.addClinicalRecord(req, res);

    const savedNote = ClinicalRecord.create.calls[0][0];
    assert.equal(res.statusCode, 201);
    assert.equal(savedNote.patient, patientId);
    assert.equal(savedNote.doctor, doctorId);
    assert.equal(savedNote.diagnosis, 'Migraine');
  });

  it('returns a server error when a clinical note cannot be saved', async () => {
    Appointment.findOne = stub(async () => ({ _id: id() }));
    ClinicalRecord.create = stub(async () => {
      throw new Error('insert failed');
    });

    const req = createMockRequest({
      params: { patientId: id() },
      body: clinicalNote(),
      sessionUser: { id: id(), role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.addClinicalRecord(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Could not add clinical note.');
  });
});
