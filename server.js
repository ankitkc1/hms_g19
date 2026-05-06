require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const { ensureAuthenticated } = require('./middleware/authMiddleware');

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

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});