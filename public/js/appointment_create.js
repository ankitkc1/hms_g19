const messageBox = document.getElementById('message');
    const doctorSelect = document.getElementById('doctor');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const appointmentDateHelp = document.getElementById('appointmentDateHelp');
    const availabilityPanel = document.getElementById('availabilityPanel');
    const createAppointmentButton = document.getElementById('createAppointmentButton');
    let unavailableTimes = new Set();

    function showMessage(text, type = 'error') {
      const colour = type === 'success' ? 'green lighten-4 green-text text-darken-4' : 'red lighten-4 red-text text-darken-4';
      messageBox.innerHTML = `<div class="card-panel ${colour}">${text}</div>`;
    }

    function selectedDateOnly() {
      return appointmentDateInput.value ? appointmentDateInput.value.split('T')[0] : '';
    }

    function selectedTimeOnly() {
      return appointmentDateInput.value ? appointmentDateInput.value.split('T')[1] : '';
    }

    function setDateAvailabilityState() {
      const selectedTime = selectedTimeOnly();
      const isUnavailable = selectedTime && unavailableTimes.has(selectedTime);

      appointmentDateInput.classList.toggle('invalid', Boolean(isUnavailable));
      appointmentDateHelp.textContent = isUnavailable ? 'Not available: this doctor is already booked at this time.' : '';
      appointmentDateHelp.className = isUnavailable ? 'helper-text red-text' : 'helper-text';
      createAppointmentButton.disabled = Boolean(isUnavailable);
    }

    async function loadAvailability() {
      const doctor = doctorSelect.value;
      const date = selectedDateOnly();
      unavailableTimes = new Set();
      availabilityPanel.innerHTML = '';
      setDateAvailabilityState();

      if (!doctor || !date) {
        return;
      }

      availabilityPanel.innerHTML = '<span class="grey-text text-darken-1">Checking availability...</span>';

      const response = await fetch(`/appointments/availability?doctor=${encodeURIComponent(doctor)}&date=${encodeURIComponent(date)}`);
      const result = await response.json();

      if (!result.success) {
        availabilityPanel.innerHTML = `<span class="red-text text-darken-4">${result.message || 'Could not load availability.'}</span>`;
        return;
      }

      result.unavailableSlots.forEach((slot) => {
        unavailableTimes.add(slot.label);
      });

      if (result.unavailableSlots.length === 0) {
        availabilityPanel.innerHTML = '<div class="available-note">All 15-minute slots are currently available for this day.</div>';
      } else {
        availabilityPanel.innerHTML = `
          <div class="availability-title red-text text-darken-4">Unavailable times</div>
          ${result.unavailableSlots.map((slot) => `<span class="unavailable-slot">${slot.label}</span>`).join('')}
        `;
      }

      setDateAvailabilityState();
    }

    async function loadOptions() {
      const response = await fetch('/appointments/options');
      const result = await response.json();

      if (!result.success) {
        showMessage(result.message || 'Could not load form options.');
        return;
      }

      const patientSelect = document.getElementById('patient');
      result.patients.forEach((patient) => {
        const option = document.createElement('option');
        option.value = patient._id;
        option.textContent = `${patient.firstName} ${patient.lastName}${patient.patientId ? ' - ' + patient.patientId : ''}`;
        patientSelect.appendChild(option);
      });

      result.doctors.forEach((doctor) => {
        const option = document.createElement('option');
        option.value = doctor._id;
        option.textContent = doctor.email;
        doctorSelect.appendChild(option);
      });

      M.FormSelect.init(document.querySelectorAll('select'));
    }

    document.getElementById('appointmentForm').addEventListener('submit', async (event) => {
      event.preventDefault();

      setDateAvailabilityState();

      if (createAppointmentButton.disabled) {
        showMessage('Please choose an available appointment time.');
        return;
      }

      const payload = {
        patient: document.getElementById('patient').value,
        doctor: doctorSelect.value,
        appointmentDate: appointmentDateInput.value,
        reason: document.getElementById('reason').value
      };

      const response = await fetch('/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!result.success) {
        showMessage(result.message || 'Could not create appointment.');
        return;
      }

      showMessage(result.message, 'success');

      setTimeout(() => {
        window.location.href = '/appointments';
      }, 700);
    });

    loadOptions();
    doctorSelect.addEventListener('change', loadAvailability);
    appointmentDateInput.addEventListener('change', loadAvailability);
    appointmentDateInput.addEventListener('input', setDateAvailabilityState);