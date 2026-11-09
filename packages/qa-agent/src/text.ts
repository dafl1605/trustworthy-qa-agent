import { boundSummary, prepareSummary, redactText } from '@tqa/evidence-collector';

const FALLBACK = 'Redacted tool text.';

export function safeText(value: string): string {
  const bounded = boundSummary(redactText(value));
  return bounded.length > 0 ? bounded : FALLBACK;
}

export function safeLog(value: string): string {
  const bounded = prepareSummary('log', value);
  return bounded.length > 0 ? bounded : FALLBACK;
}

export function asUntrustedText(value: string): string {
  const normalized = redactText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
  return `[UNTRUSTED_TEXT:${normalized}]`;
}

export function safeToolName(value: string): string {
  const redacted = redactText(value).replace(/[\r\n\0]/g, '').slice(0, 80);
  return redacted.length > 0 ? redacted : 'rejected';
}
