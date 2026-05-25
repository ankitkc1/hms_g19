document.addEventListener('DOMContentLoaded', () => {

  const roleSelect = document.querySelector('select');

  M.FormSelect.init(roleSelect);

  loadStaff();

  document
    .getElementById('staffForm')
    .addEventListener('submit', createStaff);
});

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadStaff() {

  const response = await fetch('/staff/data');

  const staff = await response.json();

  const table = document.getElementById('staffTable');

  if (!staff.length) {
    table.innerHTML = `
      <tr>
        <td colspan="4">No staff found</td>
      </tr>
    `;

    return;
  }

  table.innerHTML = '';

  staff.forEach(user => {

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(user.fullName || '-')}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${user.isActive ? 'Active' : 'Inactive'}</td>

        <td>
          <button
            class="btn ${user.isActive ? 'orange' : 'green'}"
            onclick="toggleStaffStatus('${user._id}', ${user.isActive})"
          >
            ${user.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `;
  });
}

async function createStaff(event) {

  event.preventDefault();

  const fullName = document.getElementById('fullName').value;

  const email = document.getElementById('email').value;

  const password = document.getElementById('password').value;

  const role = document.getElementById('role').value;

  const response = await fetch('/staff', {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      fullName,
      email,
      password,
      role
    })
  });

  const data = await response.json();

  alert(data.message);

  loadStaff();
}

async function toggleStaffStatus(id, isActive) {
  const action = isActive ? 'deactivate' : 'activate';

  const confirmed = confirm(
    `Are you sure you want to ${action} this staff member?`
  );

  if (!confirmed) {
    return;
  }

  const response = await fetch(`/staff/${id}/${action}`, {
    method: 'PATCH'
  });

  const data = await response.json();

  alert(data.message);

  loadStaff();
}