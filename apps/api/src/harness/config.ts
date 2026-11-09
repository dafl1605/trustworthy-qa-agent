export interface HarnessConfig {
  token: string;
}

/**
 * The harness stays unmounted unless both controls are present.
 * `TQA_HARNESS=1` with an empty token is still disabled.
 * The token is returned to the caller and must not be logged.
 */
export function readHarnessConfig(env: NodeJS.ProcessEnv): HarnessConfig | undefined {
  if (env.TQA_HARNESS !== '1') {
    return undefined;
  }
  const token = env.TQA_HARNESS_TOKEN;
  if (typeof token !== 'string' || token.length === 0) {
    return undefined;
  }
  return { token };
}
