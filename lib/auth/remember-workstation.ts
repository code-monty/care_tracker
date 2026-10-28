import { createHmac, timingSafeEqual } from "node:crypto";

export const REMEMBER_WORKSTATION_COOKIE_NAME = "remember_workstation";
export const REMEMBER_WORKSTATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function signature(payload: string) {
  const secret = process.env.STEP_UP_SECRET;
  if (!secret) throw new Error("Missing STEP_UP_SECRET.");
  // Domain separation prevents a step-up cookie from being used as a trust cookie.
  return createHmac("sha256", secret).update(`remember-workstation:${payload}`).digest("hex");
}

type RememberedAccount = { userId: string; rememberedAt: number };

function readAccounts(value: string | undefined): RememberedAccount[] {
  if (!value) return [];
  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !/^[a-f0-9]{64}$/.test(parts[1])) return [];
  const actual = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(signature(parts[0]), "hex");
  if (!timingSafeEqual(actual, expected)) return [];

  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return [];
    // Accept the original single-account cookie so existing remembered users
    // do not lose their remaining trust period when this change ships.
    const raw = "accounts" in payload ? payload.accounts : [payload];
    if (!Array.isArray(raw) || raw.length > 10) return [];
    return raw.filter((account): account is RememberedAccount =>
      account !== null && typeof account === "object" &&
      typeof account.userId === "string" && account.userId.length > 0 &&
      typeof account.rememberedAt === "number" && Number.isFinite(account.rememberedAt) &&
      account.rememberedAt <= Date.now() &&
      Date.now() - account.rememberedAt < REMEMBER_WORKSTATION_MAX_AGE_MS,
    );
  } catch {
    return [];
  }
}

export function signRememberWorkstationCookie(userId: string, existingValue?: string): string {
  const accounts = readAccounts(existingValue).filter((account) => account.userId !== userId);
  accounts.push({ userId, rememberedAt: Date.now() });
  const payload = Buffer.from(JSON.stringify({ accounts: accounts.slice(-10) })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyRememberWorkstationCookie(value: string | undefined, userId: string, notBefore?: string | null): boolean {
  return readAccounts(value).some((account) => account.userId === userId && (!notBefore || account.rememberedAt >= Date.parse(notBefore)));
}
