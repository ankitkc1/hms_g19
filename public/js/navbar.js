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
