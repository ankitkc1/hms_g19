const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const notificationController = require('../controllers/notificationController');
const Notification = require('../models/Notification');
const User = require('../models/User');
const {
  createMockRequest,
  createMockResponse,
  createQueryChain,
  objectIdLike,
  stub
} = require('./helpers');

const STAFF_ROLES = ['admin', 'reception', 'doctor', 'nurse'];

function id() {
  return new mongoose.Types.ObjectId().toString();
}

function ioStub() {
  const emissions = [];

  return {
    emissions,
    to(room) {
      return {
        emit(event, payload) {
          emissions.push({ room, event, payload });
        }
      };
    }
  };
}

function notificationDoc(overrides = {}) {
  const doc = {
    _id: overrides._id || objectIdLike(id()),
    title: 'Ward update',
    message: 'Policy update',
    audience: 'all',
    createdAt: new Date('2026-06-01T09:00:00'),
    sender: { fullName: 'Admin One', email: 'admin@hospital.test' },
    recipients: [],
    readBy: [],
    ...overrides,
    populate: stub(async () => doc),
    toObject() {
      return {
        _id: this._id,
        title: this.title,
        message: this.message,
        audience: this.audience,
        createdAt: this.createdAt,
        sender: this.sender,
        recipients: this.recipients,
        readBy: this.readBy
      };
    }
  };

  return doc;
}

describe('notificationController', () => {
  const original = {};

  beforeEach(() => {
    original.userFind = User.find;
    original.notificationFind = Notification.find;
    original.notificationCreate = Notification.create;
    original.notificationUpdateMany = Notification.updateMany;
  });

  afterEach(() => {
    User.find = original.userFind;
    Notification.find = original.notificationFind;
    Notification.create = original.notificationCreate;
    Notification.updateMany = original.notificationUpdateMany;
  });

  it('loads staff users for the notification form', async () => {
    User.find = stub(() => createQueryChain([
      { fullName: 'Admin One', email: 'admin@hospital.test', role: 'admin' }
    ]));

    const req = createMockRequest();
    const res = createMockResponse();

    await notificationController.getStaffOptions(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.staff.length, 1);
    assert.deepEqual(User.find.calls[0][0], { role: { $in: STAFF_ROLES } });
  });

  it('does not send a notification without title and message', async () => {
    User.find = stub(() => createQueryChain([]));
    Notification.create = stub(async () => ({}));

    const req = createMockRequest({
      body: { title: '   ', message: '' },
      sessionUser: { id: id(), role: 'admin' }
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.title, 'Title is required.');
    assert.equal(res.body.errors.message, 'Message is required.');
    assert.equal(Notification.create.calls.length, 0);
  });

  it('requires one valid recipient for selected notifications', async () => {
    User.find = stub(() => createQueryChain([]));
    Notification.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {
        title: 'Ward update',
        message: 'Short staffing on level 3.',
        audience: 'selected',
        recipients: ['not-valid', '', null]
      },
      sessionUser: { id: id(), role: 'admin' }
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.recipients, 'Select at least one staff member.');
    assert.equal(Notification.create.calls.length, 0);
  });

  it('sends a selected notification to each valid staff recipient', async () => {
    const senderId = id();
    const recipientOne = id();
    const recipientTwo = id();
    const io = ioStub();
    User.find = stub(() => createQueryChain([
      { _id: objectIdLike(recipientOne) },
      { _id: objectIdLike(recipientTwo) }
    ]));
    Notification.create = stub(async (payload) => notificationDoc({
      ...payload,
      sender: { fullName: 'Admin One', email: 'admin@hospital.test' }
    }));

    const req = createMockRequest({
      body: {
        title: '  Theatre schedule ',
        message: ' Please review the revised afternoon list. ',
        audience: 'selected',
        recipients: [recipientOne, recipientOne, 'bad-id', recipientTwo]
      },
      sessionUser: { id: senderId, role: 'admin' },
      appGet: () => io
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    const savedNotification = Notification.create.calls[0][0];
    assert.equal(res.statusCode, 201);
    assert.equal(savedNotification.title, 'Theatre schedule');
    assert.equal(savedNotification.message, 'Please review the revised afternoon list.');
    assert.equal(savedNotification.sender, senderId);
    assert.deepEqual(
      savedNotification.recipients.map((recipient) => recipient.toString()),
      [recipientOne, recipientTwo]
    );
    assert.deepEqual(io.emissions.map((event) => event.room), [
      `user:${recipientOne}`,
      `user:${recipientTwo}`
    ]);
  });

  it('sends an all-staff notification to the staff room', async () => {
    const io = ioStub();
    User.find = stub(() => createQueryChain([]));
    Notification.create = stub(async (payload) => notificationDoc(payload));

    const req = createMockRequest({
      body: {
        title: 'Code blue drill',
        message: 'The drill starts at 14:00.',
        audience: 'all',
        recipients: [id()]
      },
      sessionUser: { id: id(), role: 'admin' },
      appGet: () => io
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(Notification.create.calls[0][0].recipients, []);
    assert.deepEqual(io.emissions.map(({ room, event }) => ({ room, event })), [
      { room: 'staff', event: 'notification:new' }
    ]);
  });

  it('does not send selected notifications when recipients are not staff users', async () => {
    User.find = stub(() => createQueryChain([]));
    Notification.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {
        title: 'Ward update',
        message: 'Use backup entrance.',
        audience: 'selected',
        recipients: [id()]
      },
      sessionUser: { id: id(), role: 'admin' }
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.recipients, 'Selected staff members were not found.');
    assert.equal(Notification.create.calls.length, 0);
  });

  it('lists a user notifications and unread count', async () => {
    const userId = id();
    Notification.find = stub(() => createQueryChain([
      notificationDoc({
        _id: objectIdLike('notification-1'),
        title: 'All staff update',
        readBy: []
      }),
      notificationDoc({
        _id: objectIdLike('notification-2'),
        title: 'Direct update',
        audience: 'selected',
        sender: { email: 'ops@hospital.test' },
        readBy: [objectIdLike(userId)]
      })
    ]));

    const req = createMockRequest({
      sessionUser: { id: userId, role: 'doctor' }
    });
    const res = createMockResponse();

    await notificationController.getMyNotifications(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.unreadCount, 1);
    assert.equal(res.body.notifications[0].read, false);
    assert.equal(res.body.notifications[1].read, true);
    assert.equal(res.body.notifications[1].senderName, 'ops@hospital.test');
  });

  it('does not mark notifications read when ids are invalid', async () => {
    Notification.updateMany = stub(async () => ({}));

    const req = createMockRequest({
      body: { ids: ['invalid', '', null] },
      sessionUser: { id: id(), role: 'nurse' }
    });
    const res = createMockResponse();

    await notificationController.markNotificationsRead(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'No notifications to update.');
    assert.equal(Notification.updateMany.calls.length, 0);
  });

  it('marks valid visible notifications as read', async () => {
    const userId = id();
    const notificationOne = id();
    const notificationTwo = id();
    Notification.updateMany = stub(async () => ({ modifiedCount: 2 }));

    const req = createMockRequest({
      body: { ids: [notificationOne, notificationTwo, notificationOne] },
      sessionUser: { id: userId, role: 'reception' }
    });
    const res = createMockResponse();

    await notificationController.markNotificationsRead(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(Notification.updateMany.calls[0][0], {
      _id: { $in: [notificationOne, notificationTwo] },
      $or: [
        { audience: 'all' },
        { recipients: userId }
      ]
    });
  });
});
