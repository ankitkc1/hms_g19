const Notification = require('../models/Notification');

const NOTIFICATION_EVENT = 'notification:new';

function getDocumentId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id && value._id !== value) return getDocumentId(value._id);
  if (typeof value.toHexString === 'function') return value.toHexString();
  if (value.id && typeof value.id !== 'object') return value.id.toString();
  if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
    return value.toString();
  }
  return '';
}

function getRecipientIds(recipients) {
  if (!Array.isArray(recipients)) {
    return [];
  }

  return Array.from(new Set(
    recipients
      .map(getDocumentId)
      .filter(Boolean)
  ));
}

function getVisibleNotificationQuery(userId) {
  return {
    $or: [
      { audience: 'all' },
      { recipients: userId }
    ]
  };
}

function formatUserName(user, fallback = 'Administrator') {
  if (!user) return fallback;
  return user.fullName || user.email || fallback;
}

function formatNotification(notification, options = {}) {
  const raw = notification && typeof notification.toObject === 'function'
    ? notification.toObject()
    : notification || {};
  const readBy = raw.readBy || [];
  const sender = raw.sender && (raw.sender.fullName || raw.sender.email)
    ? raw.sender
    : options.senderFallback;
  const currentUserId = getDocumentId(options.currentUserId);

  return {
    id: getDocumentId(raw._id),
    title: raw.title,
    message: raw.message,
    audience: raw.audience,
    createdAt: raw.createdAt || new Date(),
    senderName: formatUserName(sender, options.senderNameFallback),
    senderEmail: sender && sender.email ? sender.email : '',
    read: currentUserId
      ? readBy.some((userId) => getDocumentId(userId) === currentUserId)
      : false
  };
}

async function createNotification({ title, message, sender, audience, recipients }) {
  const cleanAudience = audience === 'all' ? 'all' : 'selected';
  const notification = await Notification.create({
    title,
    message,
    sender: getDocumentId(sender),
    audience: cleanAudience,
    recipients: cleanAudience === 'selected' ? getRecipientIds(recipients) : []
  });

  await notification.populate('sender', 'fullName email role');
  return notification;
}

function emitNotification(io, { audience, recipients, payload }) {
  if (!io) {
    return;
  }

  if (audience === 'all') {
    io.to('staff').emit(NOTIFICATION_EVENT, payload);
    return;
  }

  getRecipientIds(recipients).forEach((recipientId) => {
    io.to(`user:${recipientId}`).emit(NOTIFICATION_EVENT, payload);
  });
}

async function createAndEmitNotification({
  io,
  title,
  message,
  sender,
  audience = 'selected',
  recipients = [],
  senderNameFallback = 'Administrator'
}) {
  const notification = await createNotification({
    title,
    message,
    sender,
    audience,
    recipients
  });
  const payload = formatNotification(notification, {
    senderFallback: sender,
    senderNameFallback
  });

  emitNotification(io, {
    audience,
    recipients,
    payload
  });

  return { notification, payload };
}

module.exports = {
  createAndEmitNotification,
  formatNotification,
  getDocumentId,
  getVisibleNotificationQuery
};
