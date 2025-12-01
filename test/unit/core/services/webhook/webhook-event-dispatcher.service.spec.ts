import {
  InMemoryWebhookEventDispatcher,
  type WebhookEventDispatcher,
} from '@src/core/services/webhook-event-dispatcher.service';
import type { WebhookEvent } from '@src/common/types/webhook.types';

describe('InMemoryWebhookEventDispatcher', () => {
  const makeEvent = (overrides: Partial<WebhookEvent> = {}): WebhookEvent => ({
    type: 'payment.succeeded',
    gateway: 'stripe',
    payload: { id: 'pay_1' },
    occurredAt: new Date(),
    ...overrides,
  });

  it('does nothing when emitting with no listeners', async () => {
    const dispatcher: WebhookEventDispatcher = new InMemoryWebhookEventDispatcher();

    await expect(dispatcher.emit(makeEvent())).resolves.toBeUndefined();
  });

  it('calls registered listeners for matching event type', async () => {
    const dispatcher: WebhookEventDispatcher = new InMemoryWebhookEventDispatcher();
    const events: WebhookEvent[] = [];

    dispatcher.on('payment.succeeded', (event) => {
      events.push(event);
    });

    const event = makeEvent();
    await dispatcher.emit(event);

    expect(events).toHaveLength(1);
    expect(events[0]).toBe(event);
  });

  it('does not call listeners after they are unsubscribed', async () => {
    const dispatcher: WebhookEventDispatcher = new InMemoryWebhookEventDispatcher();
    const events: WebhookEvent[] = [];

    const unsubscribe = dispatcher.on('payment.succeeded', (event) => {
      events.push(event);
    });

    unsubscribe();

    await dispatcher.emit(makeEvent());

    expect(events).toHaveLength(0);
  });

  it('off() removes listeners explicitly', async () => {
    const dispatcher: WebhookEventDispatcher = new InMemoryWebhookEventDispatcher();
    const events: WebhookEvent[] = [];

    const listener = (event: WebhookEvent) => {
      events.push(event);
    };

    dispatcher.on('payment.succeeded', listener);
    dispatcher.off('payment.succeeded', listener);

    await dispatcher.emit(makeEvent());

    expect(events).toHaveLength(0);
  });

  it('supports multiple listeners for the same event type', async () => {
    const dispatcher: WebhookEventDispatcher = new InMemoryWebhookEventDispatcher();
    const calls: number[] = [];

    dispatcher.on('payment.succeeded', () => {
      calls.push(1);
    });
    dispatcher.on('payment.succeeded', () => {
      calls.push(2);
    });

    await dispatcher.emit(makeEvent());

    expect(calls).toHaveLength(2);
    expect(calls).toEqual(expect.arrayContaining([1, 2]));
  });

  it('awaits async listeners', async () => {
    const dispatcher: WebhookEventDispatcher = new InMemoryWebhookEventDispatcher();
    let called = false;

    dispatcher.on('payment.succeeded', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      called = true;
    });

    await dispatcher.emit(makeEvent());

    expect(called).toBe(true);
  });

  it('swallows listener errors and still calls other listeners', async () => {
    const dispatcher: WebhookEventDispatcher = new InMemoryWebhookEventDispatcher();
    const calls: number[] = [];

    dispatcher.on('payment.succeeded', () => {
      calls.push(1);
      throw new Error('boom');
    });

    dispatcher.on('payment.succeeded', () => {
      calls.push(2);
    });

    await expect(dispatcher.emit(makeEvent())).resolves.toBeUndefined();

    expect(calls).toHaveLength(2);
    expect(calls).toEqual(expect.arrayContaining([1, 2]));
  });
});
