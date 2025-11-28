import { PaymentStatus } from '@src/core/entities/payment-status.enum';

describe('PaymentStatus enum', () => {
  it('exposes the expected statuses', () => {
    expect(PaymentStatus.Pending).toBe('pending');
    expect(PaymentStatus.Authorized).toBe('authorized');
    expect(PaymentStatus.Captured).toBe('captured');
    expect(PaymentStatus.Refunded).toBe('refunded');
    expect(PaymentStatus.PartiallyRefunded).toBe('partially_refunded');
    expect(PaymentStatus.Failed).toBe('failed');
    expect(PaymentStatus.Canceled).toBe('canceled');
  });
});
