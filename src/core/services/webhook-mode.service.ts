import type { WebhookMode } from '@src/common/types/webhook.types';
import type { PaymentKitResolvedConfig } from '@src/config/paymentKit.config-loader';

/**
 * Read-only helper aruond the resolved config's webhook mode.
 * Keeps "manual vs internal" logic in one place.
 */
export interface WebhookModeService {
  getMode(): WebhookMode;
  isInternalMode(): boolean;
  isManualMode(): boolean;
}

/**
 * Default implementation used inside PaymentKit.
 */
export class DefaultWebhookModeService implements WebhookModeService {
  constructor(private readonly config: PaymentKitResolvedConfig) {}

  getMode(): WebhookMode {
    return this.config.webhooks.mode;
  }

  isInternalMode(): boolean {
    return this.getMode() === 'internal';
  }

  isManualMode(): boolean {
    return this.getMode() === 'manual';
  }
}
