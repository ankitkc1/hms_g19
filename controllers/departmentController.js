const path = require('path');
const Department = require('../models/Department');

exports.getDepartmentsPage = (req, res) => {
  res.sendFile(
    path.join(__dirname, '..', 'views', 'departments', 'index.html')
  );
};

exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .sort({ name: 1 });

    res.json(departments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch departments' });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    const exists = await Department.findOne({
      name: name
    });

    if (exists) {
      return res.status(409).json({ message: 'Department already exists' });
    }

    await Department.create({
      name,
      description
    });

    res.status(201).json({ message: 'Department created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create department' });
  }
};

exports.deactivateDepartment = async (req, res) => {
  try {
    await Department.findByIdAndUpdate(req.params.id, {
      isActive: false
    });

    res.json({ message: 'Department deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to deactivate department' });
  }
};

exports.activateDepartment = async (req, res) => {
  try {
    await Department.findByIdAndUpdate(req.params.id, {
      isActive: true
    });

    res.json({ message: 'Department activated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to activate department' });
  }
};