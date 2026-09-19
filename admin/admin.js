const $ = id => document.getElementById(id);
const money = cents => `$${(Number(cents || 0) / 100).toLocaleString('en-CA', { maximumFractionDigits: 2 })}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function renderCurrent(current) {
  if (!current) {
    $('currentTitle').textContent = 'No active tree';
    $('currentStatus').textContent = 'READY';
    $('currentEmpty').classList.remove('hidden');
    $('currentDetails').classList.add('hidden');
    return;
  }
  $('currentEmpty').classList.add('hidden');
  $('currentDetails').classList.remove('hidden');
  $('currentTitle').textContent = current.public_title;
  $('currentStatus').textContent = current.status.toUpperCase();
  $('currentWho').textContent = [current.recipient_alias, current.city, current.province].filter(Boolean).join(' · ');
  $('currentSummary').textContent = current.public_summary;
  $('currentRaised').textContent = money(current.raised_cents);
  $('currentGoal').textContent = money(current.goal_cents);
  $('currentLeaves').textContent = Number(current.leaves_filled || 0).toLocaleString('en-CA');
  $('currentRemaining').textContent = money(current.remaining_cents);
  const pct = Math.min(100, Number(current.raised_cents || 0) / Number(current.goal_cents || 1) * 100);
  $('currentProgress').style.width = `${pct}%`;
}
function renderCampaigns(campaigns) {
  $('campaignCount').textContent = `${campaigns.length} total`;
  $('campaignRows').innerHTML = campaigns.length ? campaigns.map(c => {
    const canActivate = c.status !== 'active' && c.verification_status === 'verified' && c.story_consent;
    let action = '';
    if (c.status === 'active') {
      action = `<button class="button small ghost" data-pause="${c.id}">Pause</button>`;
    } else if (canActivate) {
      action = `<button class="button small green" data-activate="${c.id}">Activate</button>`;
    } else {
      action = [
        c.verification_status !== 'verified' ? `<button class="button small ghost" data-verify="${c.id}">Mark verified</button>` : '',
        !c.story_consent ? `<button class="button small ghost" data-story-consent="${c.id}">Record recipient approval</button>` : '',
      ].filter(Boolean).join(' ');
    }
    return `<tr>
      <td><strong>${escapeHtml(c.public_title)}</strong><small>${escapeHtml(c.recipient_alias)} · ${escapeHtml(c.province)}</small></td>
      <td><span class="status ${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td>
      <td>${money(c.goal_cents)}</td><td>${money(c.raised_cents)}</td>
      <td>${escapeHtml(c.verification_status)}${c.story_consent ? ' · consent ✓' : ''}</td><td>${action}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="6">No campaigns yet.</td></tr>';
}

function renderCases(cases) {
  $('caseRows').innerHTML = cases.length ? cases.map(item => `<tr>
    <td><strong>${escapeHtml(item.applicant_name)}</strong><small>${item.has_photo ? 'photo · ' : ''}${escapeHtml(item.preferred_contact || 'email')}</small></td>
    <td>${escapeHtml(item.province)}</td><td>${escapeHtml(item.request_category)}</td>
    <td>${money(item.requested_cents)}</td><td><span class="status ${escapeHtml(item.status)}">${escapeHtml(item.status.replaceAll('_',' '))}</span></td>
    <td><button class="button small ghost" data-case="${item.id}">Review</button></td>
  </tr>`).join('') : '<tr><td colspan="6">No help requests yet.</td></tr>';
}

function renderContacts(requests) {
  $('contactRows').innerHTML = requests.length ? requests.map(item => `<tr>
    <td><span class="status ${escapeHtml(item.status)}">${escapeHtml(item.category)}</span><small>${escapeHtml(new Date(item.created_at).toLocaleString('en-CA'))}</small></td>
    <td><strong>${escapeHtml(item.name || 'No name')}</strong><small>${escapeHtml(item.email)}</small></td>
    <td><details><summary>View message</summary><p class="contact-message">${escapeHtml(item.message)}</p></details></td>
    <td>${escapeHtml(item.status)}</td>
    <td>${item.status !== 'closed'
      ? `<button class="button small ghost" data-contact-status="${item.id}" data-next-status="${item.status === 'new' ? 'reviewing' : 'closed'}">${item.status === 'new' ? 'Reviewing' : 'Close'}</button>`
      : ''}</td>
  </tr>`).join('') : '<tr><td colspan="5">No contact requests yet.</td></tr>';
}

function renderCaseDetail(data) {
  const item = data.case;
  $('caseDetail').dataset.caseId = item.id;
  $('caseDetailName').textContent = item.applicant_name;
  $('caseDetailMeta').textContent = [item.city, item.province, item.request_category, money(item.requested_cents)].filter(Boolean).join(' · ');
  const statuses = ['submitted','reviewing','need_more_info','shortlisted','approved','published','funded','declined','closed'];
  const notes = data.notes.length ? data.notes.map(note => `<div class="team-note"><b>${escapeHtml(note.actor)}</b><span>${escapeHtml(new Date(note.created_at).toLocaleString('en-CA'))}</span><p>${escapeHtml(note.note_text)}</p></div>`).join('') : '<p class="muted">No team notes yet.</p>';
  const wishDraft = ['shortlisted','approved'].includes(item.status) ? `
    <div class="case-block">
      <span class="eyebrow">CREATE WISH DRAFT</span><h3>Move this application toward the public tree</h3>
      <p class="muted">This creates a private draft campaign only. It cannot go live until the need is verified and the recipient separately approves the final public story.</p>
      <form id="wishFromCaseForm" class="case-form">
        <label>Public slug<input name="slug" required placeholder="first-name-city" /></label>
        <label>Public display name<input name="recipientAlias" required value="${escapeHtml(item.public_alias || (item.public_identity_preference === 'first_name' ? item.applicant_name.split(' ')[0] : ''))}" /></label>
        <label class="wide">Public headline<input name="title" required /></label>
        <label class="wide">Public story<textarea name="summary" rows="5" required>${escapeHtml(item.public_story_draft || '')}</textarea></label>
        <label>First goal (CAD)<input name="goal" type="number" min="1" step="1" required value="${Number(item.requested_cents || 0) / 100}" /></label>
        <div class="wide"><button class="button green" type="submit">Create private wish draft</button> <span id="wishCaseStatus" class="muted"></span></div>
      </form>
    </div>` : '';
  $('caseDetailBody').innerHTML = `
    <div class="case-review-grid">
      <div>
        ${item.has_photo ? `<img class="case-photo" src="/api/cases/${item.id}/photo?v=${Date.now()}" alt="Private applicant upload" />` : '<div class="case-photo empty">No photo</div>'}
        <div class="case-block"><b>Contact</b><p>${escapeHtml(item.applicant_email)}<br>${escapeHtml(item.phone || 'No phone')} · prefers ${escapeHtml(item.preferred_contact)}</p></div>
        <div class="case-block"><b>Public-sharing preference</b><p>${escapeHtml(item.public_identity_preference.replaceAll('_',' '))}${item.public_alias ? ' · ' + escapeHtml(item.public_alias) : ''}<br>${item.open_to_public_story ? 'Open to discussing a public story' : 'Did not opt into discussing a public story yet'}</p></div>
        <div class="case-block"><span class="eyebrow">LEGAL ACKNOWLEDGEMENTS</span><p>Applicant Privacy Notice: ${item.applicant_privacy_acknowledged_at ? '✓ ' + escapeHtml(item.applicant_privacy_version || '') : 'not recorded'}<br>Application Terms: ${item.application_terms_accepted_at ? '✓ ' + escapeHtml(item.application_terms_version || '') : 'not recorded'}<br>Contract language: ${escapeHtml(item.contract_language || 'not recorded')}${item.french_version_presented ? ' · French version presented ✓' : ''}${item.english_language_choice_confirmed ? ' · English expressly chosen ✓' : ''}</p></div>
      </div>
      <div>
        <div class="case-block"><span class="eyebrow">SPECIFIC NEED</span><h3>${money(item.requested_cents)} · ${escapeHtml(item.request_category)}</h3><p>${escapeHtml(item.request_summary)}</p></div>
        <div class="case-block private-copy"><span class="eyebrow">PRIVATE STORY · TEAM ONLY</span><p>${escapeHtml(item.private_story || '')}</p></div>
        <div class="case-block"><label>Status<select id="caseStatusSelect">${statuses.map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${status.replaceAll('_',' ')}</option>`).join('')}</select></label><button class="button small ghost" data-save-case-status="${item.id}">Update status</button></div>
      </div>
    </div>
    <div class="case-block"><span class="eyebrow">TEAM NOTES</span><div class="notes-list">${notes}</div><form id="caseNoteForm" class="note-form"><textarea name="note" rows="3" required placeholder="Private note for the MapleWish team…"></textarea><button class="button ghost" type="submit">Add note</button></form></div>
    ${wishDraft}`;
  $('caseDetail').classList.remove('hidden');
}

async function openCase(id) {
  const data = await api(`/api/cases/${id}`);
  renderCaseDetail(data);
  $('caseDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function load() {
  const [overview, campaigns, cases, contacts] = await Promise.all([
    api('/api/overview'), api('/api/campaigns'), api('/api/cases'), api('/api/contact-requests')
  ]);
  renderCurrent(overview.current);
  $('todayGross').textContent = money(overview.today.grossCents);
  $('shareStarts').textContent = overview.today.shareStarts.toLocaleString('en-CA');
  $('referredVisits').textContent = overview.today.referredVisits.toLocaleString('en-CA');
  $('openCases').textContent = overview.today.openCases.toLocaleString('en-CA');
  renderCampaigns(campaigns.campaigns);
  renderCases(cases.cases);
  renderContacts(contacts.requests);
}

$('campaignForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const status = $('formStatus');
  status.textContent = 'Creating…';
  try {
    await api('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        slug: form.get('slug'), recipientAlias: form.get('recipientAlias'),
        city: form.get('city'), province: form.get('province'), title: form.get('title'),
        summary: form.get('summary'), goalCents: Math.round(Number(form.get('goal')) * 100),
        verified: form.get('verified') === 'on', storyConsent: form.get('storyConsent') === 'on'
      })
    });
    event.currentTarget.reset();
    status.textContent = 'Draft created.';
    await load();
  } catch (error) { status.textContent = error.message; }
});

document.addEventListener('click', async event => {
  const caseButton = event.target.closest('[data-case]');
  if (caseButton) {
    caseButton.disabled = true;
    try { await openCase(caseButton.dataset.case); }
    catch (error) { alert(error.message); }
    finally { caseButton.disabled = false; }
    return;
  }

  const saveCaseStatus = event.target.closest('[data-save-case-status]');
  if (saveCaseStatus) {
    saveCaseStatus.disabled = true;
    try {
      await api(`/api/cases/${saveCaseStatus.dataset.saveCaseStatus}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: $('caseStatusSelect').value }),
      });
      await load();
      await openCase(saveCaseStatus.dataset.saveCaseStatus);
    } catch (error) { alert(error.message); }
    finally { saveCaseStatus.disabled = false; }
    return;
  }

  const contactStatus = event.target.closest('[data-contact-status]');
  if (contactStatus) {
    contactStatus.disabled = true;
    try {
      await api(`/api/contact-requests/${contactStatus.dataset.contactStatus}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: contactStatus.dataset.nextStatus }),
      });
      await load();
    } catch (error) { alert(error.message); }
    finally { contactStatus.disabled = false; }
    return;
  }

  const verify = event.target.closest('[data-verify]');
  const storyConsent = event.target.closest('[data-story-consent]');
  const activate = event.target.closest('[data-activate]');
  const pause = event.target.closest('[data-pause]');
  if (!verify && !storyConsent && !activate && !pause) return;
  const button = verify || storyConsent || activate || pause;
  button.disabled = true;
  try {
    let id;
    let action;
    if (verify) { id = verify.dataset.verify; action = 'verify'; }
    else if (storyConsent) { id = storyConsent.dataset.storyConsent; action = 'story-consent'; }
    else if (activate) { id = activate.dataset.activate; action = 'activate'; }
    else { id = pause.dataset.pause; action = 'pause'; }
    await api(`/api/campaigns/${id}/${action}`, { method: 'POST' });
    await load();
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; }
});

document.addEventListener('submit', async event => {
  if (event.target.id === 'caseNoteForm') {
    event.preventDefault();
    const id = $('caseDetail').dataset.caseId;
    const form = new FormData(event.target);
    try {
      await api(`/api/cases/${id}/notes`, { method: 'POST', body: JSON.stringify({ note: form.get('note') }) });
      await openCase(id);
    } catch (error) { alert(error.message); }
    return;
  }
  if (event.target.id === 'wishFromCaseForm') {
    event.preventDefault();
    const id = $('caseDetail').dataset.caseId;
    const form = new FormData(event.target);
    const status = $('wishCaseStatus');
    status.textContent = 'Creating…';
    try {
      await api(`/api/cases/${id}/create-wish`, {
        method: 'POST',
        body: JSON.stringify({
          slug: form.get('slug'), recipientAlias: form.get('recipientAlias'),
          title: form.get('title'), summary: form.get('summary'),
          goalCents: Math.round(Number(form.get('goal')) * 100),
        }),
      });
      status.textContent = 'Private wish draft created.';
      await load();
      await openCase(id);
    } catch (error) { status.textContent = error.message; }
  }
});

$('closeCaseDetail').addEventListener('click', () => $('caseDetail').classList.add('hidden'));
$('refresh').addEventListener('click', load);
load().catch(error => {
  console.error(error);
  $('currentEmpty').textContent = `Admin data could not be loaded: ${error.message}`;
});
