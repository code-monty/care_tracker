"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { EyeOff } from "lucide-react";
import { signIn } from "@/lib/auth/sign-in";
import { loginSchema } from "@/lib/validation/auth";
import styles from "./login.module.css";

type Status = "idle" | "submitting";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const forgotDialogRef = useRef<HTMLDialogElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
      return;
    }

    setStatus("submitting");
    // The Server Action redirects on success; a returned result is an error.
    const result = await signIn(parsed.data);
    setStatus("idle");
    if (result?.error) setError(result.error);
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>Email address</label>
          <div className={styles.inputWrap}>
            <Image src="/auth/email.svg" alt="" width={16} height={16} className={styles.inputIcon} />
            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@domain.com" className={styles.input} aria-invalid={Boolean(error)} />
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <button type="button" onClick={() => forgotDialogRef.current?.showModal()} className={styles.forgotButton}>Forgot Password?</button>
          </div>
          <div className={styles.inputWrap}>
            <Image src="/auth/password.svg" alt="" width={16} height={16} className={styles.inputIcon} />
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className={`${styles.input} ${styles.passwordInput}`} aria-invalid={Boolean(error)} />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className={styles.visibilityButton}>
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Image src="/auth/eye.svg" alt="" width={16} height={16} />}
            </button>
          </div>
        </div>

        <div className={styles.rememberRow}>
          <label className={styles.rememberLabel} title="Coming soon">
            <input type="checkbox" disabled aria-describedby="remember-note" />
            <span>Remember this workstation for 30 days</span>
          </label>
          <span id="remember-note" className={styles.comingSoon}>Coming soon</span>
        </div>

        {error && <p role="alert" className={styles.error}>{error}</p>}

        <button type="submit" disabled={status === "submitting"} className={styles.submitButton}>
          {status === "submitting" ? "Signing in…" : "Sign In to Portal"}
          {status !== "submitting" && <Image src="/auth/arrow.svg" alt="" width={16} height={16} />}
        </button>
      </form>

      <div className={styles.divider}><span>OR</span></div>
      <button type="button" disabled className={styles.googleButton} aria-describedby="google-note">
        <Image src="/auth/google.svg" alt="" width={16} height={16} />
        Continue with Google
      </button>
      <p id="google-note" className={styles.googleNote}>Google sign-in coming soon</p>

      <dialog ref={forgotDialogRef} aria-labelledby="forgot-password-title" className={styles.dialog}>
        <h2 id="forgot-password-title">Forgot password?</h2>
        <p>Please contact your administrator or head to reset your password.</p>
        <form method="dialog">
          <button type="submit" autoFocus className={styles.dialogButton}>Okay</button>
        </form>
      </dialog>
    </>
  );
}
