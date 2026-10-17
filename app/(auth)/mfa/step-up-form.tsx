"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { verifyStepUp } from "@/lib/auth/verify-step-up";
import { requestStepUp } from "@/lib/auth/request-step-up";
import { stepUpSchema } from "@/lib/validation/step-up";
import { REMEMBER_INTENT_KEY } from "@/lib/auth/remember-intent";
import styles from "../login/login.module.css";
import mfaStyles from "./mfa.module.css";

type Status = "idle" | "submitting";

// AGENTS.md Section 8: codes expire after 10 minutes; this 30-second
// resend cooldown is just a client-side throttle on top of that, not a
// security control by itself — the real backstop is server-side (Supabase
// [auth.email] max_frequency, plus request_step_up_code() invalidating any
// prior code on every new request).
const RESEND_COOLDOWN_SECONDS = 30;

export function StepUpForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [sending, setSending] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSentRef = useRef(false);

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setResendCooldown((seconds) => {
        if (seconds <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    // Sends the very first code for this /mfa visit. Guarded by a ref,
    // set synchronously (before the async requestStepUp() call even
    // starts), rather than relying on a URL param or any server-side
    // state — a ref check can't be raced the way two near-simultaneous
    // page loads previously could both decide "no code sent yet" and both
    // trigger a send. React 18 Strict Mode's dev-only double-invoke of
    // effects (mount -> cleanup -> mount) is exactly the case this
    // protects against too: the second invocation sees hasSentRef.current
    // already true and returns immediately.
    if (hasSentRef.current) return;
    hasSentRef.current = true;

    requestStepUp().then((result) => {
      setSending(false);
      if (result.error) setError(result.error);
      startCooldown();
    });
   
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = stepUpSchema.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the 6-digit code.");
      return;
    }

    setStatus("submitting");
    // verifyStepUp redirects to /dashboard itself on success, so a
    // resolved result here always means failure (same pattern as
    // app/(auth)/login/login-form.tsx's signIn call).
    const result = await verifyStepUp({ ...parsed.data, rememberWorkstation: sessionStorage.getItem(REMEMBER_INTENT_KEY) === "1" });
    setStatus("idle");

    if (result?.error) {
      setError(result.error);
    }
  }

  async function handleResend() {
    setError(null);
    const result = await requestStepUp();
    if (result.error) setError(result.error);
    startCooldown();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={`${styles.form} ${mfaStyles.form}`}>
      <div className={styles.field}>
        <label htmlFor="code" className={styles.label}>
          Verification code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={`${styles.input} ${mfaStyles.codeInput}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "mfa-error" : undefined}
        />
      </div>

      {sending && <p role="status" className={mfaStyles.status}>Sending your code…</p>}

      {error && (
        <p id="mfa-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className={styles.submitButton}
        aria-label="Verify"
      >
        {status === "submitting" ? "Verifying…" : "Verify code"}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resendCooldown > 0}
        className={mfaStyles.resendButton}
      >
        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
      </button>
    </form>
  );
}
