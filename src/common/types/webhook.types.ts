/**
 * Webhook hendling mode for PaymekntKit.
 *
 * - "internal": Webhooks are handled internally by PaymentKit.
 * - "external": Host application consumes normalized events and implements its own side effects.
 */
export type WebhookMode = 'internal' | 'manual';

/**
 * Default mode when none is provided in user configuration.
 */
export const DEFAULT_WEBHOOK_MODE: WebhookMode = 'internal';
