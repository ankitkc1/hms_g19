let currentUser = null;
let allAppointments = [];
let appointmentSummary = null;

const userInfo = document.getElementById('userInfo');
const dashboardTitle = document.getElementById('dashboardTitle');
const todayDate = document.getElementById('todayDate');
const messageBox = document.getElementById('message');

const clinicalDashboard = document.getElementById('clinicalDashboard');
const generalDashboard = document.getElementById('generalDashboard');
const dashboardAppointmentsTable = document.getElementById('dashboardAppointmentsTable');
const appointmentSearch = document.getElementById('appointmentSearch');
const statusFilter = document.getElementById('statusFilter');
const dateFilter = document.getElementById('dateFilter');
const allCount = document.getElementById('allCount');
const scheduledCount = document.getElementById('scheduledCount');
const completedCount = document.getElementById('completedCount');
const cancelledCount = document.getElementById('cancelledCount');
const nextVisitCard = document.getElementById('nextVisitCard');

function showMessage(text, type = 'error') {
  messageBox.style.display = 'block';
  messageBox.textContent = text;
  messageBox.className = `message-box ${type}`;
}

function updateNavigation(role) {
  document.querySelectorAll('.role-link').forEach((item) => {
    const allowedRoles = item.dataset.roles.split(',');
    item.style.display = allowedRoles.includes(role) ? '' : 'none';
  });
}

function updateRoleSpecificContent(role) {
  document.querySelectorAll('.doctor-only').forEach((item) => {
    item.style.display = role === 'doctor' ? '' : 'none';
  });

  document.querySelectorAll('.nurse-only').forEach((item) => {
    item.style.display = role === 'nurse' ? '' : 'none';
  });
}

function formatDate(value) {
  if (!value) return '-';

  return new Date(value).toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function formatTime(value) {
  if (!value) return '-';

  return new Date(value).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function isToday(value) {
  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getPatientName(appointment) {
  if (!appointment.patient) return '-';
  return `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim();
}

function getDoctorName(appointment) {
  if (!appointment.doctor) return '-';
  return appointment.doctor.email || '-';
}

function getStatusClass(status) {
  if (status === 'Completed') return 'green lighten-5 green-text text-darken-3';
  if (status === 'Cancelled') return 'red lighten-5 red-text text-darken-3';
  return 'orange lighten-5 orange-text text-darken-3';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildAppointmentSummary(appointments) {
  const summary = {
    total: appointments.length,
    scheduled: 0,
    completed: 0,
    cancelled: 0
  };

  appointments.forEach((appointment) => {
    const status = String(appointment.status || '').toLowerCase();

    if (status === 'scheduled') {
      summary.scheduled += 1;
    }

    if (status === 'completed') {
      summary.completed += 1;
    }

    if (status === 'cancelled') {
      summary.cancelled += 1;
    }
  });

  return summary;
}

function canUpdateStatus(appointment) {
  if (!currentUser) return false;

  if (['admin', 'reception'].includes(currentUser.role)) {
    return true;
  }

  if (currentUser.role === 'doctor') {
    return appointment.doctor && appointment.doctor._id === currentUser.id;
  }

  return false;
}

async function updateStatus(appointmentId, status) {
  try {
    const response = await fetch(`/appointments/${appointmentId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    const result = await response.json();

    if (!result.success) {
      showMessage(result.message || 'Could not update appointment status.');
      return;
    }

    showMessage(result.message || 'Appointment status updated.', 'success');
    await loadAppointments();
  } catch (error) {
    showMessage('Something went wrong while updating the appointment.');
  }
}

function getFilteredAppointments() {
  const searchValue = appointmentSearch.value.trim().toLowerCase();
  const selectedStatus = statusFilter ? statusFilter.value : '';
  const selectedDate = dateFilter ? dateFilter.value : '';

  let appointments = allAppointments;

  if (selectedDate) {
    appointments = appointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.appointmentDate)
        .toISOString()
        .split('T')[0];

      return appointmentDate === selectedDate;
    });
  } else {
    appointments = appointments.filter((appointment) =>
      isToday(appointment.appointmentDate)
    );
  }

  if (selectedStatus) {
    appointments = appointments.filter((appointment) =>
      appointment.status === selectedStatus
    );
  }

  if (searchValue) {
    appointments = appointments.filter((appointment) => {
      const content = [
        getPatientName(appointment),
        getDoctorName(appointment),
        appointment.reason,
        appointment.status,
        formatDate(appointment.appointmentDate)
      ]
        .join(' ')
        .toLowerCase();

      return content.includes(searchValue);
    });
  }

  return appointments.sort(
    (a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate)
  );
}

function renderSummary() {
  const summary = appointmentSummary || buildAppointmentSummary(allAppointments);

  allCount.textContent = summary.total || 0;
  scheduledCount.textContent = summary.scheduled || 0;
  completedCount.textContent = summary.completed || 0;
  cancelledCount.textContent = summary.cancelled || 0;
}

function renderNextVisit() {
  const now = new Date();

  const upcoming = allAppointments
    .filter((appointment) => {
      const appointmentDate = new Date(appointment.appointmentDate);
      return (
        isToday(appointment.appointmentDate) &&
        appointmentDate >= now &&
        appointment.status === 'Scheduled'
      );
    })
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))[0];

  if (!upcoming) {
    nextVisitCard.innerHTML = `
      <p class="grey-text text-darken-1">No upcoming scheduled visits for today.</p>
    `;
    return;
  }

  nextVisitCard.innerHTML = `
    <div class="next-visit-time">${formatTime(upcoming.appointmentDate)}</div>
    <h6>${escapeHtml(getPatientName(upcoming))}</h6>
    <p><strong>Reason:</strong> ${escapeHtml(upcoming.reason)}</p>
    <p><strong>Doctor:</strong> ${escapeHtml(getDoctorName(upcoming))}</p>
    <span class="status-pill ${getStatusClass(upcoming.status)}">${escapeHtml(upcoming.status)}</span>
  `;
}

function renderAppointmentsTable() {
  const appointments = getFilteredAppointments();

  if (appointments.length === 0) {
    dashboardAppointmentsTable.innerHTML = `
      <tr>
        <td colspan="6">No patient visits found for today.</td>
      </tr>
    `;
    return;
  }

  dashboardAppointmentsTable.innerHTML = '';

  appointments.forEach((appointment) => {
    const actionHtml = canUpdateStatus(appointment)
      ? `
        <select class="browser-default status-select" data-id="${appointment._id}">
          <option value="Scheduled" ${appointment.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
          <option value="Completed" ${appointment.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Cancelled" ${appointment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      `
      : '<span class="grey-text">View only</span>';

    const row = `
      <tr>
        <td>${formatTime(appointment.appointmentDate)}</td>
        <td>${escapeHtml(getPatientName(appointment))}</td>
        <td>${escapeHtml(getDoctorName(appointment))}</td>
        <td>${escapeHtml(appointment.reason)}</td>
        <td>
          <span class="status-pill ${getStatusClass(appointment.status)}">
            ${escapeHtml(appointment.status)}
          </span>
        </td>
        <td>${actionHtml}</td>
      </tr>
    `;

    dashboardAppointmentsTable.insertAdjacentHTML('beforeend', row);
  });

  document.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', (event) => {
      updateStatus(event.target.dataset.id, event.target.value);
    });
  });
}

function renderDashboard() {
  renderSummary();
  renderNextVisit();
  renderAppointmentsTable();
}

async function loadCurrentUser() {
  try {
    const response = await fetch('/me');
    const data = await response.json();

    if (!response.ok || !data.success) {
      window.location.href = '/login';
      return;
    }

    currentUser = data.user;

    userInfo.textContent = `Logged in as ${currentUser.email} (${currentUser.role})`;
    updateNavigation(currentUser.role);
    updateRoleSpecificContent(currentUser.role);

    if (currentUser.role === 'doctor') {
      dashboardTitle.textContent = 'Doctor Dashboard';
      document.getElementById('appointmentsSubtitle').textContent =
        'Your scheduled appointments and patient visits for today.';
      clinicalDashboard.style.display = 'block';
      generalDashboard.style.display = 'none';
    } else if (currentUser.role === 'nurse') {
      dashboardTitle.textContent = 'Nurse Dashboard';
      document.getElementById('appointmentsSubtitle').textContent =
        "Today's patient visits that may need nursing support.";
      clinicalDashboard.style.display = 'block';
      generalDashboard.style.display = 'none';
    } else {
      dashboardTitle.textContent = 'Secure Dashboard';
      clinicalDashboard.style.display = 'none';
      generalDashboard.style.display = 'block';
    }
  } catch (error) {
    userInfo.textContent = 'Unable to load user details.';
  }
}

async function loadAppointments() {
  if (!currentUser || !['doctor', 'nurse'].includes(currentUser.role)) {
    return;
  }

  try {
    const response = await fetch('/appointments/data');
    const result = await response.json();

    if (!result.success) {
      showMessage(result.message || 'Could not load appointments.');
      dashboardAppointmentsTable.innerHTML = `
        <tr>
          <td colspan="6">Could not load appointments.</td>
        </tr>
      `;
      return;
    }

    allAppointments = result.appointments || [];
    appointmentSummary = result.summary || buildAppointmentSummary(allAppointments);
    renderDashboard();
  } catch (error) {
    showMessage('Something went wrong while loading appointments.');
  }
}

function initTodayDate() {
  todayDate.textContent = new Date().toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

async function init() {
  initTodayDate();

  if (appointmentSearch) {
  appointmentSearch.addEventListener('input', renderAppointmentsTable);
}

if (statusFilter) {
  statusFilter.addEventListener('change', renderAppointmentsTable);
}

if (dateFilter) {
  dateFilter.addEventListener('change', renderAppointmentsTable);
}

  await loadCurrentUser();
  await loadAppointments();
}

init();
