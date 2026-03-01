import type { PaypalInternalConfig } from '@config/gateways/paypal.config';
import type { GatewayKey } from '@src/common/types/gateway.types';
import type { WebhookEvent } from '@src/common/types/webhook.types';
import type {
  GatewayWebhookHandler,
  IncomingWebhookContext,
} from '@src/core/services/webhook-gateway-router.service';

import { normalizePaypalWebhookEvent } from './paypal-webhook-normalizer';
import { verifyPaypalWebhook } from './paypal-webhook-verifier';

/**
 * Gateway-specific webhook handler for PayPal.
 *
 * Responsibilities:
 *  - Verify webhook preconditions (webhookId + required headers)
 *  - Normalize PayPal event → PaymentKit WebhookEvent[]
 */
export class PaypalWebhookHandler implements GatewayWebhookHandler {
  readonly key: GatewayKey = 'paypal';

  constructor(private readonly config: PaypalInternalConfig | null) {}

  handleWebhook(context: IncomingWebhookContext): Promise<WebhookEvent[] | void> {
    // If no config, we consider PayPal disabled → no-op.
    if (!this.config) {
      return Promise.resolve();
    }

    const verification = verifyPaypalWebhook({
      config: this.config,
      headers: context.headers,
      body: context.body,
    });

    if (!verification.isValid) {
      // For now we fail silently; controller already did generic signature checks.
      // We could log or throw in a future iteration.
      return Promise.resolve();
    }

    const events = normalizePaypalWebhookEvent(context.body);

    if (!events.length) {
      return Promise.resolve();
    }

    return Promise.resolve(events);
  }
}
