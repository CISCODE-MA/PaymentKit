import { Injectable } from '@nestjs/common';
import { GatewayKey } from '@src/common/types/gateway.types';
import { WebhookEvent } from '@src/common/types/webhook.types';

export interface IncomingWebhookContext {
  body: unknown;
  headers: Record<string, string | string[]>;
}
/**
 * Contract for gateway-specific webhook handlers.
 * (StripeWebhookHandler, PayPalWebhookHandler, etc)
 *
 * Each handler is responsible for:
 * - interpreting the raw provider webhook payload
 * - normalizing it to one or more WebhookEvent objects
 */
export interface GatewayWebhookHandler {
  readonly key: GatewayKey;
  handleWebhook(context: IncomingWebhookContext): Promise<void>;
}

/**
 * Simple in-memory router: maps a GatewayKey to its webhook handler.
 * Handlers will be registered in later epics.
 */

@Injectable()
export class WebhookGatewayRouter {
  private readonly handlers = new Map<GatewayKey, GatewayWebhookHandler>();

  registerHandler(handler: GatewayWebhookHandler): void {
    this.handlers.set(handler.key, handler);
  }

  async route(input: {
    gateway: GatewayKey;
    body: unknown;
    headers: Record<string, string | string[]>;
  }): Promise<WebhookEvent[] | void> {
    const handler = this.handlers.get(input.gateway);

    if (!handler) {
      // No handler registered for this gateway yet → no-op.
      return;
    }

    const events = await handler.handleWebhook({
      body: input.body,
      headers: input.headers,
    });

    // Ticket 299 stops here: router just returns the normalized events.
    // Ticket 301 will plug the dispatcher in and emit them.
    return events;
  }
}
