const $ = id => document.getElementById(id);
const requestPanel = $('requestPanel');
const resetPanel = $('resetPanel');
const unavailablePanel = $('recoveryUnavailable');
const requestStatus = $('requestStatus');
const resetStatus = $('resetStatus');
const IS_FR = document.documentElement.lang.toLowerCase().startsWith('fr');
const tr = (en, fr) => IS_FR ? fr : en;

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
    history.replaceState({}, '', IS_FR ? '/fr/reset-password.html' : '/reset-password.html');
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
  setStatus(requestStatus, tr('Sending reset instructions…','Envoi des instructions de réinitialisation…'));
  try {
    const data = await api('/api/help/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email') }),
    });
    event.currentTarget.reset();
    setStatus(requestStatus, tr('If an account exists for that email, a reset link has been sent.','Si un compte existe pour ce courriel, un lien de réinitialisation a été envoyé.'), 'success');
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
    setStatus(resetStatus, tr('The two passwords do not match.','Les deux mots de passe ne correspondent pas.'), 'error');
    return;
  }

  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus(resetStatus, tr('Updating your password…','Mise à jour de votre mot de passe…'));
  try {
    await api('/api/help/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    event.currentTarget.reset();
    event.currentTarget.classList.add('hidden');
    resetStatus.innerHTML = IS_FR
      ? 'Mot de passe mis à jour. <a href="/fr/apply.html">Connectez-vous avec votre nouveau mot de passe →</a>'
      : 'Password updated. <a href="/apply.html">Sign in with your new password →</a>';
    resetStatus.dataset.kind = 'success';
  } catch (error) {
    setStatus(resetStatus, error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

initialize();
