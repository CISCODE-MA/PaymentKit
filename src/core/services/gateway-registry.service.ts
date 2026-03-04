import type { GatewayKey } from '@src/common/types/gateway.types';

import type { PaymentGateway } from '../ports/payment-gateway.port';

/**
 * Abstraction for a registry that stores gateway implementations.
 */
export interface GatewayRegistry {
  /**
   * Retrieve a gateway by key (e.g. 'stripe).
   */
  get(gateway: GatewayKey): PaymentGateway | undefined;

  /**
   * List all registered gateways.
   */
  list(): PaymentGateway[];
}

/**
 * Simple in-memory registry backed by a Map.
 * It is expected to be built once at startup from config.
 */
export class InMemoryGatewayRegistry implements GatewayRegistry {
  private readonly gatewayMap: ReadonlyMap<GatewayKey, PaymentGateway>;

  constructor(gateways: Iterable<PaymentGateway>) {
    const map = new Map<GatewayKey, PaymentGateway>();

    for (const gateway of gateways) {
      map.set(gateway.key, gateway);
    }
    this.gatewayMap = map;
  }

  get(gateway: GatewayKey): PaymentGateway | undefined {
    return this.gatewayMap.get(gateway);
  }

  list(): PaymentGateway[] {
    return Array.from(this.gatewayMap.values());
  }
}
