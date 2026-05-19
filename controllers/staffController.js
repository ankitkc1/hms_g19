const path = require('path');
const User = require('../models/User');

/*
=====================================================
Render Staff Page
=====================================================
*/
exports.getStaffPage = (req, res) => {

  res.sendFile(
    path.join(__dirname, '../views/staff/index.html')
  );
};

/*
=====================================================
Get All Staff
=====================================================
*/
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({
      role: { $ne: 'patient' }
    }).select('-password');

    res.json(staff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch staff' });
  }
};

/*
=====================================================
Create Staff
=====================================================
*/
exports.createStaff = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const newUser = await User.create({
      email,
      password,
      role
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

/*
=====================================================
Delete Staff
=====================================================
*/
exports.deleteStaff = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'Staff deleted successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete staff' });
  }
};