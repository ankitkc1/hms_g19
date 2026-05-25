let currentUser = null;

    const tableBody = document.getElementById('appointmentsTable');
    const messageBox = document.getElementById('message');

    function showMessage(text, type = 'error') {
      const colour = type === 'success' ? 'green lighten-4 green-text text-darken-4' : 'red lighten-4 red-text text-darken-4';
      messageBox.innerHTML = `<div class="card-panel ${colour}">${text}</div>`;
    }

    function formatDate(value) {
      if (!value) return '-';

      return new Date(value).toLocaleString('en-AU', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    }

    function canCreateAppointments() {
      return currentUser && ['admin', 'reception'].includes(currentUser.role);
    }

    function canUpdateStatus(appointment) {
      if (!currentUser) return false;

      if (['admin', 'reception'].includes(currentUser.role)) {
        return true;
      }

      if (currentUser.role === 'doctor') {
        return appointment.doctor && appointment.doctor._id === currentUser.id;
      }

      return false;
    }

    async function loadCurrentUser() {
      const response = await fetch('/me');
      const result = await response.json();

      if (!result.success) {
        window.location.href = '/login';
        return;
      }

      currentUser = result.user;

      if (canCreateAppointments()) {
        document.getElementById('bookButtonWrap').style.display = 'block';
      }
    }

    async function updateStatus(appointmentId, status) {
      const response = await fetch(`/appointments/${appointmentId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      const result = await response.json();

      if (!result.success) {
        showMessage(result.message || 'Could not update status.');
        return;
      }

      showMessage(result.message, 'success');
      loadAppointments();
    }

    async function loadAppointments() {
      const response = await fetch('/appointments/data');
      const result = await response.json();

      if (!result.success) {
        tableBody.innerHTML = `<tr><td colspan="6">${result.message || 'Could not load appointments.'}</td></tr>`;
        return;
      }

      if (result.appointments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">No appointments found.</td></tr>';
        return;
      }

      tableBody.innerHTML = '';

      result.appointments.forEach((appointment) => {
        const patientName = appointment.patient
          ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
          : '-';

        const doctorName = appointment.doctor
          ? appointment.doctor.email
          : '-';

        let actionHtml = '-';

        if (canUpdateStatus(appointment)) {
          actionHtml = `
            <select onchange="updateStatus('${appointment._id}', this.value)" class="browser-default">
              <option value="Scheduled" ${appointment.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="Completed" ${appointment.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Cancelled" ${appointment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          `;
          if (['admin', 'reception'].includes(currentUser.role)) {
              actionHtml += `
               <button class="btn-small blue" onclick="rescheduleAppointment('${appointment._id}')">
                 Reschedule
               </button>
               <button class="btn-small red" onclick="updateStatus('${appointment._id}', 'Cancelled')">
                 Cancel
               </button>
            `;
           } 
          }

        const row = `
          <tr>
            <td>${patientName}</td>
            <td>${doctorName}</td>
            <td>${formatDate(appointment.appointmentDate)}</td>
            <td>${appointment.reason}</td>
            <td>${appointment.status}</td>
            <td>${actionHtml}</td>
          </tr>
        `;

        tableBody.insertAdjacentHTML('beforeend', row);
      });
    }

    async function rescheduleAppointment(appointmentId) {
  const appointmentDate = prompt(
    'Enter new appointment date/time in this format: YYYY-MM-DDTHH:mm'
  );

  if (!appointmentDate) {
    return;
  }

  const response = await fetch(`/appointments/${appointmentId}/reschedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointmentDate })
  });

  const result = await response.json();

  if (!result.success) {
    showMessage(result.message || 'Could not reschedule appointment.');
    return;
  }

  showMessage(result.message, 'success');
  loadAppointments();
}

    async function init() {
      await loadCurrentUser();
      await loadAppointments();
    }

    init();
