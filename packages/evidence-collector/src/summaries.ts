import type { CheckoutConfirmation, OrderLookupResult } from '@tqa/shared';
import type { CheckoutEvidenceArtifact } from './schema.js';

export function uiConfirmationSummary(message: string, scenarioLabel?: string): string {
  const scenario = scenarioLabel ? ` Scenario label in the file is ${scenarioLabel}.` : '';
  return `UI confirmation said "${message}".${scenario} This screen is not proof the order was saved.`;
}

export function checkoutResponseSummary(confirmation: CheckoutConfirmation): string {
  return `Checkout response said "${confirmation.message}" with totalCents ${confirmation.totalCents} for order ${confirmation.orderId}. This response is not an authoritative persistence read and not a gate decision.`;
}

export function orderLookupSummary(lookup: OrderLookupResult): string {
  if (lookup.code === 'FOUND') {
    return `Authoritative read returned 200 FOUND for order ${lookup.order.orderId}. Server totalCents is ${lookup.order.totalCents}. This is not a gate decision.`;
  }
  if (lookup.code === 'ABSENT') {
    return `Authoritative read returned 404 ABSENT for order ${lookup.orderId}. Missing order. Distinct from an unavailable authority. This is not a gate decision.`;
  }
  return `Authoritative read returned 503 UNAVAILABLE (${lookup.reason}) for order ${lookup.orderId}. Unknown result. Distinct from a missing order. This is not a gate decision.`;
}

export function rowCountSummary(orderId: string, rowCount: 0 | 1): string {
  return `Supplied orders row count for ${orderId} is ${rowCount}. This count is the caller's observation and not a gate decision.`;
}

export function artifactReferenceSummary(summary?: string): string {
  if (!summary) {
    return 'Artifact reference only. The file body was not copied into this record.';
  }
  return summary;
}

interface CleanLookup {
  code: 'FOUND' | 'ABSENT' | 'UNAVAILABLE';
  totalCents: number | null;
}

function cleanLookup(artifact: CheckoutEvidenceArtifact): CleanLookup | null {
  const oracle = artifact.oracle;
  if (oracle.code === 'FOUND' && oracle.httpStatus === 200 && oracle.totalCents !== null) {
    return { code: 'FOUND', totalCents: oracle.totalCents };
  }
  if (oracle.code === 'ABSENT' && oracle.httpStatus === 404 && oracle.totalCents === null) {
    return { code: 'ABSENT', totalCents: null };
  }
  if (oracle.code === 'UNAVAILABLE' && oracle.httpStatus === 503 && oracle.totalCents === null) {
    return { code: 'UNAVAILABLE', totalCents: null };
  }
  return null;
}

function labelAgrees(artifact: CheckoutEvidenceArtifact, lookup: CleanLookup): boolean {
  const { verificationStatus, assertion } = artifact.oracle;
  if (assertion === 'NOT_CONSULTED') {
    return false;
  }
  if (lookup.code === 'FOUND') {
    return verificationStatus === 'CONFIRMED';
  }
  if (lookup.code === 'ABSENT') {
    return verificationStatus === 'DEFECT';
  }
  return verificationStatus === 'UNKNOWN';
}

function fileLabel(artifact: CheckoutEvidenceArtifact): string {
  return `File label verificationStatus=${artifact.oracle.verificationStatus}; assertion=${artifact.oracle.assertion}.`;
}

interface CheckoutDraft {
  evidenceId: string;
  runId: string;
  orderId: string;
  source: 'ui' | 'api';
  observedAt: string;
  kind: string;
  summary: string;
}

export function draftsFromCheckoutEvidence(artifact: CheckoutEvidenceArtifact): CheckoutDraft[] {
  const lookupPresent = artifact.oracle.httpStatus !== null || artifact.oracle.code !== null;
  const uiSummary = [
    `UI result ${artifact.ui.result}.`,
    uiConfirmationSummary(artifact.ui.message, artifact.scenario),
    lookupPresent || artifact.oracle.consulted ? '' : 'Order lookup was not consulted.',
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  const drafts: CheckoutDraft[] = [
    {
      evidenceId: `${artifact.evidenceId}#ui`,
      runId: artifact.runId,
      orderId: artifact.orderId,
      source: 'ui' as const,
      observedAt: artifact.observedAt,
      kind: 'checkout-ui-confirmation',
      summary: uiSummary,
    },
  ];

  if (!artifact.oracle.consulted && !lookupPresent) {
    return drafts;
  }

  const clean = cleanLookup(artifact);
  const consistent = clean !== null && artifact.oracle.consulted && labelAgrees(artifact, clean);
  if (!consistent || !clean) {
    drafts.push({
      evidenceId: `${artifact.evidenceId}#api`,
      runId: artifact.runId,
      orderId: artifact.orderId,
      source: 'api',
      observedAt: artifact.observedAt,
      kind: 'order-lookup-inconsistent',
      summary: `Artifact fields disagree for order ${artifact.orderId}. consulted=${artifact.oracle.consulted}; httpStatus=${String(artifact.oracle.httpStatus)}; code=${String(artifact.oracle.code)}. ${fileLabel(artifact)} This record is not a confirmed missing order and not an unavailable-versus-missing decision.`,
    });
    return drafts;
  }

  const kind =
    clean.code === 'FOUND'
      ? 'order-lookup-found'
      : clean.code === 'ABSENT'
        ? 'order-lookup-absent'
        : 'order-lookup-unavailable';
  const fact =
    clean.code === 'FOUND'
      ? `Artifact recorded 200 FOUND for order ${artifact.orderId}. totalCents is ${clean.totalCents}.`
      : clean.code === 'ABSENT'
        ? `Artifact recorded 404 ABSENT for order ${artifact.orderId}. Missing order. Distinct from an unavailable authority.`
        : `Artifact recorded 503 UNAVAILABLE for order ${artifact.orderId}. Unknown result. Distinct from a missing order.`;

  drafts.push({
    evidenceId: `${artifact.evidenceId}#api`,
    runId: artifact.runId,
    orderId: artifact.orderId,
    source: 'api',
    observedAt: artifact.observedAt,
    kind,
    summary: `${fact} ${fileLabel(artifact)} This is not a gate decision.`,
  });
  return drafts;
}
