const assert = require('node:assert/strict');

const patientController = require('../controllers/patientController');
const Patient = require('../models/Patient');
const {
  createMockRequest,
  createMockResponse,
  stub
} = require('./helpers');

describe('patientController', () => {
  const originals = {};

  beforeEach(() => {
    originals.countDocuments = Patient.countDocuments;
    originals.create = Patient.create;
    originals.findByIdAndUpdate = Patient.findByIdAndUpdate;
  });

  afterEach(() => {
    Patient.countDocuments = originals.countDocuments;
    Patient.create = originals.create;
    Patient.findByIdAndUpdate = originals.findByIdAndUpdate;
  });

  it('rejects patient registration when required demographics and contact fields are missing', async () => {
    Patient.countDocuments = stub(async () => 0);
    Patient.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {},
      sessionUser: { id: 'reception-1', role: 'reception' }
    });
    const res = createMockResponse();

    await patientController.createPatient(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Please fix the highlighted fields.');
    assert.deepEqual(Object.keys(res.body.errors).sort(), [
      'address',
      'dateOfBirth',
      'emergencyContactName',
      'emergencyContactPhone',
      'firstName',
      'gender',
      'lastName',
      'phone'
    ]);
    assert.equal(Patient.countDocuments.calls.length, 0);
    assert.equal(Patient.create.calls.length, 0);
  });

  it('creates a patient with a generated ID, trimmed values, lowercase email, and creator id', async () => {
    Patient.countDocuments = stub(async () => 41);
    Patient.create = stub(async (payload) => ({
      _id: 'patient-db-id',
      ...payload
    }));

    const req = createMockRequest({
      body: {
        firstName: 'Alicia',
        lastName: 'whatever',
        dateOfBirth: '1988-04-19',
        gender: 'female',
        phone: ' 0400111222',
        email: ' ALICIA@gmail.COM',
        address: ' 12 River Road',
        emergencyContactName: 'Meinea',
        emergencyContactPhone: '0400333444 '
      },
      sessionUser: { id: 'admin-1', role: 'admin' }
    });
    const res = createMockResponse();

    await patientController.createPatient(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.patient.patientId, 'PAT-0042');
    assert.deepEqual(Patient.create.calls[0][0], {
      firstName: 'Alicia',
      lastName: 'whatever',
      dateOfBirth: '1988-04-19',
      gender: 'female',
      phone: '0400111222',
      email: 'alicia@gmail.com',
      address: '12 River Road',
      emergencyContactName: 'Meinea',
      emergencyContactPhone: '0400333444',
      patientId: 'PAT-0042',
      createdBy: 'admin-1'
    });
  });

  it('returns a duplicate-patient conflict when Mongo reports a unique index violation', async () => {
    Patient.countDocuments = stub(async () => 0);
    Patient.create = stub(async () => {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    });

    const req = createMockRequest({
      body: {
        firstName: 'Alicia',
        lastName: 'whatever',
        dateOfBirth: '1988-04-19',
        gender: 'female',
        phone: '0400111222',
        address: '12 River Road',
        emergencyContactName: 'Mei Ng',
        emergencyContactPhone: '0400 333 444'
      },
      sessionUser: { id: 'admin-1', role: 'admin' }
    });
    const res = createMockResponse();

    await patientController.createPatient(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'A patient with this information already exists.');
  });

  it('returns a server error when patient registration fails unexpectedly', async () => {
    Patient.countDocuments = stub(async () => 0);
    Patient.create = stub(async () => {
      throw new Error('database down');
    });

    const req = createMockRequest({
      body: {
        firstName: 'Alicia',
        lastName: 'whatever',
        dateOfBirth: '1988-04-19',
        gender: 'female',
        phone: '0400111222',
        address: '12 River Road',
        emergencyContactName: 'Meinea',
        emergencyContactPhone: '0400333444'
      },
      sessionUser: { id: 'admin-1', role: 'admin' }
    });
    const res = createMockResponse();

    await patientController.createPatient(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Something went wrong while registering the patient.');
  });

  it('rejects non-clinical updates when required contact fields are missing', async () => {
    Patient.findByIdAndUpdate = stub(async () => ({}));

    const req = createMockRequest({
      params: { id: 'patient-1' },
      body: { email: 'missing@gmaicom' }
    });
    const res = createMockResponse();

    await patientController.updatePatientNonClinical(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(res.body.errors).sort(), [
      'address',
      'emergencyContactName',
      'emergencyContactPhone',
      'phone'
    ]);
    assert.equal(Patient.findByIdAndUpdate.calls.length, 0);
  });

  it('updates only allowed non-clinical fields with normalized contact data', async () => {
    Patient.findByIdAndUpdate = stub(async (id, updates) => ({
      _id: id,
      ...updates
    }));

    const req = createMockRequest({
      params: { id: 'patient-1' },
      body: {
        firstName: 'Should be ignored',
        diagnosis: 'Should also be ignored',
        phone: '2452110089',
        email: ' missing@gmail.com',
        address: ' 8 Kevin Street ',
        emergencyContactName: 'Kai',
        emergencyContactPhone: '2514851124'
      }
    });
    const res = createMockResponse();

    await patientController.updatePatientNonClinical(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(Patient.findByIdAndUpdate.calls[0], [
      'patient-1',
      {
        phone: '2452110089',
        email: 'missing@gmail.com',
        address: '8 Kevin Street',
        emergencyContactName: 'Kai',
        emergencyContactPhone: '2514851124'
      },
      {
        new: true,
        runValidators: true
      }
    ]);
    assert.equal(res.body.patient.firstName, undefined);
  });

  it('returns not found when a non-clinical update targets an unknown patient', async () => {
    Patient.findByIdAndUpdate = stub(async () => null);

    const req = createMockRequest({
      params: { id: 'missing-patient' },
      body: {
        phone: '254562001',
        address: '8 Kevin Street',
        emergencyContactName: 'Kai',
        emergencyContactPhone: '2514851124'
      }
    });
    const res = createMockResponse();

    await patientController.updatePatientNonClinical(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Patient not found.');
  });

  it('returns a server error when a non-clinical update throws', async () => {
    Patient.findByIdAndUpdate = stub(async () => {
      throw new Error('write failed');
    });

    const req = createMockRequest({
      params: { id: 'patient-1' },
      body: {
        phone: '254562001',
        address: '8 Kevin Street',
        emergencyContactName: 'Kai',
        emergencyContactPhone: '2514851124'
      }
    });
    const res = createMockResponse();

    await patientController.updatePatientNonClinical(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Could not update patient information.');
  });
});
