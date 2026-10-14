import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { STEP_UP_MAX_AGE_MS, signStepUpCookie, verifyStepUpCookie } from "./step-up";

const USER_ID = "00000000-0000-0000-0000-000000000010";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000011";
const TEST_SECRET = "test-secret-do-not-use-in-prod";

beforeAll(() => {
  process.env.STEP_UP_SECRET = TEST_SECRET;
});

/** Builds a raw cookie value by hand, for cases signStepUpCookie() can't
 * produce on its own (a specific verifiedAt, a different signing secret). */
function buildRawCookie(payload: Record<string, unknown>, secret: string = TEST_SECRET) {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}.${signature}`;
}

describe("signStepUpCookie / verifyStepUpCookie", () => {
  it("round-trips for the same user", () => {
    const cookie = signStepUpCookie(USER_ID);
    expect(verifyStepUpCookie(cookie, USER_ID)).toBe(true);
  });

  it("fails when checked against a different user id", () => {
    const cookie = signStepUpCookie(USER_ID);
    expect(verifyStepUpCookie(cookie, OTHER_USER_ID)).toBe(false);
  });

  it("fails when the cookie is undefined", () => {
    expect(verifyStepUpCookie(undefined, USER_ID)).toBe(false);
  });

  it("fails on a malformed cookie with no signature part", () => {
    expect(verifyStepUpCookie("not-a-valid-cookie", USER_ID)).toBe(false);
  });

  it("fails on an empty-string cookie", () => {
    expect(verifyStepUpCookie("", USER_ID)).toBe(false);
  });

  it("fails when the payload is swapped but the original signature is reused", () => {
    const cookie = signStepUpCookie(USER_ID);
    const [, originalSignature] = cookie.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: OTHER_USER_ID, verifiedAt: Date.now() }),
    ).toString("base64url");
    expect(verifyStepUpCookie(`${tamperedPayload}.${originalSignature}`, OTHER_USER_ID)).toBe(
      false,
    );
  });

  it("fails when signed with the wrong secret", () => {
    const cookie = buildRawCookie({ userId: USER_ID, verifiedAt: Date.now() }, "wrong-secret");
    expect(verifyStepUpCookie(cookie, USER_ID)).toBe(false);
  });

  it("fails once the verification is older than STEP_UP_MAX_AGE_MS", () => {
    const expired = buildRawCookie({
      userId: USER_ID,
      verifiedAt: Date.now() - STEP_UP_MAX_AGE_MS - 1_000,
    });
    expect(verifyStepUpCookie(expired, USER_ID)).toBe(false);
  });

  it("succeeds just under the STEP_UP_MAX_AGE_MS boundary", () => {
    const stillFresh = buildRawCookie({
      userId: USER_ID,
      verifiedAt: Date.now() - STEP_UP_MAX_AGE_MS + 1_000,
    });
    expect(verifyStepUpCookie(stillFresh, USER_ID)).toBe(true);
  });

  it("fails when verifiedAt is not a number", () => {
    const malformed = buildRawCookie({ userId: USER_ID, verifiedAt: "not-a-number" });
    expect(verifyStepUpCookie(malformed, USER_ID)).toBe(false);
  });

  it("fails when the payload isn't valid JSON at all", () => {
    const garbage = `${Buffer.from("not json").toString("base64url")}.deadbeef`;
    expect(verifyStepUpCookie(garbage, USER_ID)).toBe(false);
  });
});
