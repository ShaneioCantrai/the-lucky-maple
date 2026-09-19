import nodemailer from 'nodemailer';

const baseUrl = String(process.env.PUBLIC_BASE_URL || 'https://maplewish.ca').replace(/\/$/, '');
const fromAddress = process.env.MAIL_FROM || 'MapleWish <no-reply@maplewish.ca>';
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false';
const smtpUser = process.env.SMTP_USER || '';
const smtpPassword = process.env.SMTP_PASSWORD || '';

let transport = null;

export function emailDeliveryConfigured() {
  return Boolean(smtpHost && smtpPort && smtpUser && smtpPassword);
}

function getTransport() {
  if (!emailDeliveryConfigured()) {
    const error = new Error('Email delivery is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: process.env.SMTP_TLS_SERVERNAME
        ? { servername: process.env.SMTP_TLS_SERVERNAME }
        : undefined,
    });
  }
  return transport;
}

async function send(message) {
  return getTransport().sendMail({
    from: fromAddress,
    ...message,
  });
}

function shell(title, body, language = 'en-CA') {
  const footer = language === 'fr-CA'
    ? 'MapleWish · Canada · Ce message a été envoyé parce que cette adresse courriel est utilisée pour un compte de demande MapleWish.'
    : 'MapleWish · Canada · This message was sent because someone used this email address on a MapleWish applicant account.';
  return `<!doctype html><html lang="${language}"><body style="margin:0;background:#f7efd9;font-family:Arial,sans-serif;color:#39271f">
  <div style="max-width:620px;margin:0 auto;padding:36px 18px">
    <div style="font-size:26px;font-weight:700;margin-bottom:18px">🍁 MapleWish</div>
    <div style="background:#fff9e9;border:1px solid #ead9b9;border-radius:18px;padding:28px">
      <h1 style="font-size:28px;margin:0 0 14px">${title}</h1>
      ${body}
    </div>
    <p style="font-size:12px;color:#806f5e;line-height:1.5;margin:16px 4px">
      ${footer}
    </p>
  </div></body></html>`;
}

function button(url, label) {
  return `<p style="margin:22px 0"><a href="${url}" style="display:inline-block;background:#df4534;color:white;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">${label}</a></p>`;
}

export async function sendVerificationEmail(email, token, language = 'en-CA') {
  const url = `${baseUrl}/api/help/auth/verify-email?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(language)}`;
  const fr = language === 'fr-CA';
  return send({
    to: email,
    subject: fr ? 'Vérifiez votre courriel MapleWish' : 'Verify your MapleWish email',
    text: fr
      ? `Vérifiez votre courriel MapleWish en ouvrant ce lien :\n\n${url}\n\nCe lien expire dans 24 heures.`
      : `Verify your MapleWish email by opening this link:\n\n${url}\n\nThis link expires in 24 hours.`,
    html: shell(fr ? 'Vérifiez votre courriel' : 'Verify your email', fr ? `
      <p style="line-height:1.6">Veuillez vérifier cette adresse courriel avant de soumettre une demande MapleWish.</p>
      ${button(url, 'Vérifier mon courriel')}
      <p style="font-size:13px;color:#715f4e;line-height:1.5">Ce lien expire dans 24 heures. Si vous n’avez pas créé de compte MapleWish, vous pouvez ignorer ce message.</p>
    ` : `
      <p style="line-height:1.6">Please verify this email address before submitting a MapleWish application.</p>
      ${button(url, 'Verify my email')}
      <p style="font-size:13px;color:#715f4e;line-height:1.5">This link expires in 24 hours. If you did not create a MapleWish account, you can ignore this email.</p>
    `, language),
  });
}

export async function sendPasswordResetEmail(email, token, language = 'en-CA') {
  const fr = language === 'fr-CA';
  const url = `${baseUrl}${fr ? '/fr' : ''}/reset-password.html?token=${encodeURIComponent(token)}`;
  return send({
    to: email,
    subject: fr ? 'Réinitialisez votre mot de passe MapleWish' : 'Reset your MapleWish password',
    text: fr
      ? `Réinitialisez votre mot de passe MapleWish en ouvrant ce lien :\n\n${url}\n\nCe lien expire dans une heure. Si vous n’avez pas demandé cette réinitialisation, ignorez ce message.`
      : `Reset your MapleWish password by opening this link:\n\n${url}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    html: shell(fr ? 'Réinitialisez votre mot de passe' : 'Reset your password', fr ? `
      <p style="line-height:1.6">Une réinitialisation de mot de passe a été demandée pour votre compte MapleWish.</p>
      ${button(url, 'Choisir un nouveau mot de passe')}
      <p style="font-size:13px;color:#715f4e;line-height:1.5">Ce lien expire dans une heure. Si vous n’avez pas demandé cette réinitialisation, aucune action n’est requise.</p>
    ` : `
      <p style="line-height:1.6">A password reset was requested for your MapleWish applicant account.</p>
      ${button(url, 'Choose a new password')}
      <p style="font-size:13px;color:#715f4e;line-height:1.5">This link expires in 1 hour. If you did not request a reset, no action is needed.</p>
    `, language),
  });
}

export async function sendPasswordChangedEmail(email, language = 'en-CA') {
  const fr = language === 'fr-CA';
  return send({
    to: email,
    subject: fr ? 'Votre mot de passe MapleWish a été modifié' : 'Your MapleWish password was changed',
    text: fr
      ? 'Le mot de passe de votre compte MapleWish a été modifié. Si vous n’êtes pas à l’origine de ce changement, communiquez immédiatement avec MapleWish.'
      : 'The password for your MapleWish applicant account was changed. If you did not do this, contact MapleWish immediately.',
    html: shell(fr ? 'Mot de passe modifié' : 'Password changed', fr ? `
      <p style="line-height:1.6">Le mot de passe de votre compte MapleWish a été modifié.</p>
      <p style="font-size:13px;color:#715f4e;line-height:1.5">Si vous avez fait ce changement, aucune action n’est requise. Sinon, communiquez immédiatement avec l’équipe MapleWish.</p>
    ` : `
      <p style="line-height:1.6">The password for your MapleWish applicant account was changed.</p>
      <p style="font-size:13px;color:#715f4e;line-height:1.5">If you made this change, no action is needed. If you did not, contact the MapleWish team immediately.</p>
    `, language),
  });
}
