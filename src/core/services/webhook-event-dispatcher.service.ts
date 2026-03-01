import type { WebhookEvent, WebhookEventListener } from '@src/common/types/webhook.types';

/**
 * Dispatcher interface so we can swap implementations later if needed.
 */
export interface WebhookEventDispatcher {
  /**
   * Register a listener for a given event type.
   * Returns an unsubscribe function.
   */
  on(type: string, listener: WebhookEventListener): () => void;

  /**
   * Explicitly remove a listener for a given event type.
   */
  off(type: string, listener: WebhookEventListener): void;

  /** }
   * Emit an event to all listeners registered for its type.
   * Errors in listeners are swallowed for now (we can add logging later).
   */
  emit<TPayload = unknown>(event: WebhookEvent<TPayload>): Promise<void>;
}

/**
 * Simple in-memory implementation used by PaymentKit.
 * Meant to be registered as a singleton in the Nest layer.
 */
export class InMemoryWebhookEventDispatcher implements WebhookEventDispatcher {
  private readonly listeners = new Map<string, Set<WebhookEventListener>>();

  on(type: string, listener: WebhookEventListener): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set<WebhookEventListener>();
      this.listeners.set(type, set);
    }
    set.add(listener);

    // return unsubscribe fn
    return () => this.off(type, listener);
  }

  off(type: string, listener: WebhookEventListener): void {
    const set = this.listeners.get(type);
    if (!set) return;

    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(type);
    }
  }

  async emit<TPayload = unknown>(event: WebhookEvent<TPayload>): Promise<void> {
    const set = this.listeners.get(event.type);
    if (!set || set.size === 0) {
      return;
    }

    const listeners = Array.from(set);

    await Promise.all(
      listeners.map(async (listener) => {
        try {
          await listener(event);
        } catch {
          // swallow for now; logging/hook can be added later
        }
      }),
    );
  }
}
