export const SUMMARY_LIMIT = 280;

const SECRET_KEY = String.raw`(?:"|')?(api[_-]?key|token|secret|password|authorization|cookie)(?:"|')?`;
const QUOTED_DOUBLE = String.raw`"(?:[^"\\]|\\.)*"`;
const QUOTED_SINGLE = String.raw`'(?:[^'\\]|\\.)*'`;

const REPLACEMENTS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: new RegExp(String.raw`TQA_HARNESS_TOKEN\s*=\s*${QUOTED_DOUBLE}`, 'gi'),
    replacement: 'TQA_HARNESS_TOKEN=[redacted]',
  },
  {
    pattern: new RegExp(String.raw`TQA_HARNESS_TOKEN\s*=\s*${QUOTED_SINGLE}`, 'gi'),
    replacement: 'TQA_HARNESS_TOKEN=[redacted]',
  },
  { pattern: /TQA_HARNESS_TOKEN\s*=\s*\S+/gi, replacement: 'TQA_HARNESS_TOKEN=[redacted]' },
  {
    pattern: new RegExp(String.raw`x-tqa-harness-token\s*[:=]\s*${QUOTED_DOUBLE}`, 'gi'),
    replacement: 'x-tqa-harness-token=[redacted]',
  },
  {
    pattern: new RegExp(String.raw`x-tqa-harness-token\s*[:=]\s*${QUOTED_SINGLE}`, 'gi'),
    replacement: 'x-tqa-harness-token=[redacted]',
  },
  { pattern: /x-tqa-harness-token\s*[:=]\s*\S+/gi, replacement: 'x-tqa-harness-token=[redacted]' },
  { pattern: /Bearer\s+\S+/gi, replacement: 'Bearer [redacted]' },
  { pattern: /Authorization\s*:\s*Basic\s+\S+/gi, replacement: 'Authorization: Basic [redacted]' },
  {
    pattern: /Authorization\s*:\s*(?!Bearer\b)(?!Basic\b)[A-Za-z][A-Za-z0-9._-]*\s+\S+/gi,
    replacement: 'Authorization: [redacted]',
  },
  {
    pattern: new RegExp(String.raw`${SECRET_KEY}\s*[:=]\s*${QUOTED_DOUBLE}`, 'gi'),
    replacement: '$1=[redacted]',
  },
  {
    pattern: new RegExp(String.raw`${SECRET_KEY}\s*[:=]\s*${QUOTED_SINGLE}`, 'gi'),
    replacement: '$1=[redacted]',
  },
  // A cookie header is a list of pairs. If the first token contains "=" or ";",
  // the rest of the line is that header, including later pairs and attributes.
  {
    pattern: /((?:set-)?cookie)\s*[:=]\s*(?!\[redacted\])(?=\S*[=;])[^\r\n]+/gi,
    replacement: '$1=[redacted]',
  },
  // An unquoted value stops at the first whitespace. `token: abc def` redacts
  // `abc` and leaves `def`.
  {
    pattern: new RegExp(
      `${SECRET_KEY}\\s*[:=]\\s*(?!\\[redacted\\])(?!Basic\\b)(?!Bearer\\b)[^\\s"'{}\\[\\],]+`,
      'gi',
    ),
    replacement: '$1=[redacted]',
  },
  { pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/g, replacement: '[redacted]' },
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
