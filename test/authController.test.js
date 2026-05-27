const assert = require('node:assert/strict');

const authController = require('../controllers/authController');
const User = require('../models/User');
const {
  createMockRequest,
  createMockResponse,
  objectIdLike,
  stub
} = require('./helpers');

describe('authController', () => {
  let originalFindOne;

  beforeEach(() => {
    originalFindOne = User.findOne;
  });

  afterEach(() => {
    User.findOne = originalFindOne;
  });

  it('rejects invalid login input before querying active users', async () => {
    User.findOne = stub(async () => {
      throw new Error('User lookup should not run for invalid input');
    });

    const req = createMockRequest({
      body: { email: 'not-an-email', password: '' },
      session: { regenerate: stub() }
    });
    const res = createMockResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.deepEqual(res.body.errors, {
      email: 'Please enter a valid email address.',
      password: 'Password is required.'
    });
    assert.equal(User.findOne.calls.length, 0);
  });

  it('normalizes email and rejects unknown users', async () => {
    User.findOne = stub(async () => null);

    const req = createMockRequest({
      body: { email: ' Doctor@Hospital.TEST ', password: 'secret123' }
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

  it('rejects an existing user when the password does not match', async () => {
    const comparePassword = stub(async () => false);
    User.findOne = stub(async () => ({
      _id: objectIdLike('user-1'),
      email: 'doctor@hospital.test',
      role: 'doctor',
      comparePassword
    }));

    const req = createMockRequest({
      body: { email: 'doctor@hospital.test', password: 'wrong-password' },
      session: { regenerate: stub() }
    });
    const res = createMockResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Please enter a valid password');
    assert.equal(comparePassword.calls[0][0], 'wrong-password');
    assert.equal(req.session.user, undefined);
  });

  it('returns a session error when regeneration fails after valid credentials', async () => {
    User.findOne = stub(async () => ({
      _id: objectIdLike('user-2'),
      email: 'nurse@hospital.test',
      role: 'nurse',
      comparePassword: stub(async () => true)
    }));

    const req = createMockRequest({
      body: { email: 'nurse@hospital.test', password: 'secret123' },
      session: {
        regenerate(callback) {
          callback(new Error('session store unavailable'));
        }
      }
    });
    const res = createMockResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Could not start a secure session.');
    assert.equal(req.session.user, undefined);
  });

  it('creates a session and returns the role-specific redirect for valid credentials', async () => {
    User.findOne = stub(async () => ({
      _id: objectIdLike('doctor-123'),
      email: 'doctor@hospital.test',
      role: 'doctor',
      comparePassword: stub(async () => true)
    }));

    const req = createMockRequest({
      body: { email: 'doctor@hospital.test', password: 'secret123' },
      session: {
        regenerate(callback) {
          callback();
        }
      }
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

  it('destroys the session, clears the cookie, and returns login redirect on logout', () => {
    const req = createMockRequest({
      session: {
        destroy(callback) {
          callback();
        }
      }
    });
    const res = createMockResponse();

    authController.logout(req, res);

    assert.deepEqual(res.clearedCookies, ['hms.sid']);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.redirectUrl, '/login');
  });

  it('clears the cookie and reports logout failure when session destruction errors', () => {
    const req = createMockRequest({
      session: {
        destroy(callback) {
          callback(new Error('destroy failed'));
        }
      }
    });
    const res = createMockResponse();

    authController.logout(req, res);

    assert.deepEqual(res.clearedCookies, ['hms.sid']);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Logout failed. Please try again.');
  });

  it('returns the authenticated session user from the current-user endpoint', () => {
    const sessionUser = {
      id: 'admin-1',
      email: 'admin@hospital.test',
      role: 'admin'
    };
    const req = createMockRequest({ sessionUser });
    const res = createMockResponse();

    authController.getCurrentUser(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      user: sessionUser
    });
  });
});
