import { describe, expect, it } from "vitest";
import type { AppUser } from "../src/editor/eventTypes";
import { ensureApplicationUser, getVerifiedIdentity, type UserRepository, type VerifiedIdentity } from "./auth";

class MemoryUsers implements UserRepository {
  users = new Map<string, AppUser>();
  creates = 0;

  async findByEmail(email: string) { return this.users.get(email) }
  async create(identity: VerifiedIdentity, id: string, now: string) {
    this.creates += 1;
    const user: AppUser = { id, email: identity.email, displayName: identity.displayName, createdAt: now, lastSeenAt: now, onboardingStatus: "NEW", onboardingStep: 0 };
    this.users.set(identity.email, user);
    return user;
  }
  async touch(user: AppUser, identity: VerifiedIdentity, now: string) {
    const next = { ...user, displayName: identity.displayName ?? user.displayName, lastSeenAt: now };
    this.users.set(user.email, next);
    return next;
  }
}

describe("application identity", () => {
  it("creates a new internal user for a verified Access identity", async () => {
    const repository = new MemoryUsers();
    const user = await ensureApplicationUser(repository, { email: "writer@example.com", displayName: "Writer" }, "2026-09-19T00:00:00.000Z", () => "user-1");
    expect(user).toMatchObject({ id: "user-1", email: "writer@example.com", onboardingStatus: "NEW", onboardingStep: 0 });
    expect(repository.creates).toBe(1);
  });

  it("returns and touches an existing user instead of creating a duplicate", async () => {
    const repository = new MemoryUsers();
    await ensureApplicationUser(repository, { email: "writer@example.com" }, "2026-09-19T00:00:00.000Z", () => "user-1");
    const existing = await ensureApplicationUser(repository, { email: "writer@example.com" }, "2026-09-20T00:00:00.000Z", () => "user-2");
    expect(existing.id).toBe("user-1");
    expect(existing.lastSeenAt).toBe("2026-09-20T00:00:00.000Z");
    expect(repository.creates).toBe(1);
  });

  it("does not enable a header or production fallback when Access did not authenticate", async () => {
    expect(await getVerifiedIdentity(undefined)).toBeUndefined();
  });

  it("rejects an unverified Access assertion", async () => {
    const request = new Request("https://example.com/api/me", { headers: { "Cf-Access-Jwt-Assertion": "not-a-jwt" } });
    await expect(getVerifiedIdentity(undefined, request, { audience: "aud", teamDomain: "https://team.cloudflareaccess.com" })).resolves.toBeUndefined();
  });

  it("normalizes the verified Access email", async () => {
    const access = { aud: "local", getIdentity: async () => ({ email: " Writer@Example.COM ", name: "Writer" }) } satisfies CloudflareAccessContext;
    await expect(getVerifiedIdentity(access)).resolves.toEqual({ email: "writer@example.com", displayName: "Writer" });
  });
});
