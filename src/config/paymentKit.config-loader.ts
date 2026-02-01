import {
  type PaymentKitEnvironment,
  type PaymentKitPublicConfig,
  type ConfigValidationIssue,
} from './paymentKit.config';
import {
  ConfigValidationError,
  parsePaymentKitPublicConfig,
} from '../common/errors/config-validation.error';

import {
  buildStripeInternalConfig,
  type StripeInternalConfig,
  type EnvSource as StripeEnvSource,
} from './gateways/stripe.config';

import {
  buildPaypalInternalConfig,
  type PaypalInternalConfig,
  type EnvSource as PaypalEnvSource,
} from './gateways/paypal.config';

import type { WebhookMode } from '../common/types/webhook.types';

export interface PaymentKitResolvedGateways {
  stripe?: StripeInternalConfig;
  paypal?: PaypalInternalConfig;
}

export interface PaymentKitResolvedWebhooks {
  mode: WebhookMode;
}

export interface PaymentKitResolvedConfig {
  environment: PaymentKitEnvironment;
  defaultCurrency: string;
  gateways: PaymentKitResolvedGateways;
  webhooks: PaymentKitResolvedWebhooks;
}

type GenericEnv = Record<string, string | undefined>;

export class PaymentKitConfigLoader {
  /**
   * Build the fully resolved internal config from a public config and an env source.
   *
   * - Validates the public config shape (throws ConfigValidationError on failure)
   * - Uses each gateway builder for enabled gateways
   * - Aggregates gateway issues and throws ConfigValidationError if any
   */
  static loadFromEnv(
    rawConfig: PaymentKitPublicConfig,
    env: GenericEnv = process.env,
  ): PaymentKitResolvedConfig {
    // 1) Validate high-level config (environment, defaultCurrency, gateways shape)
    const validConfig = parsePaymentKitPublicConfig(rawConfig);

    const { environment, defaultCurrency, gateways, webhooks } = validConfig;

    const issues: ConfigValidationIssue[] = [];
    const resolvedGateways: PaymentKitResolvedGateways = {};

    // 2) Stripe
    const stripeEnabled = gateways.stripe?.enabled === true;
    const stripeResult = buildStripeInternalConfig(stripeEnabled, env as StripeEnvSource);
    if (stripeResult.issues.length > 0) {
      issues.push(...stripeResult.issues);
    }
    if (stripeResult.config) {
      resolvedGateways.stripe = stripeResult.config;
    }

    // 3) PayPal
    const paypalEnabled = gateways.paypal?.enabled === true;
    const paypalResult = buildPaypalInternalConfig(paypalEnabled, env as PaypalEnvSource);
    if (paypalResult.issues.length > 0) {
      issues.push(...paypalResult.issues);
    }
    if (paypalResult.config) {
      resolvedGateways.paypal = paypalResult.config;
    }

    // 4) Aggregate errors (fail-fast)
    if (issues.length > 0) {
      throw new ConfigValidationError(issues);
    }

    // 6) Resolve webhook mode (default to "internal" if not provided)
    const webhookMode: WebhookMode = webhooks?.mode ?? 'internal';

    return {
      environment,
      defaultCurrency,
      gateways: resolvedGateways,
      webhooks: {
        mode: webhookMode,
      },
    };
  }
}
