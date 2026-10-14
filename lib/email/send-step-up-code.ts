import "server-only";
import nodemailer from "nodemailer";

/**
 * DEV-02 (AGENTS.md Section 8/15): sends the 6-digit step-up code by
 * email via Nodemailer over SMTP.
 *
 * Local dev: talks to Supabase's local SMTP test inbox (Inbucket) with no
 * credentials needed, as long as supabase/config.toml's [local_smtp]
 * section has `smtp_port = 54325` UNCOMMENTED — it ships commented out by
 * default, so this must be enabled once per machine (then `supabase
 * stop` + `supabase start` to pick up the config change). View sent mail
 * at http://127.0.0.1:54324.
 *
 * Production: requires SMTP_HOST, SMTP_USER and SMTP_PASSWORD to point at
 * a real provider (see README.md env var table) — this throws rather than
 * silently failing to send if they're missing outside local dev.
 */

function getTransport() {
  // Deliberately `||`, not `??`: a blank line in .env.local (SMTP_HOST=)
  // sets these to an empty string, not undefined, so `??` would never
  // fall back to the local defaults below. An empty-string host/port is
  // never a value we'd actually want to use anyway.
  const host = process.env.SMTP_HOST || "127.0.0.1";
  const port = Number(process.env.SMTP_PORT || 54325);
  const user = process.env.SMTP_USER || undefined;
  const password = process.env.SMTP_PASSWORD || undefined;

  if (process.env.NODE_ENV === "production" && (!process.env.SMTP_HOST || !user || !password)) {
    throw new Error(
      "Missing SMTP_HOST / SMTP_USER / SMTP_PASSWORD. Step-up codes cannot " +
        "be emailed in production without a real SMTP provider configured.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && password ? { user, pass: password } : undefined,
  });
}

export async function sendStepUpCodeEmail(to: string, code: string): Promise<void> {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || "CareTracker <no-reply@caretracker.local>";

  await transport.sendMail({
    from,
    to,
    subject: "Your CareTracker verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html:
      `<p>Your verification code is ` +
      `<strong style="font-size:1.25em;letter-spacing:0.1em;">${code}</strong>.</p>` +
      `<p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
  });
}