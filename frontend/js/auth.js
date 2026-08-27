const API_URL = 'http://localhost:5000/api';
const form = document.getElementById('authForm');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const nameField = document.getElementById('nameField');
const roleField = document.getElementById('roleField');
const title = document.getElementById('title');
const subtitle = document.getElementById('subtitle');
const submitBtn = document.getElementById('submitBtn');
const message = document.getElementById('message');

let mode = 'login';

function setMode(nextMode) {
  mode = nextMode;
  const register = mode === 'register';
  loginTab.classList.toggle('active', !register);
  registerTab.classList.toggle('active', register);
  nameField.style.display = register ? 'block' : 'none';
  roleField.style.display = register ? 'block' : 'none';
  document.getElementById('name').required = register;
  title.textContent = register ? 'Create an account' : 'Sign in';
  subtitle.textContent = register ? 'Create an account to use the disaster response system.' : 'Sign in to manage your Disaster Response account.';
  submitBtn.textContent = register ? 'Create account →' : 'Sign in →';
  message.style.display = 'none';
}

loginTab.addEventListener('click', () => setMode('login'));
registerTab.addEventListener('click', () => setMode('register'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = mode === 'register' ? 'Creating...' : 'Signing in...';
  message.style.display = 'none';

  const payload = {
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value
  };

  if (mode === 'register') {
    payload.name = document.getElementById('name').value.trim();
    payload.role = document.getElementById('role').value;
  }

  try {
    const response = await fetch(`${API_URL}/auth/${mode === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');

    localStorage.setItem('disasterToken', data.token);
    localStorage.setItem('disasterUser', JSON.stringify(data.user));
    message.textContent = `Success. Welcome, ${data.user.name}.`;
    message.style.display = 'block';

    setTimeout(() => {
      window.location.href = data.user.role === 'authority' ? 'dashboard.html' : 'report.html';
    }, 700);
  } catch (error) {
    message.textContent = error.message;
    message.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === 'register' ? 'Create account →' : 'Sign in →';
  }
});
