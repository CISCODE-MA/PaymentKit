import type { PaypalInternalConfig } from '@config/gateways/paypal.config';

export interface PaypalWebhookVerificationInput {
  config: PaypalInternalConfig;
  headers: Record<string, string | string[]>;
  body: unknown;
}

export interface PaypalWebhookVerificationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Very lightweight verification helper for PayPal webhooks.
 *
 * Real PayPal verification involves calling the
 * `/v1/notifications/verify-webhook-signature` endpoint with:
 *  - transmission id
 *  - transmission time
 *  - cert URL
 *  - auth algo
 *  - transmission sig
 *  - webhook id
 *  - request body
 *
 * For now we validate:
 *  - a webhookId is configured
 *  - required headers are present and non-empty
 *
 * The actual remote verification call can be plugged in later on top
 * of this helper.
 */
export function verifyPaypalWebhook(
  input: PaypalWebhookVerificationInput,
): PaypalWebhookVerificationResult {
  const { config, headers } = input;

  if (!config.webhookId || config.webhookId.trim().length === 0) {
    return {
      isValid: false,
      reason: 'PayPal webhookId is not configured',
    };
  }

  const normalizedHeaders = normalizeHeaders(headers);

  const requiredHeaderNames = [
    'paypal-transmission-id',
    'paypal-transmission-time',
    'paypal-transmission-sig',
    'paypal-cert-url',
    'paypal-auth-algo',
  ] as const;

  for (const name of requiredHeaderNames) {
    const value = normalizedHeaders[name];

    if (!value || value.trim().length === 0) {
      return {
        isValid: false,
        reason: `Missing required PayPal webhook header: ${name}`,
      };
    }
  }

  // At this stage we only check basic preconditions.
  // Real cryptographic verification will be added in a later step.
  return {
    isValid: true,
  };
}

type NormalizedHeaders = Record<string, string | undefined>;

function normalizeHeaders(headers: Record<string, string | string[]>): NormalizedHeaders {
  const result: NormalizedHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    const first = Array.isArray(value) ? value[0] : value;
    result[lower] = first;
  }

  return result;
}
