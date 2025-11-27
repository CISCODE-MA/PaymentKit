import {
  validatePaymentKitPublicConfig,
  type ConfigValidationIssue,
  type PaymentKitPublicConfig,
} from '../../config/paymentKit.config';

export class ConfigValidationError extends Error {
  readonly issues: ConfigValidationIssue[];

  constructor(issues: ConfigValidationIssue[]) {
    super(ConfigValidationError.buildMessage(issues));
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }

  private static buildMessage(issues: ConfigValidationIssue[]): string {
    if (!issues.length) {
      return 'Configuration validation failed with unknown error';
    }

    return issues
      .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
      .join('; ');
  }
}

/**
 * Fail-fast helper used by the config loader / module.
 */
export function parsePaymentKitPublicConfig(raw: unknown): PaymentKitPublicConfig {
  const result = validatePaymentKitPublicConfig(raw);

  if (!result.valid) {
    throw new ConfigValidationError(result.issues);
  }

  return raw as PaymentKitPublicConfig;
}
