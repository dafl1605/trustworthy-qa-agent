export class ToolConfigError extends Error {
  constructor(message = 'tool session configuration failed validation') {
    super(message);
    this.name = 'ToolConfigError';
  }
}

export class InvestigationConfigError extends Error {
  constructor(message = 'investigation configuration failed validation') {
    super(message);
    this.name = 'InvestigationConfigError';
  }
}

export class DiagnosisConfigError extends Error {
  constructor(message = 'diagnosis check configuration failed validation') {
    super(message);
    this.name = 'DiagnosisConfigError';
  }
}
