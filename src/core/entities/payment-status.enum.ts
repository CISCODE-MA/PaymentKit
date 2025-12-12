/**
 * Unified payment lifecycle statuses across all gateways.
 */
export enum PaymentStatus {
  Pending = 'pending',
  Authorized = 'authorized',
  Captured = 'captured',
  Refunded = 'refunded',
  PartiallyRefunded = 'partially_refunded',
  Failed = 'failed',
  Canceled = 'canceled',
}
