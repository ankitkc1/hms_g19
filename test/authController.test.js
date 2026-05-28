const assert = require('node:assert/strict');

const authController = require('../controllers/authController');
const User = require('../models/User');
const {
  createMockRequest,
  createMockResponse,
  objectIdLike,
  stub
} = require('./helpers');

function workingSession() {
  return {
    regenerate(callback) {
      callback();
    }
  };
}

function user(overrides = {}) {
  return {
    _id: objectIdLike('user-1'),
    email: 'doctor@hospital.test',
    role: 'doctor',
    comparePassword: stub(async () => true),
    ...overrides
  };
}

describe('authController', () => {
  let originalFindOne;

  beforeEach(() => {
    originalFindOne = User.findOne;
  });

  afterEach(() => {
    User.findOne = originalFindOne;
  });

  it('does not login with a bad email or blank password', async () => {
    User.findOne = stub(async () => null);

    const req = createMockRequest({
      body: { email: 'not-an-email', password: '' },
      session: workingSession()
    });
    const res = createMockResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.email, 'Please enter a valid email address.');
    assert.equal(res.body.errors.password, 'Password is required.');
    assert.equal(User.findOne.calls.length, 0);
  });

  it('does not login when the email is not registered', async () => {
    User.findOne = stub(async () => null);

    const req = createMockRequest({
      body: { email: ' Doctor@Hospital.TEST ', password: 'secret123' },
      session: workingSession()
    });
    const res = createMockResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Email is not registered');
    assert.deepEqual(User.findOne.calls[0][0], {
      email: 'doctor@hospital.test',
      isActive: true
    });
  });

  it('does not login when the password is wrong', async () => {
    const comparePassword = stub(async () => false);
    User.findOne = stub(async () => user({ comparePassword }));

    const req = createMockRequest({
      body: { email: 'doctor@hospital.test', password: 'wrong-password' },
      session: workingSession()
    });
    const res = createMockResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Please enter a valid password');
    assert.equal(comparePassword.calls[0][0], 'wrong-password');
    assert.equal(req.session.user, undefined);
  });

  it('returns an error when the session cannot be regenerated', async () => {
    User.findOne = stub(async () => user());

    const req = createMockRequest({
      body: { email: 'doctor@hospital.test', password: 'secret123' },
      session: {
        regenerate(callback) {
          callback(new Error('session failed'));
        }
      }
    });
    const res = createMockResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Could not start a secure session.');
    assert.equal(req.session.user, undefined);
  });

  it('logs in a valid doctor and returns the doctor dashboard', async () => {
    User.findOne = stub(async () => user({
      _id: objectIdLike('doctor-123')
    }));

    const req = createMockRequest({
      body: { email: 'doctor@hospital.test', password: 'secret123' },
      session: workingSession()
    });
    const res = createMockResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(req.session.user, {
      id: 'doctor-123',
      email: 'doctor@hospital.test',
      role: 'doctor'
    });
    assert.equal(res.body.redirectUrl, '/dashboard/doctor');
  });

  it('logs out and clears the session cookie', () => {
    const req = createMockRequest({
      session: {
        destroy(callback) {
          callback();
        }
      }
    });
    const res = createMockResponse();

    authController.logout(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.clearedCookies, ['hms.sid']);
    assert.equal(res.body.redirectUrl, '/login');
  });

  it('shows an error when logout fails', () => {
    const req = createMockRequest({
      session: {
        destroy(callback) {
          callback(new Error('destroy failed'));
        }
      }
    });
    const res = createMockResponse();

    authController.logout(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.clearedCookies, ['hms.sid']);
    assert.equal(res.body.message, 'Logout failed. Please try again.');
  });

  it('returns the current logged in user', () => {
    const sessionUser = {
      id: 'admin-1',
      email: 'admin@hospital.test',
      role: 'admin'
    };
    const req = createMockRequest({ sessionUser });
    const res = createMockResponse();

    authController.getCurrentUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.user, sessionUser);
  });
});
