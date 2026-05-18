const patientForm = document.getElementById('patientForm');
const resultMessage = document.getElementById('resultMessage');
const submitButton = document.getElementById('submitButton');

document.addEventListener('DOMContentLoaded', () => {
  M.FormSelect.init(document.querySelectorAll('select'));
});

function clearMessages() {
  resultMessage.textContent = '';
  resultMessage.className = '';

  document.querySelectorAll('.helper-text').forEach((element) => {
    element.textContent = '';
  });
}

function showErrors(errors) {
  Object.keys(errors || {}).forEach((field) => {
    const errorElement = document.getElementById(`${field}Error`);

    if (errorElement) {
      errorElement.textContent = errors[field];
    }
  });
}

patientForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessages();

  submitButton.disabled = true;
  submitButton.textContent = 'Registering...';

  const formData = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    dateOfBirth: document.getElementById('dateOfBirth').value,
    gender: document.getElementById('gender').value,
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('address').value.trim(),
    emergencyContactName: document.getElementById('emergencyContactName').value.trim(),
    emergencyContactPhone: document.getElementById('emergencyContactPhone').value.trim()
  };

  try {
    const response = await fetch('/patients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (!response.ok) {
      resultMessage.textContent = data.message || 'Unable to register patient.';
      resultMessage.className = 'red-text text-darken-2';
      showErrors(data.errors);
      return;
    }

    resultMessage.textContent = data.message;
    resultMessage.className = 'green-text text-darken-2';

    patientForm.reset();

    M.updateTextFields();
    M.FormSelect.init(document.querySelectorAll('select'));
  } catch (error) {
    resultMessage.textContent = 'Unable to connect to the server.';
    resultMessage.className = 'red-text text-darken-2';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Register Patient <i class="material-icons right">person_add</i>';
  }
});
