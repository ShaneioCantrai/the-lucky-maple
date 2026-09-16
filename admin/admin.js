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
    const action = c.status === 'active'
      ? `<button class="button small ghost" data-pause="${c.id}">Pause</button>`
      : canActivate ? `<button class="button small green" data-activate="${c.id}">Activate</button>` : '';
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
    <td><strong>${escapeHtml(item.applicant_name)}</strong></td>
    <td>${escapeHtml(item.province)}</td><td>${escapeHtml(item.request_category)}</td>
    <td>${money(item.requested_cents)}</td><td><span class="status">${escapeHtml(item.status)}</span></td>
  </tr>`).join('') : '<tr><td colspan="5">No help requests yet.</td></tr>';
}

async function load() {
  const [overview, campaigns, cases] = await Promise.all([
    api('/api/overview'), api('/api/campaigns'), api('/api/cases')
  ]);
  renderCurrent(overview.current);
  $('todayGross').textContent = money(overview.today.grossCents);
  $('shareStarts').textContent = overview.today.shareStarts.toLocaleString('en-CA');
  $('referredVisits').textContent = overview.today.referredVisits.toLocaleString('en-CA');
  $('openCases').textContent = overview.today.openCases.toLocaleString('en-CA');
  renderCampaigns(campaigns.campaigns);
  renderCases(cases.cases);
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
  const activate = event.target.closest('[data-activate]');
  const pause = event.target.closest('[data-pause]');
  if (!activate && !pause) return;
  const button = activate || pause;
  button.disabled = true;
  try {
    const id = activate ? activate.dataset.activate : pause.dataset.pause;
    await api(`/api/campaigns/${id}/${activate ? 'activate' : 'pause'}`, { method: 'POST' });
    await load();
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; }
});

$('refresh').addEventListener('click', load);
load().catch(error => {
  console.error(error);
  $('currentEmpty').textContent = `Admin data could not be loaded: ${error.message}`;
});
