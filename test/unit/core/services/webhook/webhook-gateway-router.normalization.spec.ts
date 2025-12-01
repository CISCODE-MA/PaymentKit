import {
  WebhookGatewayRouter,
  type GatewayWebhookHandler,
  type IncomingWebhookContext,
} from '@src/core/services/webhook-gateway-router.service';
import type { WebhookEvent } from '@common/types/webhook.types';
import type { GatewayKey } from '@common/types/gateway.types';

const makeEvent = (type = 'payment.succeeded'): WebhookEvent => ({
  type,
  gateway: 'stripe',
  payload: { id: 'pay_1' },
  occurredAt: new Date(),
});

class FakeHandler implements GatewayWebhookHandler {
  public readonly key: GatewayKey;
  public readonly events: WebhookEvent[] | void;
  public readonly calls: IncomingWebhookContext[] = [];

  constructor(key: GatewayKey, events: WebhookEvent[] | void) {
    this.key = key;
    this.events = events;
  }

  handleWebhook(context: IncomingWebhookContext): Promise<WebhookEvent[] | void> {
    this.calls.push(context);
    return Promise.resolve(this.events);
  }
}

describe('WebhookGatewayRouter – normalization behavior', () => {
  it('returns multiple normalized events from the handler', async () => {
    const e1 = makeEvent('payment.created');
    const e2 = makeEvent('payment.succeeded');

    const handler = new FakeHandler('stripe', [e1, e2]);
    const router = new WebhookGatewayRouter();
    router.registerHandler(handler);

    const result = await router.route({
      gateway: 'stripe',
      body: { ok: true },
      headers: {},
    });

    expect(result).toEqual([e1, e2]);
  });

  it('returns undefined when handler returns void', async () => {
    const handler = new FakeHandler('stripe', undefined);
    const router = new WebhookGatewayRouter();
    router.registerHandler(handler);

    const result = await router.route({
      gateway: 'stripe',
      body: { ok: true },
      headers: {},
    });

    expect(result).toBeUndefined();
  });

  it('does not break if handler returns malformed events', async () => {
    const handler = new FakeHandler('stripe', [
      {
        // @ts-expect-error intentionally wrong for testing
        type: 123,
        payload: 'bad',
        gateway: 'stripe',
        occurredAt: new Date(),
      },
    ]);

    const router = new WebhookGatewayRouter();
    router.registerHandler(handler);

    const result = await router.route({
      gateway: 'stripe',
      body: {},
      headers: {},
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result?.length).toBe(1);
  });
});
