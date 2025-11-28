import { Injectable } from '@nestjs/common';
import { GatewayKey } from '@src/common/types/gateway.types';

export interface IncomingWebhookContext {
  body: unknown;
  headers: Record<string, string | string[]>;
}
/**
 * Contract for gateway-specific webhook handlers.
 * (StripeWebhookHandler, PayPalWebhookHandler, etc)
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
  }): Promise<void> {
    const handler = this.handlers.get(input.gateway);

    if (!handler) {
      // No handler registered for this gateway yet → no-op.
      return;
    }

    await handler.handleWebhook({
      body: input.body,
      headers: input.headers,
    });
  }
}
