const pathParts = window.location.pathname.split('/');
const patientId = pathParts[3];

const patientTitle = document.getElementById('patientTitle');
const patientDetails = document.getElementById('patientDetails');
const appointmentsTable = document.getElementById('appointmentsTable');
const messageBox = document.getElementById('message');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';

  return new Date(value).toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function showMessage(text, type = 'error') {
  messageBox.style.display = 'block';
  messageBox.textContent = text;
  messageBox.className = `message-box ${type}`;
}

function getPatientName(patient) {
  return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
}

function renderPatient(patient) {
  patientTitle.textContent = `Patient Record - ${getPatientName(patient)}`;

  patientDetails.innerHTML = `
    <div class="row">
      <div class="col s12 m6">
        <p><strong>Patient ID:</strong> ${escapeHtml(patient.patientId)}</p>
        <p><strong>Name:</strong> ${escapeHtml(getPatientName(patient))}</p>
        <p><strong>Date of Birth:</strong> ${escapeHtml(formatDate(patient.dateOfBirth))}</p>
        <p><strong>Gender:</strong> ${escapeHtml(patient.gender)}</p>
      </div>

      <div class="col s12 m6">
        <p><strong>Phone:</strong> ${escapeHtml(patient.phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(patient.email || '-')}</p>
        <p><strong>Address:</strong> ${escapeHtml(patient.address || '-')}</p>
        <p><strong>Emergency Contact:</strong> ${escapeHtml(patient.emergencyContactName || '-')} (${escapeHtml(patient.emergencyContactPhone || '-')})</p>
      </div>
    </div>
  `;
}

function renderAppointments(appointments) {
  if (!appointments.length) {
    appointmentsTable.innerHTML = `
      <tr>
        <td colspan="3">No appointment history found.</td>
      </tr>
    `;
    return;
  }

  appointmentsTable.innerHTML = appointments.map((appointment) => `
    <tr>
      <td>${escapeHtml(formatDate(appointment.appointmentDate))}</td>
      <td>${escapeHtml(appointment.reason)}</td>
      <td>${escapeHtml(appointment.status)}</td>
    </tr>
  `).join('');
}

async function loadPatientDetails() {
  try {
    const response = await fetch(`/doctor/patients/${patientId}/data`);
    const result = await response.json();

    if (!result.success) {
      showMessage(result.message || 'Could not load patient record.');
      patientDetails.innerHTML = '';
      appointmentsTable.innerHTML = `
        <tr>
          <td colspan="3">No records available.</td>
        </tr>
      `;
      return;
    }

    renderPatient(result.patient);
    renderAppointments(result.appointments || []);
  } catch (error) {
    showMessage('Could not connect to the server.');
  }
}

loadPatientDetails();