import {
  WebhookGatewayRouter,
  type GatewayWebhookHandler,
  type IncomingWebhookContext,
} from '@src/core/services/webhook-gateway-router.service';
import type { GatewayKey } from '@common/types/gateway.types';
import type { WebhookEvent } from '@common/types/webhook.types';
import type { WebhookEventDispatcher } from '@src/core/services/webhook-event-dispatcher.service';

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
  it('routes to the correct handler based on gateway key and emits events', async () => {
    const dispatcher = new FakeDispatcher();
    const router = new WebhookGatewayRouter(dispatcher);

    const events = [makeEvent()];
    const stripeHandler = new FakeHandler('stripe', events);
    const paypalHandler = new FakeHandler('paypal', undefined);

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

    expect(dispatcher.emitted).toHaveLength(1);
    expect(dispatcher.emitted[0]).toBe(events[0]);
  });

  it('does nothing when no handler is registered for gateway', async () => {
    const dispatcher = new FakeDispatcher();
    const router = new WebhookGatewayRouter(dispatcher);

    await expect(
      router.route({
        gateway: 'adyen',
        body: { test: true },
        headers: {},
      }),
    ).resolves.toBeUndefined();

    expect(dispatcher.emitted).toHaveLength(0);
  });
});
