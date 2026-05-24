const pathParts = window.location.pathname.split('/');
const patientId = pathParts[3];

const patientTitle = document.getElementById('patientTitle');
const patientDetails = document.getElementById('patientDetails');
const appointmentsTable = document.getElementById('appointmentsTable');
const messageBox = document.getElementById('message');

const clinicalNoteForm = document.getElementById('clinicalNoteForm');
const saveClinicalNoteButton = document.getElementById('saveClinicalNoteButton');
const clinicalRecordsList = document.getElementById('clinicalRecordsList');

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
  messageBox.className = `message-box ${type}`;
  messageBox.textContent = text;
}

function hideMessage() {
  messageBox.className = 'message-box hide';
  messageBox.textContent = '';
}

function getPatientName(patient) {
  return `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
}

function clearClinicalNoteErrors() {
  ['diagnosis', 'treatmentNotes', 'careInstructions'].forEach((field) => {
    const errorElement = document.getElementById(`${field}Error`);

    if (errorElement) {
      errorElement.textContent = '';
    }
  });
}

function showClinicalNoteErrors(errors) {
  Object.entries(errors || {}).forEach(([field, message]) => {
    const errorElement = document.getElementById(`${field}Error`);

    if (errorElement) {
      errorElement.textContent = message;
    }
  });
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

function renderClinicalRecords(records) {
  if (!records || records.length === 0) {
    clinicalRecordsList.innerHTML = `
      <p class="grey-text text-darken-1">No clinical notes have been added yet.</p>
    `;
    return;
  }

  clinicalRecordsList.innerHTML = records.map((record) => `
    <div class="card-panel">
      <p><strong>Diagnosis:</strong> ${escapeHtml(record.diagnosis)}</p>
      <p><strong>Treatment Notes:</strong> ${escapeHtml(record.treatmentNotes)}</p>
      <p><strong>Care Instructions:</strong> ${escapeHtml(record.careInstructions)}</p>
      <p class="grey-text text-darken-1">
        <small>Added on ${escapeHtml(formatDate(record.createdAt))}</small>
      </p>
    </div>
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
      renderClinicalRecords([]);
      return;
    }

    renderPatient(result.patient);
    renderAppointments(result.appointments || []);
    renderClinicalRecords(result.clinicalRecords || []);
  } catch (error) {
    showMessage('Could not connect to the server.');
  }
}

async function saveClinicalNote(event) {
  event.preventDefault();

  hideMessage();
  clearClinicalNoteErrors();

  const payload = {
    diagnosis: document.getElementById('diagnosis').value.trim(),
    treatmentNotes: document.getElementById('treatmentNotes').value.trim(),
    careInstructions: document.getElementById('careInstructions').value.trim()
  };

  saveClinicalNoteButton.disabled = true;
  saveClinicalNoteButton.textContent = 'Saving...';

  try {
    const response = await fetch(`/doctor/patients/${patientId}/clinical-records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.success) {
      showMessage(result.message || 'Could not save clinical note.');
      showClinicalNoteErrors(result.errors);
      return;
    }

    showMessage(result.message || 'Clinical note added successfully.', 'success');

    clinicalNoteForm.reset();

    if (window.M) {
      M.updateTextFields();
    }

    await loadPatientDetails();
  } catch (error) {
    showMessage('Could not connect to the server.');
  } finally {
    saveClinicalNoteButton.disabled = false;
    saveClinicalNoteButton.innerHTML = 'Save Clinical Note <i class="material-icons right">save</i>';
  }
}

clinicalNoteForm.addEventListener('submit', saveClinicalNote);

loadPatientDetails();