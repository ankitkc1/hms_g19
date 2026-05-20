(function () {
  const navLinks = document.getElementById('mainNavLinks');

  if (!navLinks) {
    return;
  }

  const links = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      roles: ['admin', 'reception', 'doctor', 'nurse', 'patient']
    },
    {
      label: 'Appointments',
      href: '/appointments',
      roles: ['admin', 'reception', 'doctor', 'nurse', 'patient']
    },
    {
      label: 'Register Patient',
      href: '/patients/new',
      roles: ['admin', 'reception']
    },
    {
      label: 'Book Appointment',
      href: '/appointments/new',
      roles: ['admin', 'reception']
    },
    {
      label: 'Staff',
      href: '/staff',
      roles: ['admin']
    },
    {
      label: 'My Profile',
      href: '/profile',
      roles: ['patient']
    }
  ];
  const searchRoles = ['admin', 'reception', 'doctor', 'nurse'];
  const searchDelayMs = 250;

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function isActiveLink(href) {
    const path = window.location.pathname;

    if (href === '/dashboard') {
      return path === '/dashboard' || path.startsWith('/dashboard/');
    }

    return path === href;
  }

  function createLinkItem(link) {
    const item = document.createElement('li');

    if (isActiveLink(link.href)) {
      item.classList.add('active');
    }

    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label;
    item.appendChild(anchor);

    return item;
  }

  function formatPatientName(patient) {
    return `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unnamed patient';
  }

  function formatStaffName(staff) {
    return staff.fullName || staff.email || 'Unnamed staff member';
  }

  function renderSearchStatus(resultsPanel, message) {
    resultsPanel.innerHTML = `
      <div class="hms-search-status">${escapeHtml(message)}</div>
    `;
    resultsPanel.hidden = false;
  }

  function renderPatientResult(patient) {
    const meta = [
      patient.patientId,
      patient.phone,
      patient.email
    ].filter(Boolean).join(' | ');

    return `
      <div class="hms-search-result" role="listitem">
        <i class="material-icons teal-text text-darken-2">person</i>
        <div>
          <div class="hms-search-result-title">${escapeHtml(formatPatientName(patient))}</div>
          <div class="hms-search-result-meta">${escapeHtml(meta || 'Patient record')}</div>
        </div>
      </div>
    `;
  }

  function renderStaffResult(staff) {
    const meta = [
      staff.role,
      staff.email
    ].filter(Boolean).join(' | ');

    return `
      <div class="hms-search-result" role="listitem">
        <i class="material-icons teal-text text-darken-2">badge</i>
        <div>
          <div class="hms-search-result-title">${escapeHtml(formatStaffName(staff))}</div>
          <div class="hms-search-result-meta">${escapeHtml(meta || 'Staff record')}</div>
        </div>
      </div>
    `;
  }

  function renderSearchResults(resultsPanel, result) {
    const patients = result.patients || [];
    const staff = result.staff || [];

    if (patients.length === 0 && staff.length === 0) {
      renderSearchStatus(resultsPanel, 'No matching patients or staff found.');
      return;
    }

    const patientSection = patients.length
      ? `
        <div class="hms-search-group">
          <div class="hms-search-group-title">Patients</div>
          ${patients.map(renderPatientResult).join('')}
        </div>
      `
      : '';

    const staffSection = staff.length
      ? `
        <div class="hms-search-group">
          <div class="hms-search-group-title">Staff</div>
          ${staff.map(renderStaffResult).join('')}
        </div>
      `
      : '';

    resultsPanel.innerHTML = patientSection + staffSection;
    resultsPanel.hidden = false;
  }

  function createSearchItem() {
    const item = document.createElement('li');
    item.className = 'hms-search-item';

    item.innerHTML = `
      <div class="hms-search-shell">
        <i class="material-icons hms-search-icon">search</i>
        <input
          id="navDirectorySearch"
          type="search"
          autocomplete="off"
          placeholder="Search patients or staff"
          aria-label="Search patients by ID or name, and staff by name"
        />
        <button
          id="navSearchClear"
          class="hms-search-clear"
          type="button"
          aria-label="Clear search"
          hidden
        >
          <i class="material-icons">close</i>
        </button>
        <div
          id="navSearchResults"
          class="hms-search-results"
          role="list"
          hidden
        ></div>
      </div>
    `;

    const input = item.querySelector('#navDirectorySearch');
    const clearButton = item.querySelector('#navSearchClear');
    const resultsPanel = item.querySelector('#navSearchResults');
    let searchTimer = null;
    let searchRequest = null;

    function hideResults() {
      resultsPanel.hidden = true;
    }

    async function runSearch(query) {
      if (searchRequest) {
        searchRequest.abort();
      }

      searchRequest = new AbortController();
      renderSearchStatus(resultsPanel, 'Searching...');

      try {
        const response = await fetch(`/search/data?q=${encodeURIComponent(query)}`, {
          headers: { Accept: 'application/json' },
          signal: searchRequest.signal
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          renderSearchStatus(resultsPanel, result.message || 'Search is unavailable right now.');
          return;
        }

        renderSearchResults(resultsPanel, result);
      } catch (error) {
        if (error.name !== 'AbortError') {
          renderSearchStatus(resultsPanel, 'Search is unavailable right now.');
        }
      }
    }

    input.addEventListener('input', () => {
      const query = input.value.trim();

      clearButton.hidden = query.length === 0;
      window.clearTimeout(searchTimer);

      if (query.length < 2) {
        hideResults();
        return;
      }

      searchTimer = window.setTimeout(() => runSearch(query), searchDelayMs);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2 && resultsPanel.innerHTML) {
        resultsPanel.hidden = false;
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideResults();
        input.blur();
      }
    });

    clearButton.addEventListener('click', () => {
      input.value = '';
      clearButton.hidden = true;
      hideResults();
      input.focus();
    });

    document.addEventListener('click', (event) => {
      if (!item.contains(event.target)) {
        hideResults();
      }
    });

    return item;
  }

  function createLogoutItem() {
    const item = document.createElement('li');
    const button = document.createElement('button');

    button.id = 'navLogoutButton';
    button.type = 'button';
    button.className = 'btn red darken-1 waves-effect waves-light';
    button.innerHTML = 'Logout <i class="material-icons right">logout</i>';

    button.addEventListener('click', async () => {
      try {
        const response = await fetch('/logout', { method: 'POST' });
        const data = await response.json();
        window.location.href = data.redirectUrl || '/login';
      } catch (error) {
        window.location.href = '/login';
      }
    });

    item.appendChild(button);
    return item;
  }

  function renderNav(user) {
    navLinks.innerHTML = '';

    if (searchRoles.includes(user.role)) {
      navLinks.appendChild(createSearchItem());
    }

    links
      .filter((link) => link.roles.includes(user.role))
      .forEach((link) => {
        navLinks.appendChild(createLinkItem(link));
      });

    navLinks.appendChild(createLogoutItem());
  }

  async function initNavbar() {
    try {
      const response = await fetch('/me', {
        headers: { Accept: 'application/json' }
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        window.location.href = '/login';
        return;
      }

      renderNav(result.user);
    } catch (error) {
      window.location.href = '/login';
    }
  }

  initNavbar();
})();
