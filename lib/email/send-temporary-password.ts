import "server-only";
import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST || "127.0.0.1";
  const port = Number(process.env.SMTP_PORT || 54325);
  const user = process.env.SMTP_USER || undefined;
  const password = process.env.SMTP_PASSWORD || undefined;

  if (process.env.NODE_ENV === "production" && (!process.env.SMTP_HOST || !user || !password)) {
    throw new Error(
      "Missing SMTP_HOST / SMTP_USER / SMTP_PASSWORD. Temporary passwords cannot " +
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

export async function sendTemporaryPasswordEmail(
  to: string,
  password: string,
  reason: "created" | "reset",
): Promise<void> {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || "CareTracker <no-reply@caretracker.local>";
  const subject =
    reason === "created"
      ? "Your CareTracker temporary password"
      : "Your CareTracker password was reset";
  const intro =
    reason === "created"
      ? "An administrator created your CareTracker account."
      : "An administrator reset your CareTracker password.";

  await transport.sendMail({
    from,
    to,
    subject,
    text: `${intro} Your temporary password is ${password}. Sign in, verify your email, and change it to a password of at least 10 characters before using CareTracker.`,
    html:
      `<p>${intro}</p>` +
      `<p>Your temporary password is <strong style="font-family:monospace;font-size:1.15em;">${password}</strong>.</p>` +
      `<p>Sign in, verify your email, and change it to a password of at least 10 characters before using CareTracker.</p>`,
  });
}
