document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('observationForm')
    .addEventListener('submit', createObservation);
});

function showMessage(text, type = 'success') {
  const colour = type === 'success'
    ? 'green lighten-4 green-text text-darken-4'
    : 'red lighten-4 red-text text-darken-4';

  document.getElementById('message').innerHTML = `
    <div class="card-panel ${colour}">${text}</div>
  `;
}

async function createObservation(event) {
  event.preventDefault();

  const patientId = document.getElementById('patientId').value.trim();

  const response = await fetch(`/nurse/patients/${patientId}/observations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      observation: document.getElementById('observation').value,
      careNote: document.getElementById('careNote').value,
      temperature: document.getElementById('temperature').value,
      bloodPressure: document.getElementById('bloodPressure').value,
      heartRate: document.getElementById('heartRate').value,
      oxygenSaturation: document.getElementById('oxygenSaturation').value
    })
  });

  const data = await response.json();

  if (!data.success) {
    showMessage(data.message || 'Could not save observation.', 'error');
    return;
  }

  showMessage(data.message);
  document.getElementById('observationForm').reset();
}