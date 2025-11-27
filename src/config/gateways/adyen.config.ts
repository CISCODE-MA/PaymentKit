import type { ConfigValidationIssue } from '../paymentKit.config';

export interface AdyenInternalConfig {
  apiKey: string;
  merchantAccount: string;
}

/**
 * Simple Env source type: compatible with process.env but easy to mock in tests.
 */
export type EnvSource = Record<string, string | undefined>;

export interface AdyenConfigBuildResult {
  config: AdyenInternalConfig | null;
  issues: ConfigValidationIssue[];
}

/**
 * Build Adyen internal config from environment variables.
 *
 * - If `enabled` is false: returns { config: null, issues: [] }
 * - If `enabled` is true:
 *   - requires PAYMENTKIT_ADYEN_API_KEY
 *   - requires PAYMENTKIT_ADYEN_MERCHANT_ACCOUNT
 */
export function buildAdyenInternalConfig(
  enabled: boolean,
  env: EnvSource,
  prefix = 'PAYMENTKIT_ADYEN_',
): AdyenConfigBuildResult {
  if (!enabled) {
    return { config: null, issues: [] };
  }

  const issues: ConfigValidationIssue[] = [];

  const rawApiKey = env[`${prefix}API_KEY`];
  const rawMerchant = env[`${prefix}MERCHANT_ACCOUNT`];

  // 1) apiKey required
  if (!rawApiKey || rawApiKey.trim().length === 0) {
    issues.push({
      path: 'gateways.adyen',
      message: `${prefix}API_KEY is required when Adyen gateway is enabled`,
      code: 'ADYEN_API_KEY_REQUIRED',
    });

    return {
      config: null,
      issues,
    };
  }

  // 2) merchantAccount required
  if (!rawMerchant || rawMerchant.trim().length === 0) {
    issues.push({
      path: 'gateways.adyen',
      message: `${prefix}MERCHANT_ACCOUNT is required when Adyen gateway is enabled`,
      code: 'ADYEN_MERCHANT_ACCOUNT_REQUIRED',
    });

    return {
      config: null,
      issues,
    };
  }

  // 3) Safe to trim now
  const apiKey = rawApiKey.trim();
  const merchantAccount = rawMerchant.trim();

  const config: AdyenInternalConfig = {
    apiKey,
    merchantAccount,
  };

  return {
    config,
    issues,
  };
}
