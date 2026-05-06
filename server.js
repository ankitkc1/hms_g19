require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboard');

const { ensureAuthenticated } = require('./middleware/authMiddleware');
const allowRoles = require('./middleware/rolesMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'hms.sid',
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      ttl: 30 * 60
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 30
    }
  })
);

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  return res.redirect('/login');
});

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);

// Temporary protected routes for testing US03 role-based access.
// These can be replaced later when US05 patient pages are built.
app.get(
  '/patients',
  ensureAuthenticated,
  allowRoles('admin', 'reception', 'doctor', 'nurse'),
  (req, res) => {
    res.send('Patients page');
  }
);

app.get(
  '/patients/new',
  ensureAuthenticated,
  allowRoles('admin', 'reception'),
  (req, res) => {
    res.send('Register patient page');
  }
);

app.get(
  '/staff',
  ensureAuthenticated,
  allowRoles('admin'),
  (req, res) => {
    res.send('Staff management page');
  }
);

app.get(
  '/profile',
  ensureAuthenticated,
  allowRoles('patient'),
  (req, res) => {
    res.send('Patient profile page');
  }
);

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
