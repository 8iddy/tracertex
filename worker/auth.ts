import type { AppUser, OnboardingStatus } from "../src/editor/eventTypes";

export interface VerifiedIdentity {
  email: string;
  displayName?: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<AppUser | undefined>;
  create(identity: VerifiedIdentity, id: string, now: string): Promise<AppUser>;
  touch(user: AppUser, identity: VerifiedIdentity, now: string): Promise<AppUser>;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_seen_at: string | null;
  onboarding_status: OnboardingStatus;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  active_profile_id: string | null;
}

export function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at ?? undefined,
    onboardingStatus: row.onboarding_status,
    onboardingStep: row.onboarding_step,
    onboardingCompletedAt: row.onboarding_completed_at ?? undefined,
    activeProfileId: row.active_profile_id ?? undefined,
  };
}

export async function getVerifiedIdentity(access?: CloudflareAccessContext): Promise<VerifiedIdentity | undefined> {
  if (!access) return undefined;
  const identity = await access.getIdentity();
  const email = identity?.email?.trim().toLowerCase();
  if (!email) return undefined;
  return { email, displayName: identity?.name?.trim() || undefined };
}

export async function ensureApplicationUser(repository: UserRepository, identity: VerifiedIdentity, now: string, createId: () => string = () => crypto.randomUUID()): Promise<AppUser> {
  const existing = await repository.findByEmail(identity.email);
  if (existing) return repository.touch(existing, identity, now);
  return repository.create(identity, createId(), now);
}

export class D1UserRepository implements UserRepository {
  constructor(private readonly database: D1Database) {}

  async findByEmail(email: string): Promise<AppUser | undefined> {
    const row = await this.database.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
    return row ? mapUser(row) : undefined;
  }

  async create(identity: VerifiedIdentity, id: string, now: string): Promise<AppUser> {
    await this.database.prepare(`INSERT INTO users (id, email, display_name, created_at, last_seen_at, onboarding_status, onboarding_step)
      VALUES (?, ?, ?, ?, ?, 'NEW', 0)`).bind(id, identity.email, identity.displayName ?? null, now, now).run();
    return { id, email: identity.email, displayName: identity.displayName, createdAt: now, lastSeenAt: now, onboardingStatus: "NEW", onboardingStep: 0 };
  }

  async touch(user: AppUser, identity: VerifiedIdentity, now: string): Promise<AppUser> {
    const displayName = identity.displayName ?? user.displayName;
    await this.database.prepare("UPDATE users SET last_seen_at = ?, display_name = COALESCE(?, display_name) WHERE id = ?").bind(now, identity.displayName ?? null, user.id).run();
    return { ...user, displayName, lastSeenAt: now };
  }
}
