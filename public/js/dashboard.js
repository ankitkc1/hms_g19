const userInfo = document.getElementById('userInfo');
const logoutButton = document.getElementById('logoutButton');

function updateNavigation(role) {
  document.querySelectorAll('.role-link').forEach((item) => {
    const allowedRoles = item.dataset.roles.split(',');
    item.style.display = allowedRoles.includes(role) ? '' : 'none';
  });
}


async function loadCurrentUser() {
  try {
    const response = await fetch('/me');
    const data = await response.json();

    if (!response.ok) {
      window.location.href = '/login';
      return;
    }

    userInfo.textContent = `Logged in as ${data.user.email} (${data.user.role})`;
    updateNavigation(data.user.role);

  } catch (error) {
    userInfo.textContent = 'Unable to load user details.';
  }
}

async function logoutUser() {
  try {
    const response = await fetch('/logout', {
      method: 'POST'
    });

    const data = await response.json();
    window.location.href = data.redirectUrl || '/login';
  } catch (error) {
    window.location.href = '/login';
  }
}

logoutButton.addEventListener('click', logoutUser);

loadCurrentUser();