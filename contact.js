const form = document.getElementById('contactForm');
const status = document.getElementById('contactStatus');

function setStatus(message, kind = '') {
  status.textContent = message || '';
  status.dataset.kind = kind;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus('Sending…');
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: data.get('category'),
        name: String(data.get('name') || '').trim(),
        email: String(data.get('email') || '').trim(),
        message: String(data.get('message') || '').trim(),
        privacyAcknowledged: data.get('privacyAcknowledged') === 'on',
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Your message could not be submitted.');
    form.reset();
    setStatus('Message received. Reference: ' + body.reference, 'success');
  } catch (error) {
    setStatus(error.message || 'Your message could not be submitted.', 'error');
  } finally {
    button.disabled = false;
  }
});
