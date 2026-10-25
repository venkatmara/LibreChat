/** Opaque string identifier; callers never depend on its format (ADR-004). */
export type Id = string;

export interface HealthStatus {
  adapter: string;
  ok: boolean;
}

/** Root port every adapter implements. Entity repositories are added per slice (E1). */
export interface Persistence {
  readonly name: string;
  health(): Promise<HealthStatus>;
  close(): Promise<void>;
}

export interface UserIdentity {
  provider: string;
  issuer: string | null;
  providerUserId: string;
}

/** Domain user. No secrets: the password hash is only on {@link UserAuthRecord}. */
export interface UserRecord {
  id: Id;
  email: string;
  username: string | null;
  name: string | null;
  provider: string;
  role: string;
  emailVerified: boolean;
  tenantId: string | null;
  avatar: string | null;
  expiresAt: Date | null;
  identities: UserIdentity[];
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAuthRecord extends UserRecord {
  passwordHash: string | null;
}

export interface NewUser {
  email: string;
  username?: string | null;
  name?: string | null;
  provider?: string;
  role?: string;
  emailVerified?: boolean;
  tenantId?: string | null;
  avatar?: string | null;
  expiresAt?: Date | null;
  identities?: UserIdentity[];
  preferences?: Record<string, unknown>;
  passwordHash?: string | null;
}

export type UserPatch = Partial<NewUser>;

/**
 * User persistence port. Email is trimmed and lower-cased on write and lookup.
 * Lookups return null when absent (including malformed ids); errors are {@link PortError}.
 */
export interface UserRepo {
  findById(id: Id): Promise<UserRecord | null>;
  findByEmail(email: string, tenantId?: string | null): Promise<UserRecord | null>;
  /** The only method that returns the password hash. */
  getAuthByEmail(email: string, tenantId?: string | null): Promise<UserAuthRecord | null>;
  /** Conflict{field:'email'|'username'} on duplicates; ConstraintViolation when email is missing. */
  create(input: NewUser): Promise<UserRecord>;
  /** NotFound when absent; Conflict as for create. */
  update(id: Id, patch: UserPatch): Promise<UserRecord>;
  count(): Promise<number>;
}
