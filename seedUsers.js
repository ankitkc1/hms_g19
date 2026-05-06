require('dotenv').config();

const mongoose = require('mongoose');
const User = require('./models/User');

const users = [
  {
    email: 'admin@hms.com',
    password: 'password123',
    role: 'admin'
  },
  {
    email: 'reception@hms.com',
    password: 'password123',
    role: 'reception'
  },
  {
    email: 'doctor@hms.com',
    password: 'password123',
    role: 'doctor'
  },
  {
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
    await mongoose.connect(process.env.MONGO_URI);

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
