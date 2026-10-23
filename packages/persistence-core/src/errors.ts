export type PortErrorKind = 'NotFound' | 'Conflict' | 'ConstraintViolation' | 'Transient';

/** Typed error model that every adapter maps its driver errors to. */
export class PortError extends Error {
  constructor(
    public readonly kind: PortErrorKind,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PortError';
  }
}
