const assert = require('node:assert/strict');

const patientController = require('../controllers/patientController');
const Patient = require('../models/Patient');
const {
  createMockRequest,
  createMockResponse,
  stub
} = require('./helpers');

function goodPatient(overrides = {}) {
  return {
    firstName: 'Alicia',
    lastName: 'Ng',
    dateOfBirth: '1988-04-19',
    gender: 'female',
    phone: '0400111222',
    email: 'alicia@gmail.com',
    address: '12 River Road',
    emergencyContactName: 'Mei Ng',
    emergencyContactPhone: '0400333444',
    ...overrides
  };
}

function goodContact(overrides = {}) {
  return {
    phone: '2452110089',
    email: 'patient@gmail.com',
    address: '8 Kevin Street',
    emergencyContactName: 'Kai',
    emergencyContactPhone: '2514851124',
    ...overrides
  };
}

describe('patientController', () => {
  const original = {};

  beforeEach(() => {
    original.countDocuments = Patient.countDocuments;
    original.create = Patient.create;
    original.findByIdAndUpdate = Patient.findByIdAndUpdate;
  });

  afterEach(() => {
    Patient.countDocuments = original.countDocuments;
    Patient.create = original.create;
    Patient.findByIdAndUpdate = original.findByIdAndUpdate;
  });

  it('does not register a patient when required fields are missing', async () => {
    Patient.countDocuments = stub(async () => 0);
    Patient.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {},
      sessionUser: { id: 'reception-1', role: 'reception' }
    });
    const res = createMockResponse();

    await patientController.createPatient(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.firstName, 'First name is required.');
    assert.equal(res.body.errors.phone, 'Phone number is required.');
    assert.equal(Patient.create.calls.length, 0);
  });

  it('registers a patient with a generated patient id', async () => {
    Patient.countDocuments = stub(async () => 41);
    Patient.create = stub(async (payload) => ({
      _id: 'patient-db-id',
      ...payload
    }));

    const req = createMockRequest({
      body: goodPatient({
        email: ' ALICIA@gmail.COM',
        phone: ' 0400111222 ',
        address: ' 12 River Road '
      }),
      sessionUser: { id: 'admin-1', role: 'admin' }
    });
    const res = createMockResponse();

    await patientController.createPatient(req, res);

    const savedPatient = Patient.create.calls[0][0];
    assert.equal(res.statusCode, 201);
    assert.equal(savedPatient.patientId, 'PAT-0042');
    assert.equal(savedPatient.email, 'alicia@gmail.com');
    assert.equal(savedPatient.phone, '0400111222');
    assert.equal(savedPatient.address, '12 River Road');
    assert.equal(savedPatient.createdBy, 'admin-1');
  });

  it('returns a conflict when the patient already exists', async () => {
    Patient.countDocuments = stub(async () => 0);
    Patient.create = stub(async () => {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    });

    const req = createMockRequest({
      body: goodPatient(),
      sessionUser: { id: 'admin-1', role: 'admin' }
    });
    const res = createMockResponse();

    await patientController.createPatient(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'A patient with this information already exists.');
  });

  it('returns a server error when patient registration fails', async () => {
    Patient.countDocuments = stub(async () => 0);
    Patient.create = stub(async () => {
      throw new Error('database down');
    });

    const req = createMockRequest({
      body: goodPatient(),
      sessionUser: { id: 'admin-1', role: 'admin' }
    });
    const res = createMockResponse();

    await patientController.createPatient(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Something went wrong while registering the patient.');
  });

  it('does not update contact details when required fields are missing', async () => {
    Patient.findByIdAndUpdate = stub(async () => ({}));

    const req = createMockRequest({
      params: { id: 'patient-1' },
      body: { email: 'missing@gmail.com' }
    });
    const res = createMockResponse();

    await patientController.updatePatientNonClinical(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.phone, 'Phone number is required.');
    assert.equal(res.body.errors.address, 'Address is required.');
    assert.equal(Patient.findByIdAndUpdate.calls.length, 0);
  });

  it('updates only the allowed contact fields', async () => {
    Patient.findByIdAndUpdate = stub(async (id, updates) => ({
      _id: id,
      ...updates
    }));

    const req = createMockRequest({
      params: { id: 'patient-1' },
      body: goodContact({
        firstName: 'Should be ignored',
        diagnosis: 'Should also be ignored',
        email: ' PATIENT@gmail.COM ',
        address: ' 8 Kevin Street '
      })
    });
    const res = createMockResponse();

    await patientController.updatePatientNonClinical(req, res);

    const updates = Patient.findByIdAndUpdate.calls[0][1];
    assert.equal(res.statusCode, 200);
    assert.equal(updates.email, 'patient@gmail.com');
    assert.equal(updates.address, '8 Kevin Street');
    assert.equal(updates.firstName, undefined);
    assert.equal(updates.diagnosis, undefined);
  });

  it('returns not found when updating a missing patient', async () => {
    Patient.findByIdAndUpdate = stub(async () => null);

    const req = createMockRequest({
      params: { id: 'missing-patient' },
      body: goodContact({ email: '' })
    });
    const res = createMockResponse();

    await patientController.updatePatientNonClinical(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Patient not found.');
  });

  it('returns a server error when contact update fails', async () => {
    Patient.findByIdAndUpdate = stub(async () => {
      throw new Error('write failed');
    });

    const req = createMockRequest({
      params: { id: 'patient-1' },
      body: goodContact({ email: '' })
    });
    const res = createMockResponse();

    await patientController.updatePatientNonClinical(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Could not update patient information.');
  });
});
