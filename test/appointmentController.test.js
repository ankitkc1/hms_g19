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

function id() {
  return new mongoose.Types.ObjectId().toString();
}

function goodAppointment(overrides = {}) {
  return {
    patient: id(),
    doctor: id(),
    appointmentDate: '2026-06-01T10:00:35',
    reason: 'Follow-up review',
    ...overrides
  };
}

describe('appointmentController', () => {
  const original = {};

  beforeEach(() => {
    original.appointmentFind = Appointment.find;
    original.appointmentFindOne = Appointment.findOne;
    original.appointmentCreate = Appointment.create;
    original.patientFind = Patient.find;
    original.patientFindOne = Patient.findOne;
    original.patientFindById = Patient.findById;
    original.userFind = User.find;
    original.userFindOne = User.findOne;
  });

  afterEach(() => {
    Appointment.find = original.appointmentFind;
    Appointment.findOne = original.appointmentFindOne;
    Appointment.create = original.appointmentCreate;
    Patient.find = original.patientFind;
    Patient.findOne = original.patientFindOne;
    Patient.findById = original.patientFindById;
    User.find = original.userFind;
    User.findOne = original.userFindOne;
  });

  it('loads patients and doctors for the appointment form', async () => {
    Patient.find = stub(() => createQueryChain([
      { patientId: 'PAT-0001', firstName: 'Asha' }
    ]));
    User.find = stub(() => createQueryChain([
      { email: 'doctor@hospital.test', role: 'doctor' }
    ]));

    const req = createMockRequest();
    const res = createMockResponse();

    await appointmentController.getAppointmentOptions(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.patients.length, 1);
    assert.equal(res.body.doctors.length, 1);
    assert.deepEqual(User.find.calls[0][0], { role: 'doctor' });
  });

  it('rejects doctor availability with a bad doctor id', async () => {
    Appointment.find = stub(() => createQueryChain([]));

    const req = createMockRequest({
      query: { doctor: 'bad-id', date: '2026-06-01' }
    });
    const res = createMockResponse();

    await appointmentController.getDoctorAvailability(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Please select a valid doctor.');
    assert.equal(Appointment.find.calls.length, 0);
  });

  it('rejects doctor availability with a bad date', async () => {
    Appointment.find = stub(() => createQueryChain([]));

    const req = createMockRequest({
      query: { doctor: id(), date: '01-06-2026' }
    });
    const res = createMockResponse();

    await appointmentController.getDoctorAvailability(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Please select a valid appointment date.');
    assert.equal(Appointment.find.calls.length, 0);
  });

  it('shows unavailable doctor slots for a day', async () => {
    const doctor = id();
    Appointment.find = stub(() => createQueryChain([
      { appointmentDate: new Date('2026-06-01T10:00:00') },
      { appointmentDate: new Date('2026-06-01T10:30:00') }
    ]));

    const req = createMockRequest({
      query: { doctor, date: '2026-06-01' }
    });
    const res = createMockResponse();

    await appointmentController.getDoctorAvailability(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.slotMinutes, 15);
    assert.deepEqual(res.body.unavailableSlots, [
      { label: '10:00' },
      { label: '10:30' }
    ]);
    assert.equal(Appointment.find.calls[0][0].doctor, doctor);
  });

  it("lists a doctor's appointments and summary counts", async () => {
    const doctorId = id();
    Appointment.find = stub(() => createQueryChain([
      { status: 'Scheduled' },
      { status: 'Completed' },
      { status: 'Cancelled' },
      { status: 'Scheduled' }
    ]));

    const req = createMockRequest({
      sessionUser: { id: doctorId, role: 'doctor' }
    });
    const res = createMockResponse();

    await appointmentController.listAppointments(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(Appointment.find.calls[0][0], { doctor: doctorId });
    assert.deepEqual(res.body.summary, {
      total: 4,
      scheduled: 2,
      completed: 1,
      cancelled: 1
    });
  });

  it('lists linked appointments for a patient user', async () => {
    const userId = id();
    const patientId = id();
    Patient.findOne = stub(async () => ({ _id: patientId }));
    Appointment.find = stub(() => createQueryChain([{ status: 'Scheduled' }]));

    const req = createMockRequest({
      sessionUser: { id: userId, role: 'patient' }
    });
    const res = createMockResponse();

    await appointmentController.listAppointments(req, res);

    assert.deepEqual(Patient.findOne.calls[0][0], { linkedUser: userId });
    assert.deepEqual(Appointment.find.calls[0][0], { patient: patientId });
    assert.equal(res.body.summary.total, 1);
  });

  it('does not create an appointment with bad input', async () => {
    Patient.findById = stub(async () => ({}));
    User.findOne = stub(async () => ({}));
    Appointment.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {
        patient: 'bad-patient',
        doctor: 'bad-doctor',
        appointmentDate: '2026-06-01T10:07:35',
        reason: '   '
      },
      sessionUser: { id: id(), role: 'reception' }
    });
    const res = createMockResponse();

    await appointmentController.createAppointment(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.patient, 'Please select a valid patient.');
    assert.equal(res.body.errors.doctor, 'Please select a valid doctor.');
    assert.equal(res.body.errors.reason, 'Reason is required.');
    assert.equal(Appointment.create.calls.length, 0);
  });

  it('returns not found when the selected patient does not exist', async () => {
    Patient.findById = stub(async () => null);
    User.findOne = stub(async () => ({ _id: id(), role: 'doctor' }));

    const req = createMockRequest({
      body: goodAppointment(),
      sessionUser: { id: id(), role: 'reception' }
    });
    const res = createMockResponse();

    await appointmentController.createAppointment(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Selected patient was not found.');
  });

  it('blocks an appointment when the doctor already has that slot', async () => {
    const body = goodAppointment();
    Patient.findById = stub(async () => ({ _id: body.patient }));
    User.findOne = stub(async () => ({ _id: body.doctor, role: 'doctor' }));
    Appointment.findOne = stub(async () => ({ _id: id() }));
    Appointment.create = stub(async () => ({}));

    const req = createMockRequest({
      body,
      sessionUser: { id: id(), role: 'reception' }
    });
    const res = createMockResponse();

    await appointmentController.createAppointment(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'This doctor already has a booking within this 15-minute slot.');
    assert.equal(Appointment.create.calls.length, 0);
  });

  it('creates an appointment when patient, doctor, and slot are valid', async () => {
    const createdBy = id();
    const body = goodAppointment({ reason: '  Follow-up review  ' });
    Patient.findById = stub(async () => ({ _id: body.patient }));
    User.findOne = stub(async () => ({ _id: body.doctor, role: 'doctor' }));
    Appointment.findOne = stub(async () => null);
    Appointment.create = stub(async (payload) => ({
      _id: id(),
      status: 'Scheduled',
      ...payload
    }));

    const req = createMockRequest({
      body,
      sessionUser: { id: createdBy, role: 'reception' }
    });
    const res = createMockResponse();

    await appointmentController.createAppointment(req, res);

    const savedAppointment = Appointment.create.calls[0][0];
    assert.equal(res.statusCode, 201);
    assert.equal(savedAppointment.patient, body.patient);
    assert.equal(savedAppointment.doctor, body.doctor);
    assert.equal(savedAppointment.reason, 'Follow-up review');
    assert.equal(savedAppointment.createdBy, createdBy);
    assert.equal(savedAppointment.appointmentDate.getSeconds(), 0);
  });
});
