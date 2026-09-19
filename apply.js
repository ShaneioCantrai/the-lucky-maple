const $ = id => document.getElementById(id);
const authPanel = $('authPanel');
const applicationPanel = $('applicationPanel');
const applicationForm = $('applicationForm');
const authStatus = $('authStatus');
const applicationStatus = $('applicationStatus');
let currentApplication = null;
let currentApplicantState = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
  });
  if (response.status === 204) return {};
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
function showAuth(tab = 'register') {
  authPanel.classList.remove('hidden');
  applicationPanel.classList.add('hidden');
  document.querySelectorAll('[data-auth-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.authTab === tab);
  });
  $('registerForm').classList.toggle('hidden', tab !== 'register');
  $('loginForm').classList.toggle('hidden', tab !== 'login');
}

function statusCopy(status) {
  return ({
    draft: ['Draft saved', 'Your application is private and has not been submitted yet.'],
    submitted: ['Submitted', 'Your application is in the MapleWish review queue. You can still make corrections until review begins.'],
    reviewing: ['In review', 'The MapleWish team is reviewing your application.'],
    need_more_info: ['More information requested', 'Please update the requested details, save, and submit again.'],
    shortlisted: ['Shortlisted', 'Your application is being considered for an upcoming wish.'],
    approved: ['Approved', 'The team is preparing the next steps with you privately.'],
    published: ['Wish published', 'Your approved public wish is live.'],
    funded: ['Funded', 'This MapleWish has been funded.'],
    declined: ['Closed', 'This application was not selected for assistance.'],
    paid: ['Help delivered', 'Assistance for this case has been delivered.'],
    closed: ['Closed', 'This application is closed.'],
  })[status] || ['Application', status || ''];
}
function renderState(application) {
  currentApplication = application || null;
  const state = $('applicationState');
  if (!application) {
    state.classList.add('hidden');
    setEditable(true);
    renderPhoto(false);
    return;
  }
  const [title, copy] = statusCopy(application.status);
  state.innerHTML = `<b>${title}</b><span>${copy}</span>`;
  state.className = `application-state state-${application.status}`;
  setEditable(['draft','submitted','need_more_info'].includes(application.status));
  renderPhoto(Boolean(application.has_photo));
}

function setEditable(editable) {
  applicationForm.querySelectorAll('input,select,textarea,button').forEach(node => {
    if (node.id === 'logoutButton') return;
    node.disabled = !editable;
  });
  $('removePhotoButton').disabled = !editable;
}

function renderPhoto(hasPhoto) {
  const preview = $('photoPreview');
  $('removePhotoButton').classList.toggle('hidden', !hasPhoto);
  if (!hasPhoto) {
    preview.innerHTML = '<span>📷</span><small>No photo uploaded</small>';
    return;
  }
  preview.innerHTML = `<img src="/api/help/application/photo?v=${Date.now()}" alt="Your private application photo" />`;
}
function setFormValue(name, value) {
  const field = applicationForm.elements[name];
  if (!field) return;
  if (field.type === 'checkbox') field.checked = Boolean(value);
  else field.value = value ?? '';
}

function fillForm(application) {
  if (!application) return;
  setFormValue('name', application.applicant_name);
  setFormValue('province', application.province);
  setFormValue('city', application.city);
  setFormValue('preferredContact', application.preferred_contact);
  setFormValue('phone', application.phone);
  setFormValue('category', application.request_category);
  setFormValue('requestedAmount', Number(application.requested_cents || 0) / 100);
  setFormValue('summary', application.request_summary);
  setFormValue('privateStory', application.private_story);
  setFormValue('publicStoryDraft', application.public_story_draft);
  setFormValue('publicIdentityPreference', application.public_identity_preference);
  setFormValue('publicAlias', application.public_alias);
  setFormValue('openToPublicStory', application.open_to_public_story);
  setFormValue('eligibilityConfirmed', application.eligibility_confirmed);
  setFormValue('accuracyConfirmed', application.accuracy_confirmed);
  setFormValue('privacyAcknowledged', application.applicant_privacy_accepted || application.privacy_acknowledged);
  setFormValue('applicationTermsAccepted', application.application_terms_accepted);
}
function payloadFromForm() {
  const form = new FormData(applicationForm);
  return {
    name: String(form.get('name') || '').trim(),
    province: String(form.get('province') || '').trim(),
    city: String(form.get('city') || '').trim(),
    preferredContact: String(form.get('preferredContact') || 'email'),
    phone: String(form.get('phone') || '').trim(),
    category: String(form.get('category') || '').trim(),
    requestedCents: Math.round(Number(form.get('requestedAmount') || 0) * 100),
    summary: String(form.get('summary') || '').trim(),
    privateStory: String(form.get('privateStory') || '').trim(),
    publicStoryDraft: String(form.get('publicStoryDraft') || '').trim(),
    publicIdentityPreference: String(form.get('publicIdentityPreference') || 'first_name'),
    publicAlias: String(form.get('publicAlias') || '').trim(),
    openToPublicStory: form.get('openToPublicStory') === 'on',
    eligibilityConfirmed: form.get('eligibilityConfirmed') === 'on',
    accuracyConfirmed: form.get('accuracyConfirmed') === 'on',
    privacyAcknowledged: form.get('privacyAcknowledged') === 'on',
    applicationTermsAccepted: form.get('applicationTermsAccepted') === 'on',
  };
}
function renderVerification(data) {
  const notice = $('verificationNotice');
  const resend = $('resendVerificationButton');
  if (data.emailVerified) {
    notice.classList.add('hidden');
    return;
  }
  if (!data.emailDeliveryAvailable && !data.verificationRequired) {
    notice.classList.add('hidden');
    return;
  }
  notice.classList.remove('hidden');
  resend.classList.toggle('hidden', !data.emailDeliveryAvailable);
  $('verificationCopy').textContent = data.emailDeliveryAvailable
    ? (data.verificationRequired
      ? 'Check your inbox. Email verification is required before you can submit.'
      : 'Check your inbox for a verification link to secure your account.')
    : 'Email verification is required, but delivery is temporarily unavailable.';
}

async function showApplicant(data) {
  currentApplicantState = data;
  authPanel.classList.add('hidden');
  applicationPanel.classList.remove('hidden');
  $('accountEmail').textContent = data.email || '';
  if (data.application) fillForm(data.application);
  renderVerification(data);
  renderState(data.application || null);
}

async function loadSession() {
  const verificationResult = new URL(location.href).searchParams.get('verified');
  try {
    const data = await api('/api/help/me');
    await showApplicant(data);
    if (verificationResult === '1') setStatus(applicationStatus, 'Email verified. Thank you.', 'success');
    else if (verificationResult === '0') setStatus(applicationStatus, 'That verification link is invalid or has expired.', 'error');
    if (verificationResult) history.replaceState({}, '', '/apply.html');
  } catch (error) {
    if (error.status === 401) showAuth('register');
    else {
      showAuth('register');
      setStatus(authStatus, error.message, 'error');
    }
  }
}

document.querySelectorAll('[data-auth-tab]').forEach(button => {
  button.addEventListener('click', () => {
    setStatus(authStatus, '');
    showAuth(button.dataset.authTab);
  });
});
$('registerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  setStatus(authStatus, 'Creating your private account…');
  try {
    const data = await api('/api/help/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    event.currentTarget.reset();
    await showApplicant(data);
    if (data.verificationEmailSent) {
      setStatus(applicationStatus, 'Account created. We sent a verification link to your email.', 'success');
    }
  } catch (error) { setStatus(authStatus, error.message, 'error'); }
});

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  setStatus(authStatus, 'Signing in…');
  try {
    const data = await api('/api/help/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    event.currentTarget.reset();
    await showApplicant(data);
  } catch (error) { setStatus(authStatus, error.message, 'error'); }
});
$('resendVerificationButton').addEventListener('click', async () => {
  const button = $('resendVerificationButton');
  button.disabled = true;
  $('verificationCopy').textContent = 'Sending a fresh verification link…';
  try {
    const data = await api('/api/help/auth/resend-verification', { method: 'POST' });
    if (data.alreadyVerified) {
      currentApplicantState.emailVerified = true;
      renderVerification(currentApplicantState);
      setStatus(applicationStatus, 'Your email is already verified.', 'success');
    } else {
      $('verificationCopy').textContent = 'Verification email sent. The link expires in 24 hours.';
    }
  } catch (error) {
    $('verificationCopy').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

$('logoutButton').addEventListener('click', async () => {
  try { await api('/api/help/auth/logout', { method: 'POST' }); } catch {}
  applicationForm.reset();
  currentApplication = null;
  currentApplicantState = null;
  setStatus(applicationStatus, '');
  showAuth('login');
});

applicationForm.addEventListener('submit', async event => {
  event.preventDefault();
  const action = event.submitter?.dataset.action || 'save';
  setStatus(applicationStatus, action === 'submit' ? 'Saving and submitting…' : 'Saving your private draft…');
  try {
    const saved = await api('/api/help/application', {
      method: 'PUT',
      body: JSON.stringify(payloadFromForm()),
    });
    currentApplication = saved.application;
    if (action === 'submit') {
      const submitted = await api('/api/help/application/submit', { method: 'POST' });
      currentApplication = submitted.application;
      setStatus(applicationStatus, 'Application submitted. You can return here to check its status.', 'success');
    } else {
      setStatus(applicationStatus, 'Draft saved privately.', 'success');
    }
    renderState(currentApplication);
  } catch (error) { setStatus(applicationStatus, error.message, 'error'); }
});
$('uploadPhotoButton').addEventListener('click', async () => {
  const file = $('photoInput').files?.[0];
  if (!currentApplication) {
    setStatus(applicationStatus, 'Save your draft first, then upload the private photo.', 'error');
    return;
  }
  if (!file) {
    setStatus(applicationStatus, 'Choose an image first.', 'error');
    return;
  }
  const body = new FormData();
  body.append('photo', file);
  setStatus(applicationStatus, 'Processing and privately storing your photo…');
  try {
    const data = await api('/api/help/application/photo', { method: 'POST', body });
    currentApplication = data.application;
    $('photoInput').value = '';
    renderPhoto(true);
    setStatus(applicationStatus, 'Private photo uploaded. Image metadata was removed.', 'success');
  } catch (error) { setStatus(applicationStatus, error.message, 'error'); }
});

$('removePhotoButton').addEventListener('click', async () => {
  if (!currentApplication?.has_photo) return;
  setStatus(applicationStatus, 'Removing photo…');
  try {
    await api('/api/help/application/photo', { method: 'DELETE' });
    currentApplication.has_photo = false;
    renderPhoto(false);
    setStatus(applicationStatus, 'Private photo removed.', 'success');
  } catch (error) { setStatus(applicationStatus, error.message, 'error'); }
});

loadSession();
