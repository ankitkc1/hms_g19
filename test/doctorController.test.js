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

function validObjectId() {
  return new mongoose.Types.ObjectId().toString();
}

function patientDoc(id, overrides = {}) {
  return {
    _id: objectIdLike(id),
    patientId: 'PAT-0007',
    firstName: 'Sam',
    lastName: 'Patel',
    dateOfBirth: new Date('1991-03-04'),
    gender: 'male',
    phone: '0400 111 222',
    email: 'sam.patel@hms.com',
    address: '10 Kevin Street',
    emergencyContactName: 'Mina Patel',
    emergencyContactPhone: '0400333444',
    ...overrides
  };
}

describe('doctorController', () => {
  const originals = {};

  beforeEach(() => {
    originals.appointmentFind = Appointment.find;
    originals.appointmentFindOne = Appointment.findOne;
    originals.clinicalRecordFind = ClinicalRecord.find;
    originals.clinicalRecordCreate = ClinicalRecord.create;
  });

  afterEach(() => {
    Appointment.find = originals.appointmentFind;
    Appointment.findOne = originals.appointmentFindOne;
    ClinicalRecord.find = originals.clinicalRecordFind;
    ClinicalRecord.create = originals.clinicalRecordCreate;
  });

  it('lists assigned patients once using the latest appointment as the patient summary', async () => {
    const doctorId = validObjectId();
    const patientId = validObjectId();
    const appointmentChain = createQueryChain([
      {
        patient: patientDoc(patientId),
        appointmentDate: new Date('2026-06-03T13:00:00'),
        reason: 'Review blood pressure',
        status: 'Scheduled'
      },
      {
        patient: patientDoc(patientId),
        appointmentDate: new Date('2026-05-01T09:00:00'),
        reason: 'Initial consult',
        status: 'Completed'
      },
      {
        patient: null,
        appointmentDate: new Date('2026-04-01T09:00:00'),
        reason: 'Deleted patient appointment',
        status: 'Cancelled'
      }
    ]);
    Appointment.find = stub(() => appointmentChain);

    const req = createMockRequest({
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.getAssignedPatients(req, res);

    assert.deepEqual(Appointment.find.calls[0][0], { doctor: doctorId });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.patients.length, 1);
    assert.equal(res.body.patients[0].firstName, 'Sam');
    assert.deepEqual(res.body.patients[0].lastAppointment, {
      appointmentDate: new Date('2026-06-03T13:00:00'),
      reason: 'Review blood pressure',
      status: 'Scheduled'
    });
    assert.deepEqual(appointmentChain.calls, [
      ['populate', 'patient'],
      ['sort', { appointmentDate: -1 }]
    ]);
  });

  it('rejects patient detail requests with an invalid patient id', async () => {
    Appointment.findOne = stub(() => createQueryChain(null));

    const req = createMockRequest({
      params: { patientId: 'bad-id' },
      sessionUser: { id: validObjectId(), role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.getAssignedPatientDetails(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid patient ID.');
    assert.equal(Appointment.findOne.calls.length, 0);
  });

  it('blocks patient details when the doctor has no appointment for that patient', async () => {
    const doctorId = validObjectId();
    const patientId = validObjectId();
    Appointment.findOne = stub(() => createQueryChain(null));

    const req = createMockRequest({
      params: { patientId },
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.getAssignedPatientDetails(req, res);

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'You can only view records for patients assigned to you.');
    assert.deepEqual(Appointment.findOne.calls[0][0], {
      doctor: doctorId,
      patient: patientId
    });
  });

  it('returns patient details with appointment history and the doctor-owned clinical records', async () => {
    const doctorId = validObjectId();
    const patientId = validObjectId();
    const detailsChain = createQueryChain({
      patient: patientDoc(patientId),
      doctor: { fullName: 'Dr Ada', email: 'ada@hms.test', role: 'doctor' }
    });
    const appointmentsChain = createQueryChain([
      { appointmentDate: new Date('2026-06-03T13:00:00'), reason: 'Review', status: 'Scheduled' }
    ]);
    const recordsChain = createQueryChain([
      { diagnosis: 'Hypertension', treatmentNotes: 'Adjust medication', careInstructions: 'Daily BP log' }
    ]);
    Appointment.findOne = stub(() => detailsChain);
    Appointment.find = stub(() => appointmentsChain);
    ClinicalRecord.find = stub(() => recordsChain);

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
    assert.deepEqual(Appointment.find.calls[0][0], {
      doctor: doctorId,
      patient: patientId
    });
    assert.deepEqual(ClinicalRecord.find.calls[0][0], {
      patient: patientId,
      doctor: doctorId
    });
    assert.deepEqual(detailsChain.calls, [
      ['populate', 'patient'],
      ['populate', 'doctor', 'fullName email role'],
      ['sort', { appointmentDate: -1 }]
    ]);
  });

  it('validates patient id and required clinical note fields before saving records', async () => {
    Appointment.findOne = stub(async () => ({}));
    ClinicalRecord.create = stub(async () => ({}));

    const req = createMockRequest({
      params: { patientId: 'invalid-id' },
      body: { diagnosis: ' ', treatmentNotes: '', careInstructions: '' },
      sessionUser: { id: validObjectId(), role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.addClinicalRecord(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(res.body.errors).sort(), [
      'careInstructions',
      'diagnosis',
      'patient',
      'treatmentNotes'
    ]);
    assert.equal(Appointment.findOne.calls.length, 0);
    assert.equal(ClinicalRecord.create.calls.length, 0);
  });

  it('rejects clinical notes for patients not assigned to the doctor', async () => {
    const patientId = validObjectId();
    const doctorId = validObjectId();
    Appointment.findOne = stub(async () => null);
    ClinicalRecord.create = stub(async () => ({}));

    const req = createMockRequest({
      params: { patientId },
      body: {
        diagnosis: 'Migraine',
        treatmentNotes: 'Prescribed rest and hydration',
        careInstructions: 'Return if symptoms worsen'
      },
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.addClinicalRecord(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(Appointment.findOne.calls[0][0], {
      doctor: doctorId,
      patient: patientId
    });
    assert.equal(ClinicalRecord.create.calls.length, 0);
  });

  it('creates a trimmed clinical note for an assigned patient', async () => {
    const patientId = validObjectId();
    const doctorId = validObjectId();
    Appointment.findOne = stub(async () => ({ _id: validObjectId() }));
    ClinicalRecord.create = stub(async (payload) => ({
      _id: validObjectId(),
      ...payload
    }));

    const req = createMockRequest({
      params: { patientId },
      body: {
        diagnosis: ' Migraine ',
        treatmentNotes: ' Prescribed rest and hydration ',
        careInstructions: ' Return if symptoms worsen '
      },
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.addClinicalRecord(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(ClinicalRecord.create.calls[0][0], {
      patient: patientId,
      doctor: doctorId,
      diagnosis: 'Migraine',
      treatmentNotes: 'Prescribed rest and hydration',
      careInstructions: 'Return if symptoms worsen'
    });
  });

  it('returns a server error when clinical note creation fails after assignment check', async () => {
    const patientId = validObjectId();
    Appointment.findOne = stub(async () => ({ _id: validObjectId() }));
    ClinicalRecord.create = stub(async () => {
      throw new Error('insert failed');
    });

    const req = createMockRequest({
      params: { patientId },
      body: {
        diagnosis: 'Migraine',
        treatmentNotes: 'Prescribed rest and hydration',
        careInstructions: 'Return if symptoms worsen'
      },
      sessionUser: { id: validObjectId(), role: 'doctor' }
    });
    const res = createMockResponse();

    await doctorController.addClinicalRecord(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Could not add clinical note.');
  });
});
