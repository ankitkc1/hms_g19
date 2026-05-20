const path = require('path');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

const STAFF_ROLES = ['admin', 'reception', 'doctor', 'nurse'];
const NOTIFICATION_LIMIT = 20;

function getNotificationPage(req, res) {
  return res.sendFile(path.join(__dirname, '..', 'views', 'notifications', 'notif.html'));
}

function formatUserName(user) {
  if (!user) return 'Administrator';
  return user.fullName || user.email || 'Administrator';
}

function formatNotification(notification, currentUserId) {
  const raw = typeof notification.toObject === 'function'
    ? notification.toObject()
    : notification;
  const readBy = raw.readBy || [];

  return {
    id: raw._id.toString(),
    title: raw.title,
    message: raw.message,
    audience: raw.audience,
    createdAt: raw.createdAt,
    senderName: formatUserName(raw.sender),
    senderEmail: raw.sender && raw.sender.email ? raw.sender.email : '',
    read: currentUserId
      ? readBy.some((userId) => userId.toString() === currentUserId.toString())
      : false
  };
}

function getVisibleNotificationQuery(userId) {
  return {
    $or: [
      { audience: 'all' },
      { recipients: userId }
    ]
  };
}

function getCleanRecipientIds(recipients) {
  if (!Array.isArray(recipients)) {
    return [];
  }

  return Array.from(new Set(
    recipients
      .map((id) => String(id || '').trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  ));
}

async function getStaffOptions(req, res) {
  try {
    const staff = await User.find({
      role: { $in: STAFF_ROLES }
    })
      .sort({ fullName: 1, email: 1 })
      .select('fullName email role');

    return res.status(200).json({
      success: true,
      staff
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not load staff members.'
    });
  }
}

async function getMyNotifications(req, res) {
  const userId = req.session.user.id;

  try {
    const notifications = await Notification.find(getVisibleNotificationQuery(userId))
      .populate('sender', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(NOTIFICATION_LIMIT);

    const unreadCount = notifications.filter((notification) =>
      !notification.readBy.some((readUserId) => readUserId.toString() === userId)
    ).length;

    return res.status(200).json({
      success: true,
      notifications: notifications.map((notification) =>
        formatNotification(notification, userId)
      ),
      unreadCount
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not load notifications.'
    });
  }
}

async function sendNotification(req, res) {
  const title = String(req.body.title || '').trim();
  const message = String(req.body.message || '').trim();
  const audience = req.body.audience === 'selected' ? 'selected' : 'all';
  const errors = {};
  let recipients = [];

  if (!title) {
    errors.title = 'Title is required.';
  }

  if (!message) {
    errors.message = 'Message is required.';
  }

  try {
    if (audience === 'selected') {
      const recipientIds = getCleanRecipientIds(req.body.recipients);

      if (recipientIds.length === 0) {
        errors.recipients = 'Select at least one staff member.';
      } else {
        recipients = await User.find({
          _id: { $in: recipientIds },
          role: { $in: STAFF_ROLES }
        }).select('_id');

        if (recipients.length === 0) {
          errors.recipients = 'Selected staff members were not found.';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the highlighted fields.',
        errors
      });
    }

    const notification = await Notification.create({
      title,
      message,
      sender: req.session.user.id,
      audience,
      recipients: audience === 'selected'
        ? recipients.map((staffUser) => staffUser._id)
        : []
    });

    await notification.populate('sender', 'fullName email role');

    const payload = formatNotification(notification);
    const io = req.app.get('io');

    if (io) {
      if (audience === 'all') {
        io.to('staff').emit('notification:new', payload);
      } else {
        recipients.forEach((staffUser) => {
          io.to(`user:${staffUser._id.toString()}`).emit('notification:new', payload);
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Notification sent successfully.',
      notification: payload
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not send notification.'
    });
  }
}

async function markNotificationsRead(req, res) {
  const userId = req.session.user.id;
  const ids = getCleanRecipientIds(req.body.ids);

  if (ids.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No notifications to update.'
    });
  }

  try {
    await Notification.updateMany(
      {
        _id: { $in: ids },
        ...getVisibleNotificationQuery(userId)
      },
      {
        $addToSet: { readBy: userId }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Notifications marked as read.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Could not update notifications.'
    });
  }
}

module.exports = {
  getNotificationPage,
  getStaffOptions,
  getMyNotifications,
  sendNotification,
  markNotificationsRead
};
