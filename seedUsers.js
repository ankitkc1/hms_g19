require('dotenv').config();

const mongoose = require('mongoose');
const User = require('./models/User');

const users = [
  {
    fullName: 'System Admin',
    email: 'admin@hms.com',
    password: 'password123',
    role: 'admin'
  },
  {
    fullName: 'Reception Staff',
    email: 'reception@hms.com',
    password: 'password123',
    role: 'reception'
  },
  {
    fullName: 'Doctor User',
    email: 'doctor@hms.com',
    password: 'password123',
    role: 'doctor'
  },
  {
    fullName: 'Nurse User',
    email: 'nurse@hms.com',
    password: 'password123',
    role: 'nurse'
  },
  {
    email: 'patient@hms.com',
    password: 'password123',
    role: 'patient'
  }
];

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI , {
      family: 4
    });

    await User.deleteMany({});

    await User.create(users);

    console.log('Users seeded successfully');
    console.log('Password for all users: password123');

    await mongoose.disconnect();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

seedUsers();
