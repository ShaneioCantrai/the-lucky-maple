const $ = id => document.getElementById(id);
const authPanel = $('authPanel');
const applicationPanel = $('applicationPanel');
const applicationForm = $('applicationForm');
const authStatus = $('authStatus');
const applicationStatus = $('applicationStatus');
const IS_FR = document.documentElement.lang.toLowerCase().startsWith('fr');
const tr = (en, fr) => IS_FR ? fr : en;
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

function errorMessage(error) {
  const message = String(error?.message || '');
  if (!IS_FR) return message;
  const map = {
    'Sign in to continue.': 'Connectez-vous pour continuer.',
    'Your session has expired. Please sign in again.': 'Votre session a expiré. Veuillez vous reconnecter.',
    'Applications are not open yet.': 'Les demandes ne sont pas encore ouvertes.',
    'Email verification is temporarily unavailable.': 'La vérification du courriel est temporairement indisponible.',
    'An account already exists for that email.': 'Un compte existe déjà pour ce courriel.',
    'Email or password is incorrect.': 'Le courriel ou le mot de passe est incorrect.',
    'Verification email delivery is not configured yet.': 'L’envoi du courriel de vérification n’est pas encore configuré.',
    'Verify your email before submitting your application.': 'Vérifiez votre courriel avant de soumettre votre demande.',
    'Add a phone number for the contact method you selected.': 'Ajoutez un numéro de téléphone pour le moyen de contact choisi.',
    'Add the pseudonym you would want us to use.': 'Ajoutez le pseudonyme que vous souhaitez que nous utilisions.',
    'Please complete the required confirmations before submitting.': 'Veuillez remplir les confirmations requises avant de soumettre.',
    'This application is being reviewed and cannot be edited right now.': 'Cette demande est en cours d’examen et ne peut pas être modifiée pour le moment.',
    'This application is already in review.': 'Cette demande est déjà en cours d’examen.',
    'Save your application before submitting it.': 'Enregistrez votre demande avant de la soumettre.',
  };
  return map[message] || message;
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
  const en = {
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
  };
  const fr = {
    draft: ['Brouillon enregistré', 'Votre demande est privée et n’a pas encore été soumise.'],
    submitted: ['Soumise', 'Votre demande est dans la file d’examen MapleWish. Vous pouvez encore la corriger jusqu’au début de l’examen.'],
    reviewing: ['En cours d’examen', 'L’équipe MapleWish examine votre demande.'],
    need_more_info: ['Renseignements supplémentaires demandés', 'Veuillez mettre à jour les renseignements demandés, enregistrer, puis soumettre de nouveau.'],
    shortlisted: ['Présélectionnée', 'Votre demande est considérée pour un prochain souhait.'],
    approved: ['Approuvée', 'L’équipe prépare les prochaines étapes avec vous en privé.'],
    published: ['Souhait publié', 'Votre souhait public approuvé est en ligne.'],
    funded: ['Financé', 'Ce souhait MapleWish a été financé.'],
    declined: ['Fermée', 'Cette demande n’a pas été retenue pour une aide.'],
    paid: ['Aide versée', 'L’aide pour ce dossier a été versée.'],
    closed: ['Fermée', 'Cette demande est fermée.'],
  };
  return (IS_FR ? fr : en)[status] || [tr('Application','Demande'), status || ''];
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
    preview.innerHTML = `<span>📷</span><small>${tr('No photo uploaded','Aucune photo téléversée')}</small>`;
    return;
  }
  preview.innerHTML = `<img src="/api/help/application/photo?v=${Date.now()}" alt="${tr('Your private application photo','Votre photo privée de demande')}" />`;
}
function isQuebecProvince(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'quebec' || normalized === 'québec';
}

function updateLanguageChoiceUI() {
  const province = applicationForm.elements.province?.value;
  const row = $('englishLanguageChoiceRow');
  if (!row) return;
  row.classList.toggle('hidden', IS_FR || !isQuebecProvince(province));
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
  setFormValue('englishLanguageChoiceConfirmed', application.english_language_choice_confirmed);
  updateLanguageChoiceUI();
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
    contractLanguage: IS_FR ? 'fr-CA' : 'en-CA',
    frenchVersionPresented: true,
    englishLanguageChoiceConfirmed: IS_FR ? false : form.get('englishLanguageChoiceConfirmed') === 'on',
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
      ? tr('Check your inbox. Email verification is required before you can submit.','Consultez votre boîte de réception. La vérification de votre courriel est requise avant de soumettre.')
      : tr('Check your inbox for a verification link to secure your account.','Consultez votre boîte de réception pour le lien de vérification qui sécurise votre compte.'))
    : tr('Email verification is required, but delivery is temporarily unavailable.','La vérification du courriel est requise, mais l’envoi est temporairement indisponible.');
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
    const desiredLanguage = IS_FR ? 'fr-CA' : 'en-CA';
    if (data.preferredLanguage !== desiredLanguage) {
      await api('/api/help/auth/language', {
        method: 'POST',
        body: JSON.stringify({ language: desiredLanguage }),
      });
      data.preferredLanguage = desiredLanguage;
    }
    await showApplicant(data);
    if (verificationResult === '1') setStatus(applicationStatus, tr('Email verified. Thank you.','Courriel vérifié. Merci.'), 'success');
    else if (verificationResult === '0') setStatus(applicationStatus, tr('That verification link is invalid or has expired.','Ce lien de vérification est invalide ou expiré.'), 'error');
    if (verificationResult) history.replaceState({}, '', IS_FR ? '/fr/apply.html' : '/apply.html');
  } catch (error) {
    if (error.status === 401) showAuth('register');
    else {
      showAuth('register');
      setStatus(authStatus, errorMessage(error), 'error');
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
  setStatus(authStatus, tr('Creating your private account…','Création de votre compte privé…'));
  try {
    const data = await api('/api/help/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password'), language: IS_FR ? 'fr-CA' : 'en-CA' }),
    });
    event.currentTarget.reset();
    await showApplicant(data);
    if (data.verificationEmailSent) {
      setStatus(applicationStatus, tr('Account created. We sent a verification link to your email.','Compte créé. Nous avons envoyé un lien de vérification à votre courriel.'), 'success');
    }
  } catch (error) { setStatus(authStatus, errorMessage(error), 'error'); }
});

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  setStatus(authStatus, tr('Signing in…','Connexion…'));
  try {
    const data = await api('/api/help/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password'), language: IS_FR ? 'fr-CA' : 'en-CA' }),
    });
    event.currentTarget.reset();
    await showApplicant(data);
  } catch (error) { setStatus(authStatus, errorMessage(error), 'error'); }
});
$('resendVerificationButton').addEventListener('click', async () => {
  const button = $('resendVerificationButton');
  button.disabled = true;
  $('verificationCopy').textContent = tr('Sending a fresh verification link…','Envoi d’un nouveau lien de vérification…');
  try {
    const data = await api('/api/help/auth/resend-verification', { method: 'POST' });
    if (data.alreadyVerified) {
      currentApplicantState.emailVerified = true;
      renderVerification(currentApplicantState);
      setStatus(applicationStatus, tr('Your email is already verified.','Votre courriel est déjà vérifié.'), 'success');
    } else {
      $('verificationCopy').textContent = tr('Verification email sent. The link expires in 24 hours.','Courriel de vérification envoyé. Le lien expire dans 24 heures.');
    }
  } catch (error) {
    $('verificationCopy').textContent = errorMessage(error);
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
  setStatus(applicationStatus, action === 'submit' ? tr('Saving and submitting…','Enregistrement et soumission…') : tr('Saving your private draft…','Enregistrement de votre brouillon privé…'));
  try {
    const saved = await api('/api/help/application', {
      method: 'PUT',
      body: JSON.stringify(payloadFromForm()),
    });
    currentApplication = saved.application;
    if (action === 'submit') {
      const submitted = await api('/api/help/application/submit', { method: 'POST' });
      currentApplication = submitted.application;
      setStatus(applicationStatus, tr('Application submitted. You can return here to check its status.','Demande soumise. Vous pouvez revenir ici pour vérifier son état.'), 'success');
    } else {
      setStatus(applicationStatus, tr('Draft saved privately.','Brouillon enregistré en privé.'), 'success');
    }
    renderState(currentApplication);
  } catch (error) { setStatus(applicationStatus, errorMessage(error), 'error'); }
});
$('uploadPhotoButton').addEventListener('click', async () => {
  const file = $('photoInput').files?.[0];
  if (!currentApplication) {
    setStatus(applicationStatus, tr('Save your draft first, then upload the private photo.','Enregistrez d’abord votre brouillon, puis téléversez la photo privée.'), 'error');
    return;
  }
  if (!file) {
    setStatus(applicationStatus, tr('Choose an image first.','Choisissez d’abord une image.'), 'error');
    return;
  }
  const body = new FormData();
  body.append('photo', file);
  setStatus(applicationStatus, tr('Processing and privately storing your photo…','Traitement et stockage privé de votre photo…'));
  try {
    const data = await api('/api/help/application/photo', { method: 'POST', body });
    currentApplication = data.application;
    $('photoInput').value = '';
    renderPhoto(true);
    setStatus(applicationStatus, tr('Private photo uploaded. Image metadata was removed.','Photo privée téléversée. Les métadonnées de l’image ont été supprimées.'), 'success');
  } catch (error) { setStatus(applicationStatus, errorMessage(error), 'error'); }
});

applicationForm.elements.province?.addEventListener('change', updateLanguageChoiceUI);
updateLanguageChoiceUI();

$('removePhotoButton').addEventListener('click', async () => {
  if (!currentApplication?.has_photo) return;
  setStatus(applicationStatus, tr('Removing photo…','Suppression de la photo…'));
  try {
    await api('/api/help/application/photo', { method: 'DELETE' });
    currentApplication.has_photo = false;
    renderPhoto(false);
    setStatus(applicationStatus, tr('Private photo removed.','Photo privée supprimée.'), 'success');
  } catch (error) { setStatus(applicationStatus, errorMessage(error), 'error'); }
});

loadSession();
