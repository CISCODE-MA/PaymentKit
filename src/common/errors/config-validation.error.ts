import type { ConfigValidationIssue } from '@config/paymentKit.config';

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
 * Helper that throws if validation fails and returns a normalized config if ok.
 * This will be used later by the ConfigLoader / Modules
 */

export function parsePaymentKitPublicConfig(raw: unknown) {
  // Lazy import to avoid circular deps in further implementations
  // eslint-disable-next-line @typescript-eslint/no-var-requires

  const { validatePaymentKitPublicConfig } =
    require('@config/paymentKit.config') as typeof import('@config/paymentKit.config');

  const result = validatePaymentKitPublicConfig(raw);
  if (!result.valid) {
    throw new ConfigValidationError(result.issues);
  }

  return raw as import('@config/paymentKit.config').PaymentKitPublicConfig;
}
