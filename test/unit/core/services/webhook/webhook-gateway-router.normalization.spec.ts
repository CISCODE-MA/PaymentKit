import type { GatewayKey } from '@common/types/gateway.types';
import type { WebhookEvent } from '@common/types/webhook.types';
import type { WebhookEventDispatcher } from '@src/core/services/webhook-event-dispatcher.service';
import {
  WebhookGatewayRouter,
  type GatewayWebhookHandler,
  type IncomingWebhookContext,
} from '@src/core/services/webhook-gateway-router.service';

const makeEvent = (type = 'payment.succeeded'): WebhookEvent => ({
  type,
  gateway: 'stripe',
  payload: { id: 'pay_1' },
  occurredAt: new Date(),
});

class FakeDispatcher implements WebhookEventDispatcher {
  public readonly emitted: WebhookEvent[] = [];

  on(): () => void {
    return () => {};
  }

  off(): void {}

  emit<TPayload = unknown>(event: WebhookEvent<TPayload>): Promise<void> {
    this.emitted.push(event);
    return Promise.resolve();
  }
}

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
  it('emits multiple normalized events from the handler', async () => {
    const dispatcher = new FakeDispatcher();
    const router = new WebhookGatewayRouter(dispatcher);

    const e1 = makeEvent('payment.created');
    const e2 = makeEvent('payment.succeeded');

    const handler = new FakeHandler('stripe', [e1, e2]);
    router.registerHandler(handler);

    await router.route({
      gateway: 'stripe',
      body: { ok: true },
      headers: {},
    });

    expect(dispatcher.emitted).toHaveLength(2);
    expect(dispatcher.emitted).toEqual([e1, e2]);
  });

  it('does not emit when handler returns void', async () => {
    const dispatcher = new FakeDispatcher();
    const router = new WebhookGatewayRouter(dispatcher);

    const handler = new FakeHandler('stripe', undefined);
    router.registerHandler(handler);

    await router.route({
      gateway: 'stripe',
      body: { ok: true },
      headers: {},
    });

    expect(dispatcher.emitted).toHaveLength(0);
  });

  it('still attempts to emit when handler returns malformed events array', async () => {
    const dispatcher = new FakeDispatcher();
    const router = new WebhookGatewayRouter(dispatcher);

    const handler = new FakeHandler(
      'stripe',
      // @ts-expect-error intentionally wrong for test
      [
        {
          type: 123,
          payload: 'bad',
          gateway: 'stripe',
          occurredAt: new Date(),
        },
      ],
    );

    router.registerHandler(handler);

    await router.route({
      gateway: 'stripe',
      body: {},
      headers: {},
    });

    expect(dispatcher.emitted).toHaveLength(1);
  });
});
