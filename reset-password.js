const $ = id => document.getElementById(id);
const requestPanel = $('requestPanel');
const resetPanel = $('resetPanel');
const unavailablePanel = $('recoveryUnavailable');
const requestStatus = $('requestStatus');
const resetStatus = $('resetStatus');

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setStatus(node, message, kind = '') {
  node.textContent = message || '';
  node.dataset.kind = kind;
}
const url = new URL(location.href);
const token = url.searchParams.get('token') || '';

async function initialize() {
  if (token) {
    requestPanel.classList.add('hidden');
    resetPanel.classList.remove('hidden');
    history.replaceState({}, '', '/reset-password.html');
    return;
  }

  try {
    const capabilities = await api('/api/help/auth/capabilities');
    if (!capabilities.emailDeliveryAvailable) {
      requestPanel.classList.add('hidden');
      unavailablePanel.classList.remove('hidden');
    }
  } catch {
    // Leave the request form visible; the submit path will surface any service problem.
  }
}
$('requestResetForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus(requestStatus, 'Sending reset instructions…');
  try {
    const data = await api('/api/help/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email') }),
    });
    event.currentTarget.reset();
    setStatus(requestStatus, data.message || 'If an account exists for that email, a reset link has been sent.', 'success');
  } catch (error) {
    setStatus(requestStatus, error.message, 'error');
  } finally {
    button.disabled = false;
  }
});
$('resetPasswordForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const password = String(form.get('password') || '');
  const confirm = String(form.get('confirmPassword') || '');
  if (password !== confirm) {
    setStatus(resetStatus, 'The two passwords do not match.', 'error');
    return;
  }

  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus(resetStatus, 'Updating your password…');
  try {
    await api('/api/help/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    event.currentTarget.reset();
    event.currentTarget.classList.add('hidden');
    resetStatus.innerHTML = 'Password updated. <a href="/apply.html">Sign in with your new password →</a>';
    resetStatus.dataset.kind = 'success';
  } catch (error) {
    setStatus(resetStatus, error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

initialize();
