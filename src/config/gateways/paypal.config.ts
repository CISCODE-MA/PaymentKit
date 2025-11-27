import type { ConfigValidationIssue } from '@config/paymentKit.config';

export interface PaypalInternalConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Simple Env source type: compatible with process.env but easy to mock in tests.
 */
export type EnvSource = Record<string, string | undefined>;

export interface PaypalConfigBuildResult {
  config: PaypalInternalConfig | null;
  issues: ConfigValidationIssue[];
}

/**
 * Build PayPal internal config from environment variables.
 *
 * - If `enabled` is false: returns { config: null, issues: [] }
 * - If `enabled` is true:
 *   - requires PAYMENTKIT_PAYPAL_CLIENT_ID
 *   - requires PAYMENTKIT_PAYPAL_CLIENT_SECRET
 */
export function buildPaypalInternalConfig(
  enabled: boolean,
  env: EnvSource,
  prefix = 'PAYMENTKIT_PAYPAL_',
): PaypalConfigBuildResult {
  if (!enabled) {
    return { config: null, issues: [] };
  }

  const issues: ConfigValidationIssue[] = [];

  const rawClientId = env[`${prefix}CLIENT_ID`];
  const rawClientSecret = env[`${prefix}CLIENT_SECRET`];

  // Validate rawClientId
  if (!rawClientId || rawClientId.trim().length === 0) {
    issues.push({
      path: 'gateways.paypal',
      message: `${prefix}CLIENT_ID is required when PayPal gateway is enabled`,
      code: 'PAYPAL_CLIENT_ID_REQUIRED',
    });

    return {
      config: null,
      issues,
    };
  }

  // Validate rawClientSecret
  if (!rawClientSecret || rawClientSecret.trim().length === 0) {
    issues.push({
      path: 'gateways.paypal',
      message: `${prefix}CLIENT_SECRET is required when PayPal gateway is enabled`,
      code: 'PAYPAL_CLIENT_SECRET_REQUIRED',
    });

    return {
      config: null,
      issues,
    };
  }

  // NOW TS knows both values MUST be strings
  const clientId = rawClientId.trim();
  const clientSecret = rawClientSecret.trim();

  const config: PaypalInternalConfig = {
    clientId,
    clientSecret,
  };

  return {
    config,
    issues,
  };
}
