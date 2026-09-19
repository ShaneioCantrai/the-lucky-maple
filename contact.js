const form = document.getElementById('contactForm');
const status = document.getElementById('contactStatus');
const IS_FR = document.documentElement.lang.toLowerCase().startsWith('fr');
const tr = (en, fr) => IS_FR ? fr : en;

function setStatus(message, kind = '') {
  status.textContent = message || '';
  status.dataset.kind = kind;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus(tr('Sending…','Envoi…'));
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
    if (!response.ok) throw new Error(body.error || tr('Your message could not be submitted.','Votre message n’a pas pu être envoyé.'));
    form.reset();
    setStatus(tr('Message received. Reference: ','Message reçu. Référence : ') + body.reference, 'success');
  } catch (error) {
    setStatus(error.message || tr('Your message could not be submitted.','Votre message n’a pas pu être envoyé.'), 'error');
  } finally {
    button.disabled = false;
  }
});
