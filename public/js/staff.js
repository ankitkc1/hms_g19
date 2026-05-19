document.addEventListener('DOMContentLoaded', () => {

  const roleSelect = document.querySelector('select');

  M.FormSelect.init(roleSelect);

  loadStaff();

  document
    .getElementById('staffForm')
    .addEventListener('submit', createStaff);
});

async function loadStaff() {

  const response = await fetch('/staff/data');

  const staff = await response.json();

  const table = document.getElementById('staffTable');

  if (!staff.length) {
    table.innerHTML = `
      <tr>
        <td colspan="3">No staff found</td>
      </tr>
    `;

    return;
  }

  table.innerHTML = '';

  staff.forEach(user => {

    table.innerHTML += `
      <tr>
        <td>${user.email}</td>
        <td>${user.role}</td>

        <td>
          <button
            class="btn red"
            onclick="deleteStaff('${user._id}')"
          >
            Delete
          </button>
        </td>
      </tr>
    `;
  });
}

async function createStaff(event) {

  event.preventDefault();

  const email = document.getElementById('email').value;

  const password = document.getElementById('password').value;

  const role = document.getElementById('role').value;

  const response = await fetch('/staff', {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      email,
      password,
      role
    })
  });

  const data = await response.json();

  alert(data.message);

  loadStaff();
}

async function deleteStaff(id) {

  const confirmed = confirm(
    'Are you sure you want to delete this staff member?'
  );

  if (!confirmed) {
    return;
  }

  const response = await fetch(`/staff/${id}`, {
    method: 'DELETE'
  });

  const data = await response.json();

  alert(data.message);

  loadStaff();
}