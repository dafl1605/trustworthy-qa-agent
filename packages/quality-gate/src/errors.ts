export class GateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GateInputError';
  }
}
