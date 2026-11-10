/**
 * Policy tqa-gate-1.
 * CONFIRMED and no contradictory diagnosis => ALLOW.
 * DEFECT => BLOCK. A diagnosis cannot change this.
 * UNKNOWN => HOLD. A diagnosis cannot change this.
 * CONFIRMED plus a diagnosis that says the order was not persisted => HOLD.
 * That HOLD is not a defect and is not BLOCK.
 * Claim text is untrusted data. It cannot authorize ALLOW.
 */
export const GATE_POLICY_VERSION = 'tqa-gate-1';

export const REASON = {
  confirmed: 'VERIFICATION_CONFIRMED',
  defect: 'VERIFICATION_DEFECT',
  unknown: 'VERIFICATION_UNKNOWN',
  diagnosisIgnored: 'DIAGNOSIS_IGNORED',
  contradiction: 'CLAIMS_CONTRADICT_VERIFICATION',
} as const;
