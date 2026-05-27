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

function validObjectId() {
  return new mongoose.Types.ObjectId().toString();
}

function createIoStub() {
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

function createNotificationDoc(payload) {
  const doc = {
    _id: payload._id || objectIdLike(validObjectId()),
    title: payload.title,
    message: payload.message,
    audience: payload.audience,
    createdAt: payload.createdAt || new Date('2026-06-01T09:00:00'),
    sender: payload.sender,
    recipients: payload.recipients || [],
    readBy: payload.readBy || [],
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
  const originals = {};

  beforeEach(() => {
    originals.userFind = User.find;
    originals.notificationFind = Notification.find;
    originals.notificationCreate = Notification.create;
    originals.notificationUpdateMany = Notification.updateMany;
  });

  afterEach(() => {
    User.find = originals.userFind;
    Notification.find = originals.notificationFind;
    Notification.create = originals.notificationCreate;
    Notification.updateMany = originals.notificationUpdateMany;
  });

  it('loads staff options for only staff roles and excludes password fields', async () => {
    const staffChain = createQueryChain([
      { fullName: 'Admin One', email: 'admin@hospital.test', role: 'admin' }
    ]);
    User.find = stub(() => staffChain);

    const req = createMockRequest();
    const res = createMockResponse();

    await notificationController.getStaffOptions(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(User.find.calls[0][0], { role: { $in: STAFF_ROLES } });
    assert.deepEqual(staffChain.calls, [
      ['sort', { fullName: 1, email: 1 }],
      ['select', 'fullName email role']
    ]);
    assert.equal(res.body.staff[0].role, 'admin');
  });

  it('validates required notification title and message before creating', async () => {
    User.find = stub(() => createQueryChain([]));
    Notification.create = stub(async () => ({}));

    const req = createMockRequest({
      body: { title: '   ', message: '' },
      sessionUser: { id: validObjectId(), role: 'admin' }
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body.errors, {
      title: 'Title is required.',
      message: 'Message is required.'
    });
    assert.equal(User.find.calls.length, 0);
    assert.equal(Notification.create.calls.length, 0);
  });

  it('requires at least one valid staff recipient for selected notifications', async () => {
    User.find = stub(() => createQueryChain([]));
    Notification.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {
        title: 'Ward update',
        message: 'Short staffing on level 3.',
        audience: 'selected',
        recipients: ['not-valid', '', null]
      },
      sessionUser: { id: validObjectId(), role: 'admin' }
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.recipients, 'Select at least one staff member.');
    assert.equal(User.find.calls.length, 0);
    assert.equal(Notification.create.calls.length, 0);
  });

  it('creates a selected-recipient notification using unique valid staff ids and emits per user', async () => {
    const senderId = validObjectId();
    const recipientOne = validObjectId();
    const recipientTwo = validObjectId();
    const io = createIoStub();
    User.find = stub(() => createQueryChain([
      { _id: objectIdLike(recipientOne) },
      { _id: objectIdLike(recipientTwo) }
    ]));
    Notification.create = stub(async (payload) => createNotificationDoc({
      _id: objectIdLike(validObjectId()),
      title: payload.title,
      message: payload.message,
      audience: payload.audience,
      recipients: payload.recipients,
      sender: {
        fullName: 'Admin One',
        email: 'admin@hospital.test',
        role: 'admin'
      }
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

    assert.equal(res.statusCode, 201);
    assert.deepEqual(User.find.calls[0][0], {
      _id: { $in: [recipientOne, recipientTwo] },
      role: { $in: STAFF_ROLES }
    });
    const createPayload = Notification.create.calls[0][0];
    assert.equal(createPayload.title, 'Theatre schedule');
    assert.equal(createPayload.message, 'Please review the revised afternoon list.');
    assert.equal(createPayload.sender, senderId);
    assert.equal(createPayload.audience, 'selected');
    assert.deepEqual(
      createPayload.recipients.map((recipient) => recipient.toString()),
      [recipientOne, recipientTwo]
    );
    assert.deepEqual(io.emissions.map((event) => event.room), [
      `user:${recipientOne}`,
      `user:${recipientTwo}`
    ]);
    assert.equal(io.emissions[0].event, 'notification:new');
  });

  it('creates an all-staff notification with no recipients and emits to the staff room', async () => {
    const senderId = validObjectId();
    const io = createIoStub();
    User.find = stub(() => createQueryChain([]));
    Notification.create = stub(async (payload) => createNotificationDoc({
      _id: objectIdLike(validObjectId()),
      ...payload,
      sender: {
        fullName: 'Admin One',
        email: 'admin@hospital.test',
        role: 'admin'
      }
    }));

    const req = createMockRequest({
      body: {
        title: 'Code blue drill',
        message: 'The drill starts at 14:00.',
        audience: 'all',
        recipients: [validObjectId()]
      },
      sessionUser: { id: senderId, role: 'admin' },
      appGet: () => io
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(User.find.calls.length, 0);
    assert.deepEqual(Notification.create.calls[0][0].recipients, []);
    assert.deepEqual(io.emissions.map(({ room, event }) => ({ room, event })), [
      { room: 'staff', event: 'notification:new' }
    ]);
  });

  it('rejects selected notifications when valid ids do not resolve to staff users', async () => {
    const recipient = validObjectId();
    User.find = stub(() => createQueryChain([]));
    Notification.create = stub(async () => ({}));

    const req = createMockRequest({
      body: {
        title: 'Ward update',
        message: 'Use backup entrance.',
        audience: 'selected',
        recipients: [recipient]
      },
      sessionUser: { id: validObjectId(), role: 'admin' }
    });
    const res = createMockResponse();

    await notificationController.sendNotification(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errors.recipients, 'Selected staff members were not found.');
    assert.equal(Notification.create.calls.length, 0);
  });

  it('loads visible notifications, formats read state, and computes unread count for a user', async () => {
    const userId = validObjectId();
    const notificationChain = createQueryChain([
      createNotificationDoc({
        _id: objectIdLike('notification-1'),
        title: 'All staff update',
        message: 'Policy update',
        audience: 'all',
        sender: { fullName: 'Admin One', email: 'admin@hospital.test' },
        readBy: []
      }),
      createNotificationDoc({
        _id: objectIdLike('notification-2'),
        title: 'Direct update',
        message: 'Room changed',
        audience: 'selected',
        sender: { email: 'ops@hospital.test' },
        readBy: [objectIdLike(userId)]
      })
    ]);
    Notification.find = stub(() => notificationChain);

    const req = createMockRequest({
      sessionUser: { id: userId, role: 'doctor' }
    });
    const res = createMockResponse();

    await notificationController.getMyNotifications(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(Notification.find.calls[0][0], {
      $or: [
        { audience: 'all' },
        { recipients: userId }
      ]
    });
    assert.equal(res.body.unreadCount, 1);
    assert.equal(res.body.notifications[0].read, false);
    assert.equal(res.body.notifications[1].read, true);
    assert.equal(res.body.notifications[1].senderName, 'ops@hospital.test');
    assert.deepEqual(notificationChain.calls, [
      ['populate', 'sender', 'fullName email role'],
      ['sort', { createdAt: -1 }],
      ['limit', 20]
    ]);
  });

  it('marks no notifications as read when the submitted ids are empty or invalid', async () => {
    Notification.updateMany = stub(async () => ({}));

    const req = createMockRequest({
      body: { ids: ['invalid', '', null] },
      sessionUser: { id: validObjectId(), role: 'nurse' }
    });
    const res = createMockResponse();

    await notificationController.markNotificationsRead(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'No notifications to update.');
    assert.equal(Notification.updateMany.calls.length, 0);
  });

  it('marks only notifications visible to the current user as read', async () => {
    const userId = validObjectId();
    const notificationOne = validObjectId();
    const notificationTwo = validObjectId();
    Notification.updateMany = stub(async () => ({ modifiedCount: 2 }));

    const req = createMockRequest({
      body: { ids: [notificationOne, notificationTwo, notificationOne] },
      sessionUser: { id: userId, role: 'reception' }
    });
    const res = createMockResponse();

    await notificationController.markNotificationsRead(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(Notification.updateMany.calls[0], [
      {
        _id: { $in: [notificationOne, notificationTwo] },
        $or: [
          { audience: 'all' },
          { recipients: userId }
        ]
      },
      {
        $addToSet: { readBy: userId }
      }
    ]);
  });
});
