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
      label: 'Assigned Patients',
      href: '/doctor/patients',
      roles: ['doctor']
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
      label: 'Notify Staff',
      href: '/notifications/notif',
      roles: ['admin']
    },
    {
      label: 'My Profile',
      href: '/profile',
      roles: ['patient']
    },  
    {
      label: 'Departments',
      href: '/departments',
      roles: ['admin']
    },
    {
      label: 'Audit Logs',
      href: '/audit',
      roles: ['admin']
    },
   {
      label: 'Reports',
      href: '/reports',
      roles: ['admin']
    },
    {
      label: 'Observations',
      href: '/nurse/observations',
      roles: ['nurse']
   }
  ];
  const searchRoles = ['admin', 'reception', 'doctor', 'nurse'];
  const notificationRoles = ['admin', 'reception', 'doctor', 'nurse'];
  const searchDelayMs = 250;
  const notificationLimit = 8;
  let socketClientPromise = null;

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

  function loadSocketIoClient() {
    if (window.io) {
      return Promise.resolve(window.io);
    }

    if (socketClientPromise) {
      return socketClientPromise;
    }

    socketClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.async = true;
      script.onload = () => resolve(window.io);
      script.onerror = () => reject(new Error('Could not load realtime notifications.'));
      document.head.appendChild(script);
    });

    return socketClientPromise;
  }

  function formatNotificationTime(value) {
    if (!value) return '';

    return new Date(value).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function showNotificationToast(notification) {
    let toastWrap = document.getElementById('hmsNotificationToasts');

    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.id = 'hmsNotificationToasts';
      toastWrap.className = 'hms-notification-toasts';
      document.body.appendChild(toastWrap);
    }

    const toast = document.createElement('div');
    toast.className = 'hms-notification-toast';
    toast.innerHTML = `
      <button class="hms-notification-toast-close" type="button" aria-label="Dismiss notification">
        <i class="material-icons">close</i>
      </button>
      <div class="hms-notification-toast-title">${escapeHtml(notification.title)}</div>
      <div class="hms-notification-toast-message">${escapeHtml(notification.message)}</div>
      <div class="hms-notification-toast-meta">From ${escapeHtml(notification.senderName || 'Administrator')}</div>
    `;

    const closeButton = toast.querySelector('.hms-notification-toast-close');
    const removeToast = () => {
      toast.classList.add('is-hiding');
      window.setTimeout(() => toast.remove(), 180);
    };

    closeButton.addEventListener('click', removeToast);
    toastWrap.appendChild(toast);
    window.setTimeout(removeToast, 8000);
  }

  function renderNotificationStatus(list, message) {
    list.innerHTML = `
      <div class="hms-notification-empty">${escapeHtml(message)}</div>
    `;
  }

  function createNotificationItem() {
    const item = document.createElement('li');
    item.className = 'hms-notification-item';
    item.innerHTML = `
      <div class="hms-notification-shell">
        <button
          id="navNotificationButton"
          class="hms-notification-button"
          type="button"
          aria-label="Notifications"
          aria-expanded="false"
        >
          <i class="material-icons">notifications</i>
          <span id="navNotificationBadge" class="hms-notification-badge" hidden>0</span>
        </button>
        <div id="navNotificationPanel" class="hms-notification-panel" hidden>
          <div class="hms-notification-panel-header">
            <strong>Notifications</strong>
            <span id="navNotificationState">Realtime</span>
          </div>
          <div id="navNotificationList" class="hms-notification-list">
            <div class="hms-notification-empty">Loading notifications...</div>
          </div>
        </div>
      </div>
    `;

    const button = item.querySelector('#navNotificationButton');
    const badge = item.querySelector('#navNotificationBadge');
    const panel = item.querySelector('#navNotificationPanel');
    const list = item.querySelector('#navNotificationList');
    const state = item.querySelector('#navNotificationState');
    let notifications = [];
    let unreadCount = 0;

    function updateBadge() {
      badge.hidden = unreadCount === 0;
      badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    }

    function renderList() {
      const visibleNotifications = notifications.slice(0, notificationLimit);

      if (visibleNotifications.length === 0) {
        renderNotificationStatus(list, 'No notifications yet.');
        return;
      }

      list.innerHTML = visibleNotifications.map((notification) => `
        <div class="hms-notification-row${notification.read ? '' : ' unread'}">
          <div class="hms-notification-row-title">${escapeHtml(notification.title)}</div>
          <div class="hms-notification-row-message">${escapeHtml(notification.message)}</div>
          <div class="hms-notification-row-meta">
            ${escapeHtml(notification.senderName || 'Administrator')} | ${escapeHtml(formatNotificationTime(notification.createdAt))}
          </div>
        </div>
      `).join('');
    }

    async function markVisibleRead() {
      const unreadIds = notifications
        .filter((notification) => !notification.read)
        .map((notification) => notification.id);

      if (unreadIds.length === 0) {
        return;
      }

      notifications = notifications.map((notification) => ({
        ...notification,
        read: true
      }));
      unreadCount = Math.max(0, unreadCount - unreadIds.length);
      updateBadge();
      renderList();

      try {
        await fetch('/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: unreadIds })
        });
      } catch (error) {
        // The next page load will reconcile read state from the server.
      }
    }

    async function loadNotifications() {
      try {
        const response = await fetch('/notifications/mine', {
          headers: { Accept: 'application/json' }
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          renderNotificationStatus(list, result.message || 'Could not load notifications.');
          return;
        }

        notifications = result.notifications || [];
        unreadCount = result.unreadCount || 0;
        updateBadge();
        renderList();
      } catch (error) {
        renderNotificationStatus(list, 'Could not load notifications.');
      }
    }

    async function connectRealtime() {
      try {
        const ioClient = await loadSocketIoClient();
        const socket = ioClient();

        socket.on('connect', () => {
          state.textContent = 'Realtime';
          state.classList.remove('red-text');
        });

        socket.on('connect_error', () => {
          state.textContent = 'Offline';
          state.classList.add('red-text');
        });

        socket.on('notification:new', (notification) => {
          notifications = [{ ...notification, read: false }, ...notifications];
          unreadCount += 1;
          updateBadge();
          renderList();
          showNotificationToast(notification);
        });
      } catch (error) {
        state.textContent = 'Offline';
        state.classList.add('red-text');
      }
    }

    button.addEventListener('click', () => {
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      button.setAttribute('aria-expanded', String(!isOpen));

      if (!isOpen) {
        markVisibleRead();
      }
    });

    document.addEventListener('click', (event) => {
      if (!item.contains(event.target)) {
        panel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
      }
    });

    loadNotifications();
    connectRealtime();

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

    links
      .filter((link) => link.roles.includes(user.role))
      .forEach((link) => {
        navLinks.appendChild(createLinkItem(link));
      });

    if (searchRoles.includes(user.role)) {
      navLinks.appendChild(createSearchItem());
    }

    if (notificationRoles.includes(user.role)) {
      navLinks.appendChild(createNotificationItem());
    }

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
