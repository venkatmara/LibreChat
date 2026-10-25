export type PortErrorKind = 'NotFound' | 'Conflict' | 'ConstraintViolation' | 'Transient';

export interface PortErrorOptions {
  cause?: unknown;
  /** Offending field for Conflict / ConstraintViolation (e.g. `email`, `username`). */
  field?: string;
}

/** Typed error model that every adapter maps its driver errors to. */
export class PortError extends Error {
  public override readonly cause?: unknown;
  public readonly field?: string;

  constructor(
    public readonly kind: PortErrorKind,
    message: string,
    options: PortErrorOptions = {},
  ) {
    super(message);
    this.name = 'PortError';
    this.cause = options.cause;
    this.field = options.field;
  }
}
