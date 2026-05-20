const notificationForm = document.getElementById('notificationForm');
const audienceSelect = document.getElementById('audience');
const staffPicker = document.getElementById('staffPicker');
const staffOptions = document.getElementById('staffOptions');
const selectAllStaffButton = document.getElementById('selectAllStaff');
const messageBox = document.getElementById('notificationMessage');
const sendButton = document.getElementById('sendNotificationButton');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showMessage(text, type = 'error') {
  messageBox.style.display = 'block';
  messageBox.textContent = text;
  messageBox.className = `message-box ${type}`;
}

function clearErrors() {
  ['title', 'message', 'recipients'].forEach((field) => {
    const error = document.getElementById(`${field}Error`);

    if (error) {
      error.textContent = '';
    }
  });
}

function showFieldErrors(errors) {
  Object.entries(errors || {}).forEach(([field, text]) => {
    const error = document.getElementById(`${field}Error`);

    if (error) {
      error.textContent = text;
    }
  });
}

function formatStaffLabel(staff) {
  const name = staff.fullName || staff.email;
  return `${name} (${staff.role})`;
}

function renderStaffOptions(staff) {
  if (!staff.length) {
    staffOptions.innerHTML = '<p class="grey-text text-darken-1">No staff accounts found.</p>';
    return;
  }

  staffOptions.innerHTML = staff.map((staffUser) => `
    <label class="notification-staff-option">
      <input type="checkbox" value="${escapeHtml(staffUser._id)}" />
      <span>
        <strong>${escapeHtml(formatStaffLabel(staffUser))}</strong>
        <small>${escapeHtml(staffUser.email)}</small>
      </span>
    </label>
  `).join('');
}

async function loadStaffOptions() {
  try {
    const response = await fetch('/notifications/staff');
    const result = await response.json();

    if (!result.success) {
      staffOptions.textContent = result.message || 'Could not load staff.';
      return;
    }

    renderStaffOptions(result.staff || []);
  } catch (error) {
    staffOptions.textContent = 'Could not load staff.';
  }
}

function updateAudienceState() {
  staffPicker.hidden = audienceSelect.value !== 'selected';
}

function getSelectedRecipients() {
  return Array.from(staffOptions.querySelectorAll('input[type="checkbox"]:checked'))
    .map((checkbox) => checkbox.value);
}

async function sendNotification(event) {
  event.preventDefault();
  clearErrors();
  messageBox.style.display = 'none';
  sendButton.disabled = true;

  const payload = {
    audience: audienceSelect.value,
    title: document.getElementById('title').value,
    message: document.getElementById('message').value,
    recipients: getSelectedRecipients()
  };

  try {
    const response = await fetch('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!result.success) {
      showMessage(result.message || 'Could not send notification.');
      showFieldErrors(result.errors);
      return;
    }

    showMessage(result.message, 'success');
    notificationForm.reset();
    updateAudienceState();

    if (window.M) {
      M.updateTextFields();
      M.FormSelect.init(document.querySelectorAll('select'));
    }
  } catch (error) {
    showMessage('Something went wrong while sending the notification.');
  } finally {
    sendButton.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.M) {
    M.FormSelect.init(document.querySelectorAll('select'));
    M.updateTextFields();
  }

  updateAudienceState();
  loadStaffOptions();

  audienceSelect.addEventListener('change', updateAudienceState);
  notificationForm.addEventListener('submit', sendNotification);

  selectAllStaffButton.addEventListener('click', () => {
    staffOptions.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = true;
    });
  });
});
