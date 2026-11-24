import "server-only";
import { env } from "../env";
import { log } from "../lib/logger";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Last messages sent through the console driver (dev/test inspection). */
export const outbox: Mail[] = [];

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendMail(mail: Mail): Promise<void> {
  const e = env();
  if (e.MAIL_DRIVER === "console") {
    outbox.push(mail);
    if (outbox.length > 50) outbox.shift();
    log.info("mail_console", { to: mail.to, subject: mail.subject, text: e.NODE_ENV === "production" ? undefined : mail.text });
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: e.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    log.error("mail_send_failed", { status: res.status, to: mail.to, subject: mail.subject });
    throw new Error(`Mail provider responded ${res.status}`);
  }
}

type Locale = "fr" | "ar";

function layout(locale: Locale, heading: string, body: string, cta: { label: string; url: string }, footer: string) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#f6f6f3;font-family:Arial,sans-serif;color:#141814">
<div style="max-width:520px;margin:32px auto;background:#fff;border:1px solid #e6e6e0;border-radius:16px;padding:32px">
<p style="font-weight:700;font-size:18px;margin:0 0 24px">hanutek<span style="color:#2f6b3a">.</span></p>
<h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
<p style="font-size:14px;line-height:1.6;color:#4a4f4a;margin:0 0 24px">${esc(body)}</p>
<a href="${esc(cta.url)}" style="display:inline-block;background:#141814;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600">${esc(cta.label)}</a>
<p style="font-size:12px;line-height:1.6;color:#8a8f8a;margin:24px 0 0">${esc(footer)}</p>
</div></body></html>`;
}

const COPY = {
  verify: {
    fr: {
      subject: "Confirmez votre adresse e-mail",
      heading: "Bienvenue chez hanutek",
      body: "Confirmez votre adresse e-mail pour sécuriser votre compte. Le lien est valable 24 heures.",
      cta: "Confirmer mon e-mail",
      footer: "Si vous n’avez pas créé de compte, ignorez ce message.",
    },
    ar: {
      subject: "أكّد بريدك الإلكتروني",
      heading: "مرحبًا بك في hanutek",
      body: "أكّد بريدك الإلكتروني لتأمين حسابك. الرابط صالح لمدة 24 ساعة.",
      cta: "تأكيد البريد الإلكتروني",
      footer: "إذا لم تنشئ حسابًا، تجاهل هذه الرسالة.",
    },
  },
  reset: {
    fr: {
      subject: "Réinitialisation de votre mot de passe",
      heading: "Nouveau mot de passe",
      body: "Vous avez demandé à réinitialiser votre mot de passe. Le lien est valable 30 minutes et ne peut servir qu’une fois.",
      cta: "Choisir un nouveau mot de passe",
      footer: "Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
    },
    ar: {
      subject: "إعادة تعيين كلمة المرور",
      heading: "كلمة مرور جديدة",
      body: "طلبت إعادة تعيين كلمة المرور. الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة فقط.",
      cta: "اختيار كلمة مرور جديدة",
      footer: "إذا لم تطلب ذلك، تجاهل هذه الرسالة: كلمة مرورك لم تتغير.",
    },
  },
} as const;

export function verificationMail(to: string, locale: Locale, url: string): Mail {
  const c = COPY.verify[locale];
  return { to, subject: c.subject, text: `${c.body}\n\n${url}\n\n${c.footer}`, html: layout(locale, c.heading, c.body, { label: c.cta, url }, c.footer) };
}

export function resetMail(to: string, locale: Locale, url: string): Mail {
  const c = COPY.reset[locale];
  return { to, subject: c.subject, text: `${c.body}\n\n${url}\n\n${c.footer}`, html: layout(locale, c.heading, c.body, { label: c.cta, url }, c.footer) };
}
