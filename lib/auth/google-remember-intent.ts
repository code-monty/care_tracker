import { createHmac, timingSafeEqual } from "node:crypto";

export const GOOGLE_REMEMBER_INTENT_COOKIE_NAME = "google_remember_intent";
export const GOOGLE_REMEMBER_INTENT_MAX_AGE_MS = 10 * 60 * 1000;

function signature(payload: string): string {
  const secret = process.env.STEP_UP_SECRET;
  if (!secret) throw new Error("Missing STEP_UP_SECRET.");
  return createHmac("sha256", secret).update(`google-remember-intent:${payload}`).digest("hex");
}

export function signGoogleRememberIntent(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Date.now() })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyGoogleRememberIntent(value: string | undefined, userId: string): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !/^[a-f0-9]{64}$/.test(parts[1])) return false;
  if (!timingSafeEqual(Buffer.from(parts[1], "hex"), Buffer.from(signature(parts[0]), "hex"))) return false;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || !("userId" in payload) || !("issuedAt" in payload)) return false;
    const { userId: signedUserId, issuedAt } = payload;
    return signedUserId === userId && typeof issuedAt === "number" && Number.isFinite(issuedAt) &&
      issuedAt <= Date.now() && Date.now() - issuedAt < GOOGLE_REMEMBER_INTENT_MAX_AGE_MS;
  } catch {
    return false;
  }
}
