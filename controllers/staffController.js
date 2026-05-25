const path = require('path');
const User = require('../models/User');

exports.getStaffPage = (req, res) => {

  res.sendFile(
    path.join(__dirname, '../views/staff/index.html')
  );
};

exports.getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({
      role: { $ne: 'patient' }
    })
      .sort({ fullName: 1, email: 1 })
      .select('-password');

    res.json(staff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch staff' });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const role = String(req.body.role || '').trim();
    const department = String(req.body.department || 'General').trim();
 

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const newUser = await User.create({
      fullName,
      email,
      password,
      role,
      department: department || 'General'
    });

    res.status(201).json({
      message: 'Staff created successfully',
      user: newUser
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create staff' });
  }
};

exports.deactivateStaff = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      isActive: false
    });

    res.json({ message: 'Staff deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to deactivate staff' });
  }
};

exports.activateStaff = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      isActive: true
    });

    res.json({ message: 'Staff activated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to activate staff' });
  }
};
