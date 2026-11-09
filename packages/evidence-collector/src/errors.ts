export class EvidenceValidationError extends Error {
  constructor(message = 'evidence input failed validation') {
    super(message);
    this.name = 'EvidenceValidationError';
  }
}

export class EvidenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceConflictError';
  }
}
