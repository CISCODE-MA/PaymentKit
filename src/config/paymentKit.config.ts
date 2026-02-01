import { WebhookMode } from '@src/common/types/webhook.types';

export type PaymentKitEnvironment = 'sandbox' | 'production';

export interface PaymentKitGatewayToggleConfig {
  enabled: boolean;
}

export interface PaymentKitGatewaysConfig {
  stripe?: PaymentKitGatewayToggleConfig;
  paypal?: PaymentKitGatewayToggleConfig;
}

export interface PaymentKitWebhookConfig {
  /**
   * Webhook processing mode.
   * - "internal": PaymentKit processes webhooks internally.
   * - "manual":  PaymentKit emits normalized events, the host app acts.
   */
  mode: WebhookMode;
}

/**
 * Public config passed by the user to PaymentKitModule.register(...)
 */
export interface PaymentKitPublicConfig {
  environment: PaymentKitEnvironment;
  defaultCurrency: string;
  gateways: PaymentKitGatewaysConfig;
  webhooks?: PaymentKitWebhookConfig;
}

export interface ConfigValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  issues: ConfigValidationIssue[];
}

/**
 * Validate a raw config object (e.g. from user code).
 * Does not throw. Use parsePaymentKitPublicConfig if you want fail-fast.
 */
export function validatePaymentKitPublicConfig(raw: unknown): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  if (typeof raw !== 'object' || raw === null) {
    issues.push({
      path: '',
      message: 'Configuration must be a non-null object',
      code: 'CONFIG_NOT_OBJECT',
    });
    return { valid: false, issues };
  }

  const obj = raw as Record<string, unknown>;

  // environment
  const env = obj.environment;
  if (typeof env !== 'string') {
    issues.push({
      path: 'environment',
      message: 'environment is required and must be a string',
      code: 'ENVIRONMENT_REQUIRED',
    });
  } else if (env !== 'sandbox' && env !== 'production') {
    issues.push({
      path: 'environment',
      message: 'environment must be "sandbox" or "production"',
      code: 'ENVIRONMENT_INVALID',
    });
  }

  // defaultCurrency
  const currency = obj.defaultCurrency;
  if (typeof currency !== 'string' || currency.trim().length === 0) {
    issues.push({
      path: 'defaultCurrency',
      message: 'defaultCurrency is required and must be a non-empty string',
      code: 'DEFAULT_CURRENCY_REQUIRED',
    });
  }

  // gateways
  const rawGateways = obj.gateways;
  let gateways: Record<string, unknown> = {};

  if (rawGateways === undefined) {
    issues.push({
      path: 'gateways',
      message: 'gateways is required and must be an object',
      code: 'GATEWAYS_REQUIRED',
    });
  } else if (typeof rawGateways !== 'object' || rawGateways === null) {
    issues.push({
      path: 'gateways',
      message: 'gateways must be an object',
      code: 'GATEWAYS_NOT_OBJECT',
    });
  } else {
    gateways = rawGateways as Record<string, unknown>;
  }

  const knownGateways = ['stripe', 'paypal'] as const;

  for (const key of Object.keys(gateways)) {
    if (!knownGateways.includes(key as (typeof knownGateways)[number])) {
      issues.push({
        path: `gateways.${key}`,
        message: `Unknown gateway "${key}"`,
        code: 'GATEWAY_UNKNOWN',
      });
      continue;
    }

    const value = gateways[key];
    if (value === undefined) continue;

    if (typeof value !== 'object' || value === null) {
      issues.push({
        path: `gateways.${key}`,
        message: 'Gateway config must be an object',
        code: 'GATEWAY_NOT_OBJECT',
      });
      continue;
    }

    const enabled = (value as Record<string, unknown>).enabled;
    if (typeof enabled !== 'boolean') {
      issues.push({
        path: `gateways.${key}.enabled`,
        message: 'enabled must be a boolean',
        code: 'GATEWAY_ENABLED_INVALID',
      });
    }
  }

  // webhooks (optional)
  const rawWebhooks = obj.webhooks;
  if (rawWebhooks !== undefined) {
    if (typeof rawWebhooks !== 'object' || rawWebhooks === null) {
      issues.push({
        path: 'webhooks',
        message: 'webhooks must be an object if provided',
        code: 'WEBHOOKS_NOT_OBJECT',
      });
    } else {
      const webhooksObj = rawWebhooks as Record<string, unknown>;
      const mode = webhooksObj.mode;

      if (mode !== 'internal' && mode !== 'manual') {
        issues.push({
          path: 'webhooks.mode',
          message: 'webhooks.mode must be either "internal" or "manual"',
          code: 'WEBHOOKS_MODE_INVALID',
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
