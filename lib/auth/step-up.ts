import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signs and verifies the step-up-verified session cookie (DEV-02,
 * AGENTS.md Section 8/15). This is NOT Supabase's AAL/MFA session state —
 * it's a small HMAC-signed, HttpOnly cookie set once
 * lib/auth/verify-step-up.ts confirms a correct email code, and checked by
 * proxy.ts and requireActiveUser() on every subsequent request.
 *
 * The cookie carries no secret of its own; its only required property is
 * that it cannot be forged or tampered with, since STEP_UP_SECRET never
 * leaves the server. Payload is intentionally minimal: which user verified,
 * and when.
 *
 * No "server-only" import here, deliberately — same reasoning as
 * lib/rules/lockout.ts: these are pure functions (crypto + an env var read,
 * no DB/cookie I/O of their own), so they're unit-testable in Vitest's Node
 * environment without it. "server-only" throws unconditionally outside a
 * real Next.js server bundle, which breaks under Vitest. The actual
 * server-only boundary is enforced by this module's two callers,
 * lib/auth/request-step-up.ts and lib/auth/verify-step-up.ts, which are
 * both marked "use server" and are the only places STEP_UP_SECRET's value
 * actually gets used to produce a cookie a client could read.
 */

export const STEP_UP_COOKIE_NAME = "step_up";

// A verified sign-in remains elevated for one day, with no idle-based expiry.
// The separate remembered-workstation entry only skips a code on a later sign-in.
export const STEP_UP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StepUpPayload {
  userId: string;
  verifiedAt: number; // epoch ms
}

function getSecret(): string {
  const secret = process.env.STEP_UP_SECRET;
  if (!secret) {
    throw new Error(
      "Missing STEP_UP_SECRET. This must be set in every environment that " +
        "runs the step-up verification flow (see .env.example).",
    );
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("hex");
}

/** Builds the cookie value to set after a successful verify_step_up_code(). */
export function signStepUpCookie(userId: string): string {
  const payload: StepUpPayload = { userId, verifiedAt: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Checks a step-up cookie value against the expected user id. Returns
 * false (never throws) for: missing/malformed cookie, bad signature, wrong
 * user, or an expired verification. proxy.ts and requireActiveUser() treat
 * every false case identically — redirect to /mfa — so this never needs to
 * distinguish *why* a cookie was rejected.
 */
export function verifyStepUpCookie(
  cookieValue: string | undefined,
  userId: string,
  notBefore?: string | null,
): boolean {
  if (!cookieValue) return false;

  const [payloadB64, signature] = cookieValue.split(".");
  if (!payloadB64 || !signature) return false;

  const expectedSignature = sign(payloadB64);

  // timingSafeEqual throws on mismatched buffer lengths rather than
  // returning false, so check lengths first — a length mismatch is just as
  // much "not valid" as a content mismatch.
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (signatureBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(signatureBuf, expectedBuf)) return false;

  let payload: StepUpPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (payload.userId !== userId) return false;
  if (typeof payload.verifiedAt !== "number") return false;
  if (Date.now() - payload.verifiedAt > STEP_UP_MAX_AGE_MS) return false;
  if (notBefore && payload.verifiedAt < Date.parse(notBefore)) return false;

  return true;
}
