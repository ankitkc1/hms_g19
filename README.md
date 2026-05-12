# Hospital Management System (HMS)

- Secure login with session-based authentication
- Role-based access control for:
  - Admin
  - Reception
  - Doctor
  - Nurse
  - Patient
- Dashboard with role-specific summary
- Patient registration and patient list
- Appointment booking and appointment status updates
- Clinical record notes for doctors and nurses
- Staff management for administrators
- Patient portal for own profile, appointments, and records
- MVC project structure

## Architecture Diagram
<img width="1518" height="703" alt="HMS – Architecture Diagram" src="https://github.com/user-attachments/assets/e63849ab-6e66-4617-b90a-cb1de07abf19" />



## Technologies used

- Node.js
- Express.js
- HTML
- Materialize CSS
- MongoDB Atlas
- Mongoose
- express-session
- connect-mongo
- bcryptjs

## Setup steps

### 1. Install packages

```bash
npm install
```

## Demo login accounts

All demo users use the same password:

password123

| Role | Email |
|------|-------|
| Admin | admin@hms.com |
| Reception | reception@hms.com |
| Doctor | doctor@hms.com |
| Nurse | nurse@hms.com |
| Patient | patient@hms.com |

## Core models

### User
Stores login and role information.

### Patient
Stores demographic and non-clinical information, assigned doctor, and linked patient account.

### Appointment
Stores booking date, doctor, patient, reason, and status.

### ClinicalRecord
Stores diagnosis, treatment notes, observations, and prescriptions.

## Security features already included

- Password hashing using bcryptjs
- Session-based authentication
- Role-based page access
- Basic separation of clinical and non-clinical access
