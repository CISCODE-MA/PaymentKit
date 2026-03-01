import type { GatewayKey } from '@src/common/types/gateway.types';
import type { WebhookEvent } from '@src/common/types/webhook.types';
import type {
  GatewayWebhookHandler,
  IncomingWebhookContext,
} from '@src/core/services/webhook-gateway-router.service';

import { normalizeStripeWebhook } from './stripe-webhook-normalizer';
import { verifyStripeWebhook } from './stripe-webhook-verifier';

/**
 * Gateway-specific webhook handler for Stripe.
 *
 * Responsibilities:
 *  - verify Stripe signature.
 *  - normalize Stripe event into Payment WEbhookEvent.
 *  - emit events through WebhookEventDispatcher in INTERNAL mode
 *  - always return the normalized events to the caller (router).
 *
 */

export class StripeWebhookHandler implements GatewayWebhookHandler {
  readonly key: GatewayKey = 'stripe';

  /**
   * Stripe endpoint secret for this webhook,
   * If null, we treat Stripe webhook as disabled.
   */
  constructor(private readonly endpointSecret: string | null) {}

  handleWebhook(context: IncomingWebhookContext): Promise<WebhookEvent[] | void> {
    // If no secret, Stripe webhook handling is effectively disabled → no-op.
    if (!this.endpointSecret) {
      return Promise.resolve();
    }

    const signatureHeader = this.extractSignatureHeader(context.headers);

    const payloadString =
      typeof context.body === 'string' ? context.body : JSON.stringify(context.body ?? {});

    const verification = verifyStripeWebhook({
      payload: payloadString,
      signatureHeader,
      endpointSecret: this.endpointSecret,
    });

    if (!verification.isValid) {
      // Same as Paypal: Fail silently for now (could be logged later)
      return Promise.resolve();
    }

    let rawEvent: unknown = context.body;

    if (typeof context.body === 'string') {
      try {
        rawEvent = JSON.parse(context.body) as unknown;
      } catch {
        // If parsing fails, keep the raw string as-is
        rawEvent = context.body;
      }
    }

    const events = normalizeStripeWebhook(rawEvent);

    if (!events.length) {
      return Promise.resolve();
    }
    return Promise.resolve(events);
  }

  private extractSignatureHeader(headers: Record<string, string | string[]>): string | undefined {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === 'stripe-signature');

    if (!key) return undefined;
    const value = headers[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
}
