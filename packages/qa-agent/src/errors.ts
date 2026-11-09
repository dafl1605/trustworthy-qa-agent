export class ToolConfigError extends Error {
  constructor(message = 'tool session configuration failed validation') {
    super(message);
    this.name = 'ToolConfigError';
  }
}
