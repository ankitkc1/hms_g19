require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboard');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const staffRoutes = require('./routes/staff');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const doctorRoutes = require('./routes/doctor');
const profileRoutes = require('./routes/profile');

const { ensureAuthenticated } = require('./middleware/authMiddleware');
const allowRoles = require('./middleware/rolesMiddleware');
const departmentRoutes = require('./routes/departments');
const nurseRoutes = require('./routes/nurse');
const auditRoutes = require('./routes/audit');
const reportRoutes = require('./routes/reports');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

connectDB();
app.set('io', io);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
  name: 'hms.sid',
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
     mongoOptions: {
      family: 4
    },
    collectionName: 'sessions',
    ttl: 30 * 60
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 30
  }
});

app.use(sessionMiddleware);

io.engine.use(sessionMiddleware);

io.use((socket, next) => {
  const user = socket.request.session && socket.request.session.user;

  if (!user) {
    return next(new Error('Unauthorized'));
  }

  socket.user = user;
  return next();
});

io.on('connection', (socket) => {
  const user = socket.user;

  socket.join(`user:${user.id}`);
  socket.join(`role:${user.role}`);

  if (user.role !== 'patient') {
    socket.join('staff');
  }
});

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/login');
});

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/patients', patientRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/staff', staffRoutes);
app.use('/search', searchRoutes);
app.use('/notifications', notificationRoutes);
app.use('/doctor', doctorRoutes);
app.use('/departments', departmentRoutes);
app.use('/profile', profileRoutes);
app.use('/nurse', nurseRoutes);
app.use('/audit', auditRoutes);
app.use('/reports', reportRoutes);
app.use((req, res) => {
  res.status(404).send('Page not found');
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(process.env.MONGO_URI);
});
