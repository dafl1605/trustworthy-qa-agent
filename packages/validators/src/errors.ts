export class ValidatorInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidatorInputError';
  }
}

/**
 * The authoritative file could not be read. Callers map this to UNKNOWN.
 * It is not a confirmed missing order.
 */
export class AuthoritativeReadError extends Error {
  readonly reason: 'service_unavailable';

  constructor() {
    super('Authoritative read is unavailable');
    this.name = 'AuthoritativeReadError';
    this.reason = 'service_unavailable';
  }
}
