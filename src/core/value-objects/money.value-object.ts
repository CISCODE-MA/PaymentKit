/**
 * Money Value Object.
 *
 * Amount is always expressed in minor units (e.g. cents).
 * Example: 1000 = $10.00 if currency is 'USD'
 */
export interface Money {
  /**
   * ISO 4217 currency code (e.g. 'USD', 'EUR').
   */
  currency: string;

  /**
   * Amount in minor units (e.g. cents)
   */
  amount: number;
}
