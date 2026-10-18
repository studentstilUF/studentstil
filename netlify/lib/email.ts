/**
 * E-post via Resend (https://resend.com, gratis upp till 3 000 mejl/månad).
 * Om RESEND_API_KEY saknas (t.ex. lokalt) skrivs mejlet bara ut i loggen.
 * Ett misslyckat mejl ska aldrig stoppa en beställning, så fel loggas i stället för att kastas.
 */
import { optionalEnv, requireEnv } from './env.ts';

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail(email: Email): Promise<void> {
  const apiKey = optionalEnv('RESEND_API_KEY');
  if (apiKey === undefined) {
    console.info(
      `[e-post, ej skickat – RESEND_API_KEY saknas] Till: ${email.to} | ${email.subject}\n${email.text}`,
    );
    return;
  }
  // Svar från kunden går till Studentstils inkorg (SHOP_EMAIL, t.ex. Gmail), inte till
  // avsändaradressen – den måste ligga på den verifierade domänen och läses inte.
  const replyTo = email.replyTo ?? shopEmail();
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: requireEnv('EMAIL_FROM'),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(replyTo === undefined ? {} : { reply_to: replyTo }),
      }),
    });
    if (!res.ok) {
      console.error(`Resend svarade ${String(res.status)}: ${await res.text()}`);
    }
  } catch (error) {
    console.error('Kunde inte skicka e-post:', error);
  }
}

/** Studentstils egen e-postadress (dit ordernotiser skickas). */
export function shopEmail(): string | undefined {
  return optionalEnv('SHOP_EMAIL');
}
