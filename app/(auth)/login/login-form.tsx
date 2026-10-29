"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { EyeOff } from "lucide-react";
import { signIn } from "@/lib/auth/sign-in";
import { loginSchema } from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/browser";
import { REMEMBER_INTENT_KEY } from "@/lib/auth/remember-intent";
import { LoadingIndicator } from "@/components/loading-indicator";
import styles from "./login.module.css";

type Status = "idle" | "submitting";

export function LoginForm({ googleError }: { googleError: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(googleError ? "Unable to sign in with Google. Contact your administrator if you need access." : null);
  const [status, setStatus] = useState<Status>("idle");
  const [googlePending, setGooglePending] = useState(false);
  const [rememberWorkstation, setRememberWorkstation] = useState(false);
  const forgotDialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const busy = status === "submitting" || googlePending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    sessionStorage.setItem(REMEMBER_INTENT_KEY, rememberWorkstation ? "1" : "0");
    // The Server Action redirects on success; a returned result is an error.
    const result = await signIn(parsed.data);
    setStatus("idle");
    submittingRef.current = false;
    if (result?.error) setError(result.error);
  }

  async function handleGoogleSignIn() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setGooglePending(true);
    sessionStorage.setItem(REMEMBER_INTENT_KEY, rememberWorkstation ? "1" : "0");
    try {
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (!oauthError) return;
    } catch {
      // Restore the form if OAuth could not start.
    }
    submittingRef.current = false;
    setGooglePending(false);
    setError("Unable to sign in with Google. Please try again.");
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className={styles.form} aria-busy={busy}>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>Email address</label>
          <div className={styles.inputWrap}>
            <Image src="/auth/email.svg" alt="" width={16} height={16} className={styles.inputIcon} />
            <input id="email" name="email" type="email" autoComplete="email" required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@domain.com" className={styles.input} aria-invalid={Boolean(error)} />
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <button type="button" disabled={busy} onClick={() => forgotDialogRef.current?.showModal()} className={styles.forgotButton}>Forgot Password?</button>
          </div>
          <div className={styles.inputWrap}>
            <Image src="/auth/password.svg" alt="" width={16} height={16} className={styles.inputIcon} />
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className={`${styles.input} ${styles.passwordInput}`} aria-invalid={Boolean(error)} />
            <button type="button" disabled={busy} onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className={styles.visibilityButton}>
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Image src="/auth/eye.svg" alt="" width={16} height={16} />}
            </button>
          </div>
        </div>

        <div className={styles.rememberRow}>
          <label className={styles.rememberLabel}>
            <input type="checkbox" disabled={busy} checked={rememberWorkstation} onChange={(event) => setRememberWorkstation(event.target.checked)} />
            <span>Remember this workstation for 1 day</span>
          </label>
        </div>

        {error && <p role="alert" className={styles.error}>{error}</p>}

        <button type="submit" disabled={busy} className={styles.submitButton}>
          {status === "submitting" ? <><span className={styles.buttonSpinner} aria-hidden="true" />Signing in…</> : "Sign In to Portal"}
          {status !== "submitting" && <Image src="/auth/arrow.svg" alt="" width={16} height={16} />}
        </button>
      </form>

      <div className={styles.divider}><span>OR</span></div>
      <button type="button" onClick={handleGoogleSignIn} disabled={busy} className={styles.googleButton} aria-describedby="google-note">
        {googlePending ? <span className={styles.buttonSpinner} aria-hidden="true" /> : <Image src="/auth/google.svg" alt="" width={16} height={16} />}
        {googlePending ? "Connecting to Google…" : "Continue with Google"}
      </button>
      <p id="google-note" className={styles.googleNote}>Only administrator-created, active accounts can sign in with Google. After email-code verification, this browser remembers your Google account for 1 day.</p>

      <dialog ref={forgotDialogRef} aria-labelledby="forgot-password-title" className={styles.dialog}>
        <h2 id="forgot-password-title">Forgot password?</h2>
        <p>Please contact your administrator or head to reset your password.</p>
        <form method="dialog">
          <button type="submit" autoFocus className={styles.dialogButton}>Okay</button>
        </form>
      </dialog>
      {busy && <div className={styles.loadingOverlay}><LoadingIndicator message={googlePending ? "Connecting to Google…" : "Signing in securely…"} /></div>}
    </>
  );
}
