import {
  WebhookGatewayRouter,
  type GatewayWebhookHandler,
  type IncomingWebhookContext,
} from '@src/core/services/webhook-gateway-router.service';
import type { GatewayKey } from '@common/types/gateway.types';

class FakeHandler implements GatewayWebhookHandler {
  public readonly calls: IncomingWebhookContext[] = [];

  constructor(public readonly key: GatewayKey) {}

  handleWebhook(context: IncomingWebhookContext): Promise<void> {
    this.calls.push(context);
    return Promise.resolve();
  }
}

describe('WebhookGatewayRouter', () => {
  it('routes to the correct handler based on gateway key', async () => {
    const router = new WebhookGatewayRouter();
    const stripeHandler = new FakeHandler('stripe');
    const paypalHandler = new FakeHandler('paypal');

    router.registerHandler(stripeHandler);
    router.registerHandler(paypalHandler);

    await router.route({
      gateway: 'stripe',
      body: { foo: 'bar' },
      headers: { 'x-test': '1' },
    });

    expect(stripeHandler.calls).toHaveLength(1);
    expect(stripeHandler.calls[0].body).toEqual({ foo: 'bar' });
    expect(paypalHandler.calls).toHaveLength(0);
  });

  it('does nothing when no handler is registered for gateway', async () => {
    const router = new WebhookGatewayRouter();

    await expect(
      router.route({
        gateway: 'adyen',
        body: { test: true },
        headers: {},
      }),
    ).resolves.toBeUndefined();
  });
});
