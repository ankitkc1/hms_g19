const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const appointmentController = require('../controllers/appointmentController');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const {
  createMockRequest,
  createMockResponse,
  createQueryChain,
  stub
} = require('./helpers');

function validObjectId() {
  return new mongoose.Types.ObjectId().toString();
}

describe('appointmentController', () => {
  const originals = {};

  beforeEach(() => {
    originals.appointmentFind = Appointment.find;
    originals.appointmentFindOne = Appointment.findOne;
    originals.appointmentCreate = Appointment.create;
    originals.patientFind = Patient.find;
    originals.patientFindOne = Patient.findOne;
    originals.patientFindById = Patient.findById;
    originals.userFind = User.find;
    originals.userFindOne = User.findOne;
  });

  afterEach(() => {
    Appointment.find = originals.appointmentFind;
    Appointment.findOne = originals.appointmentFindOne;
    Appointment.create = originals.appointmentCreate;
    Patient.find = originals.patientFind;
    Patient.findOne = originals.patientFindOne;
    Patient.findById = originals.patientFindById;
    User.find = originals.userFind;
    User.findOne = originals.userFindOne;
  });

  it('loads appointment form options with sorted patient and doctor query chains', async () => {
    const patientChain = createQueryChain([
      { patientId: 'PAT-0001', firstName: 'Asha', lastName: 'Pandey' }
    ]);
    const doctorChain = createQueryChain([
      { email: 'doctor@hospital.test', role: 'doctor' }
    ]);
    Patient.find = stub(() => patientChain);
    User.find = stub(() => doctorChain);

    const req = createMockRequest();
    const res = createMockResponse();

    await appointmentController.getAppointmentOptions(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.patients.length, 1);
    assert.deepEqual(User.find.calls[0][0], { role: 'doctor' });
    assert.deepEqual(patientChain.calls, [
      ['sort', { firstName: 1, lastName: 1 }],
      ['select', 'patientId firstName lastName phone email']
    ]);
    assert.deepEqual(doctorChain.calls, [
      ['sort', { email: 1 }],
      ['select', 'email role']
    ]);
  });

  it('rejects doctor availability requests with an invalid doctor id', async () => {
    Appointment.find = stub(() => createQueryChain([]));

    const req = createMockRequest({
      query: { doctor: 'invalid-id', date: '2026-06-01' }
    });
    const res = createMockResponse();

    await appointmentController.getDoctorAvailability(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Please select a valid doctor.');
    assert.equal(Appointment.find.calls.length, 0);
  });

  it('rejects doctor availability requests with an invalid day string', async () => {
    Appointment.find = stub(() => createQueryChain([]));

    const req = createMockRequest({
      query: { doctor: validObjectId(), date: '01-06-2026' }
    });
    const res = createMockResponse();

    await appointmentController.getDoctorAvailability(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Please select a valid appointment date.');
    assert.equal(Appointment.find.calls.length, 0);
  });

  it('returns unavailable 15-minute slots for non-cancelled doctor appointments', async () => {
    const doctor = validObjectId();
    const appointmentChain = createQueryChain([
      { appointmentDate: new Date('2026-06-01T10:00:00') },
      { appointmentDate: new Date('2026-06-01T10:30:00') }
    ]);
    Appointment.find = stub(() => appointmentChain);

    const req = createMockRequest({
      query: { doctor, date: '2026-06-01' }
    });
    const res = createMockResponse();

    await appointmentController.getDoctorAvailability(req, res);

    const query = Appointment.find.calls[0][0];
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.slotMinutes, 15);
    assert.deepEqual(res.body.unavailableSlots, [
      { label: '10:00' },
      { label: '10:30' }
    ]);
    assert.equal(query.doctor, doctor);
    assert.equal(query.status.$ne, 'Cancelled');
    assert.ok(query.appointmentDate.$gte instanceof Date);
    assert.ok(query.appointmentDate.$lt instanceof Date);
    assert.deepEqual(appointmentChain.calls, [
      ['sort', { appointmentDate: 1 }],
      ['select', 'appointmentDate']
    ]);
  });

  it('lists only a doctor user appointment set and summarizes appointment statuses', async () => {
    const doctorId = validObjectId();
    const appointmentChain = createQueryChain([
      { status: 'Scheduled' },
      { status: 'Completed' },
      { status: 'Cancelled' },
      { status: 'Scheduled' }
    ]);
    Appointment.find = stub(() => appointmentChain);

    const req = createMockRequest({
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await appointmentController.listAppointments(req, res);

    assert.deepEqual(Appointment.find.calls[0][0], { doctor: doctorId });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.summary, {
      total: 4,
      scheduled: 2,
      completed: 1,
      cancelled: 1
    });
    assert.deepEqual(appointmentChain.calls, [
      ['populate', 'patient'],
      ['populate', 'doctor'],
      ['sort', { appointmentDate: 1 }]
    ]);
  });

  it('maps patient-role users to their linked patient record before listing appointments', async () => {
    const userId = validObjectId();
    const linkedPatientId = validObjectId();
    Patient.findOne = stub(async () => ({ _id: linkedPatientId }));
    Appointment.find = stub(() => createQueryChain([{ status: 'Scheduled' }]));

    const req = createMockRequest({
      sessionUser: { id: userId, role: 'patient' }
    });
    const res = createMockResponse();

    await appointmentController.listAppointments(req, res);

    assert.deepEqual(Patient.findOne.calls[0][0], { linkedUser: userId });
    assert.deepEqual(Appointment.find.calls[0][0], { patient: linkedPatientId });
    assert.equal(res.body.summary.total, 1);
  });

  it('rejects appointment creation with invalid ids, non-slot time, and blank reason', async () => {
    Patient.findById = stub(async () => ({}));
    User.findOne = stub(async () => ({}));
    Appointment.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {
        patient: 'patient_not registered',
        doctor: 'bad-doctor',
        appointmentDate: '2026-06-01T10:07:35',
        reason: '   '
      },
      sessionUser: { id: validObjectId(), role: 'reception' }
    });
    const res = createMockResponse();

    await appointmentController.createAppointment(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(res.body.errors).sort(), [
      'appointmentDate',
      'doctor',
      'patient',
      'reason'
    ]);
    assert.equal(Patient.findById.calls.length, 0);
    assert.equal(User.findOne.calls.length, 0);
    assert.equal(Appointment.create.calls.length, 0);
  });

  it('returns not found when the selected appointment patient does not exist', async () => {
    Patient.findById = stub(async () => null);
    User.findOne = stub(async () => ({ _id: validObjectId(), role: 'doctor' }));

    const req = createMockRequest({
      body: {
        patient: validObjectId(),
        doctor: validObjectId(),
        appointmentDate: '2026-06-01T10:00:35',
        reason: 'Follow-up review'
      },
      sessionUser: { id: validObjectId(), role: 'reception' }
    });
    const res = createMockResponse();

    await appointmentController.createAppointment(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Selected patient was not found.');
  });

  it('blocks creating an appointment when the doctor has an overlapping non-cancelled booking', async () => {
    const patient = validObjectId();
    const doctor = validObjectId();
    Patient.findById = stub(async () => ({ _id: patient }));
    User.findOne = stub(async () => ({ _id: doctor, role: 'doctor' }));
    Appointment.findOne = stub(async () => ({ _id: validObjectId() }));
    Appointment.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {
        patient,
        doctor,
        appointmentDate: '2026-06-01T10:00:35',
        reason: 'Follow-up review'
      },
      sessionUser: { id: validObjectId(), role: 'reception' }
    });
    const res = createMockResponse();

    await appointmentController.createAppointment(req, res);

    const conflictQuery = Appointment.findOne.calls[0][0];
    assert.equal(res.statusCode, 409);
    assert.equal(conflictQuery.doctor, doctor);
    assert.equal(conflictQuery.status.$ne, 'Cancelled');
    assert.ok(conflictQuery.appointmentDate.$gt instanceof Date);
    assert.ok(conflictQuery.appointmentDate.$lt instanceof Date);
    assert.equal(Appointment.create.calls.length, 0);
  });

  it('creates a clean scheduled appointment when patient, doctor, and slot are valid', async () => {
    const patient = validObjectId();
    const doctor = validObjectId();
    const createdBy = validObjectId();
    Patient.findById = stub(async () => ({ _id: patient }));
    User.findOne = stub(async () => ({ _id: doctor, role: 'doctor' }));
    Appointment.findOne = stub(async () => null);
    Appointment.create = stub(async (payload) => ({
      _id: validObjectId(),
      status: 'Scheduled',
      ...payload
    }));

    const req = createMockRequest({
      body: {
        patient,
        doctor,
        appointmentDate: '2026-06-01T10:00:35',
        reason: '  Follow-up review  '
      },
      sessionUser: { id: createdBy, role: 'reception' }
    });
    const res = createMockResponse();

    await appointmentController.createAppointment(req, res);

    const payload = Appointment.create.calls[0][0];
    assert.equal(res.statusCode, 201);
    assert.equal(payload.patient, patient);
    assert.equal(payload.doctor, doctor);
    assert.equal(payload.reason, 'Follow-up review');
    assert.equal(payload.createdBy, createdBy);
    assert.equal(payload.appointmentDate.getMinutes(), 0);
    assert.equal(payload.appointmentDate.getSeconds(), 0);
    assert.equal(payload.appointmentDate.getMilliseconds(), 0);
  });
});
