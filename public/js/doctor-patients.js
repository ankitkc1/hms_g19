const patientsTable = document.getElementById('patientsTable');
const patientSearch = document.getElementById('patientSearch');
const messageBox = document.getElementById('message');

let assignedPatients = [];

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
  messageBox.textContent = text;
  messageBox.className = `message-box ${type}`;
  messageBox.classList.remove('hide');
}

function getPatientName(patient) {
  return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
}

function getFilteredPatients() {
  const searchValue = patientSearch.value.trim().toLowerCase();

  if (!searchValue) {
    return assignedPatients;
  }

  return assignedPatients.filter((patient) => {
    const content = [
      patient.patientId,
      getPatientName(patient),
      patient.phone,
      patient.email,
      patient.lastAppointment?.reason,
      patient.lastAppointment?.status
    ].join(' ').toLowerCase();

    return content.includes(searchValue);
  });
}

function renderPatients() {
  const patients = getFilteredPatients();

  if (patients.length === 0) {
    patientsTable.innerHTML = `
      <tr>
        <td colspan="6">No assigned patients found.</td>
      </tr>
    `;
    return;
  }

  patientsTable.innerHTML = patients.map((patient) => `
    <tr>
      <td>${escapeHtml(patient.patientId)}</td>
      <td>${escapeHtml(getPatientName(patient))}</td>
      <td>${escapeHtml(patient.phone)}</td>
      <td>${escapeHtml(patient.email || '-')}</td>
      <td>${escapeHtml(formatDate(patient.lastAppointment?.appointmentDate))}</td>
      <td>
        <a class="btn-small teal" href="/doctor/patients/${patient._id}">
          View Details
        </a>
      </td>
    </tr>
  `).join('');
}

async function loadAssignedPatients() {
  try {
    const response = await fetch('/doctor/patients/data');
    const result = await response.json();

    if (!result.success) {
      showMessage(result.message || 'Could not load assigned patients.');
      return;
    }

    assignedPatients = result.patients || [];
    renderPatients();
  } catch (error) {
    showMessage('Could not connect to the server.');
  }
}

patientSearch.addEventListener('input', renderPatients);
loadAssignedPatients();