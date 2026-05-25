document.addEventListener('DOMContentLoaded', () => {
  loadDepartments();

  document
    .getElementById('departmentForm')
    .addEventListener('submit', createDepartment);
});

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadDepartments() {
  const response = await fetch('/departments/data');
  const departments = await response.json();

  const table = document.getElementById('departmentTable');

  if (!departments.length) {
    table.innerHTML = `
      <tr>
        <td colspan="4">No departments found</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = '';

  departments.forEach((department) => {
    const action = department.isActive ? 'deactivate' : 'activate';

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(department.name)}</td>
        <td>${escapeHtml(department.description || '-')}</td>
        <td>${department.isActive ? 'Active' : 'Inactive'}</td>
        <td>
          <button
            class="btn ${department.isActive ? 'orange' : 'green'}"
            onclick="toggleDepartmentStatus('${department._id}', '${action}')"
          >
            ${department.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `;
  });
}

async function createDepartment(event) {
  event.preventDefault();

  const name = document.getElementById('name').value;
  const description = document.getElementById('description').value;

  const response = await fetch('/departments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      description
    })
  });

  const data = await response.json();

  alert(data.message);

  if (response.ok) {
    document.getElementById('departmentForm').reset();
    loadDepartments();
  }
}

async function toggleDepartmentStatus(id, action) {
  const confirmed = confirm(
    `Are you sure you want to ${action} this department?`
  );

  if (!confirmed) {
    return;
  }

  const response = await fetch(`/departments/${id}/${action}`, {
    method: 'PATCH'
  });

  const data = await response.json();

  alert(data.message);

  loadDepartments();
}