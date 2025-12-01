import {
  WebhookGatewayRouter,
  type GatewayWebhookHandler,
  type IncomingWebhookContext,
} from '@src/core/services/webhook-gateway-router.service';
import type { GatewayKey } from '@src/common/types/gateway.types';
import type { WebhookEvent } from '@src/common/types/webhook.types';

class FakeHandler implements GatewayWebhookHandler {
  public readonly calls: IncomingWebhookContext[] = [];
  public readonly eventsToReturn: WebhookEvent[] | void;

  constructor(
    public readonly key: GatewayKey,
    eventsToReturn: WebhookEvent[] | void,
  ) {
    this.eventsToReturn = eventsToReturn;
  }

  handleWebhook(context: IncomingWebhookContext): Promise<WebhookEvent[] | void> {
    this.calls.push(context);
    return Promise.resolve(this.eventsToReturn);
  }
}

const makeEvent = (overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
  type: 'payment.succeeded',
  gateway: 'stripe',
  payload: { id: 'pay_1' },
  occurredAt: new Date(),
  ...overrides,
});

describe('WebhookGatewayRouter', () => {
  it('routes to the correct handler based on gateway key and returns events', async () => {
    const router = new WebhookGatewayRouter();
    const events = [makeEvent()];
    const stripeHandler = new FakeHandler('stripe', events);
    const paypalHandler = new FakeHandler('paypal', undefined);

    router.registerHandler(stripeHandler);
    router.registerHandler(paypalHandler);

    const result = await router.route({
      gateway: 'stripe',
      body: { foo: 'bar' },
      headers: { 'x-test': '1' },
    });

    expect(stripeHandler.calls).toHaveLength(1);
    expect(stripeHandler.calls[0].body).toEqual({ foo: 'bar' });
    expect(paypalHandler.calls).toHaveLength(0);

    expect(result).toBe(events);
  });

  it('returns undefined when no handler is registered for gateway', async () => {
    const router = new WebhookGatewayRouter();

    const result = await router.route({
      gateway: 'adyen',
      body: { test: true },
      headers: {},
    });

    expect(result).toBeUndefined();
  });
});
