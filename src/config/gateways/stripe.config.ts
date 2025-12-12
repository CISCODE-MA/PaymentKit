import type { ConfigValidationIssue } from '../paymentKit.config';

export interface StripeInternalConfig {
  apiKey: string;
  webhookSecret?: string;
}

/**
 * Simple Env source type: compatible with process.env but easy to mock in tests.
 */
export type EnvSource = Record<string, string | undefined>;

export interface StripeConfigBuildResult {
  config: StripeInternalConfig | null;
  issues: ConfigValidationIssue[];
}

/**
 * Build Stripe internal config from environment variables.
 *
 * - If `enabled` is false: returns { config: null, issues: [] }
 * - If `enabled` is true: expects PAYMENTKIT_STRIPE_API_KEY (required)
 *   and PAYMENTKIT_STRIPE_WEBHOOK_SECRET (optional).
 */
export function buildStripeInternalConfig(
  enabled: boolean,
  env: EnvSource,
  prefix = 'PAYMENTKIT_STRIPE_',
): StripeConfigBuildResult {
  if (!enabled) {
    return { config: null, issues: [] };
  }

  const issues: ConfigValidationIssue[] = [];

  const apiKey = env[`${prefix}API_KEY`];
  const webhookSecret = env[`${prefix}WEBHOOK_SECRET`];

  if (!apiKey || apiKey.trim().length === 0) {
    issues.push({
      path: 'gateways.stripe',
      message: `${prefix}API_KEY is required when Stripe gateway is enabled`,
      code: 'STRIPE_API_KEY_REQUIRED',
    });

    return {
      config: null,
      issues,
    };
  }

  const normalizedApiKey = apiKey.trim();

  const config: StripeInternalConfig = {
    apiKey: normalizedApiKey,
  };

  if (webhookSecret && webhookSecret.trim().length > 0) {
    config.webhookSecret = webhookSecret.trim();
  }

  return {
    config,
    issues,
  };
}
