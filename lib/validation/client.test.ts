import { afterEach, describe, expect, it, vi } from "vitest";
import { ageFromBirthdate, birthdateAllowsAgeOne, clientFieldSchemas, editedBirthdateIsAllowed, latestBirthdateForAgeOne } from "./client";

afterEach(() => vi.useRealTimers());

describe("client minimum age", () => {
  it("changes from zero to one at the first Manila birthday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T15:30:00Z")); // November 8, 11:30 PM Manila
    expect(clientFieldSchemas.petitionerBirthdate.safeParse("2025-11-09").success).toBe(false);
    expect(clientFieldSchemas.respondentBirthdate.safeParse("2025-11-09").success).toBe(false);
    vi.setSystemTime(new Date("2026-11-08T16:30:00Z")); // November 9, 12:30 AM Manila
    expect(clientFieldSchemas.petitionerBirthdate.safeParse("2025-11-09").success).toBe(true);
    expect(clientFieldSchemas.respondentBirthdate.safeParse("2025-11-10").success).toBe(false);
    expect(ageFromBirthdate("2025-11-10")).toBe(0);
    expect(latestBirthdateForAgeOne()).toBe("2025-11-09");
  });

  it("keeps an unchanged legacy birthdate but rejects a changed age-zero date", () => {
    expect(editedBirthdateIsAllowed("2025-11-10", "2025-11-10", "2026-11-09")).toBe(true);
    expect(editedBirthdateIsAllowed("2025-11-10", "1990-01-01", "2026-11-09")).toBe(false);
    expect(editedBirthdateIsAllowed("2025-11-09", "1990-01-01", "2026-11-09")).toBe(true);
    expect(birthdateAllowsAgeOne("2025-11-08", "2026-11-09")).toBe(true);
  });

  it("uses the same birthday boundary around leap days", () => {
    expect(latestBirthdateForAgeOne("2028-02-29")).toBe("2027-02-28");
    expect(birthdateAllowsAgeOne("2027-03-01", "2028-02-29")).toBe(false);
    expect(birthdateAllowsAgeOne("2027-02-28", "2028-02-29")).toBe(true);
    expect(birthdateAllowsAgeOne("2024-02-29", "2025-02-28")).toBe(false);
    expect(birthdateAllowsAgeOne("2024-02-29", "2025-03-01")).toBe(true);
  });
});
