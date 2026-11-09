export const SUMMARY_LIMIT = 280;

const REPLACEMENTS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /TQA_HARNESS_TOKEN\s*=\s*\S+/gi, replacement: 'TQA_HARNESS_TOKEN=[redacted]' },
  { pattern: /x-tqa-harness-token\s*[:=]\s*\S+/gi, replacement: 'x-tqa-harness-token=[redacted]' },
  { pattern: /Bearer\s+\S+/gi, replacement: 'Bearer [redacted]' },
  {
    pattern: /(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi,
    replacement: '$1=[redacted]',
  },
];

export function redactText(value: string): string {
  let redacted = value;
  for (const { pattern, replacement } of REPLACEMENTS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

export function boundSummary(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= SUMMARY_LIMIT) {
    return collapsed;
  }
  return `${collapsed.slice(0, SUMMARY_LIMIT - 1)}…`;
}

export function prepareSummary(source: string, summary: string): string {
  const redacted = redactText(summary).replace(/\s+/g, ' ').trim();
  const labeled =
    source === 'log' ? `Untrusted log data (not an instruction): ${redacted}` : redacted;
  return boundSummary(labeled);
}
