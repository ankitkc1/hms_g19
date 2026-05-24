document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
});

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

  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

async function loadProfile() {
  const table = document.getElementById('profileTable');
  const message = document.getElementById('message');

  try {
    const response = await fetch('/profile/data');
    const result = await response.json();

    if (!result.success) {
      message.innerHTML = `
        <div class="card-panel red lighten-4 red-text text-darken-4">
          ${escapeHtml(result.message)}
        </div>
      `;
      table.innerHTML = '';
      return;
    }

    const patient = result.patient;

    table.innerHTML = `
      <tr>
        <th>Patient ID</th>
        <td>${escapeHtml(patient.patientId)}</td>
      </tr>
      <tr>
        <th>Name</th>
        <td>${escapeHtml(patient.firstName)} ${escapeHtml(patient.lastName)}</td>
      </tr>
      <tr>
        <th>Date of Birth</th>
        <td>${formatDate(patient.dateOfBirth)}</td>
      </tr>
      <tr>
        <th>Gender</th>
        <td>${escapeHtml(patient.gender)}</td>
      </tr>
      <tr>
        <th>Phone</th>
        <td>${escapeHtml(patient.phone)}</td>
      </tr>
      <tr>
        <th>Email</th>
        <td>${escapeHtml(patient.email || '-')}</td>
      </tr>
      <tr>
        <th>Address</th>
        <td>${escapeHtml(patient.address)}</td>
      </tr>
      <tr>
        <th>Emergency Contact</th>
        <td>
          ${escapeHtml(patient.emergencyContactName)}
          (${escapeHtml(patient.emergencyContactPhone)})
        </td>
      </tr>
      <tr>
        <th>Login Email</th>
        <td>${escapeHtml(patient.linkedUser ? patient.linkedUser.email : '-')}</td>
      </tr>
    `;
  } catch (error) {
    message.innerHTML = `
      <div class="card-panel red lighten-4 red-text text-darken-4">
        Could not load your profile.
      </div>
    `;
  }
}