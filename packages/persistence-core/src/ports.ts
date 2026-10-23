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
