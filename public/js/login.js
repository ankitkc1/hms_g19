const loginForm = document.getElementById('loginForm');
const messageBox = document.getElementById('messageBox');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const loginButton = document.getElementById('loginButton');

function showMessage(message, type = 'error') {
  messageBox.textContent = message;
  messageBox.className = `message-box ${type}`;
}

function clearMessages() {
  messageBox.textContent = '';
  messageBox.className = 'message-box hide';
  emailError.textContent = '';
  passwordError.textContent = '';
}

const params = new URLSearchParams(window.location.search);

if (params.get('timeout') === '1') {
  showMessage('You were logged out after 30 minutes of inactivity.', 'warning');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessages();

  loginButton.disabled = true;
  loginButton.textContent = 'Logging in...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.errors) {
        emailError.textContent = data.errors.email || '';
        passwordError.textContent = data.errors.password || '';
      }

      showMessage(data.message || 'Login failed.', 'error');
      return;
    }

    showMessage(data.message || 'Login successful.', 'success');
    window.location.href = data.redirectUrl || '/dashboard';
  } catch (error) {
    showMessage('Unable to connect to the server. Please try again.', 'error');
  } finally {
    loginButton.disabled = false;
    loginButton.innerHTML = 'Login <i class="material-icons right">login</i>';
  }
});