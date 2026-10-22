import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * The provider answered, but did not provide the usage needed to settle the
 * reserved quota. This is deliberately distinct from an ordinary provider
 * failure: releasing the reservation would allow unaccounted usage.
 */
export const PROVIDER_USAGE_METADATA_MISSING =
  'PROVIDER_USAGE_METADATA_MISSING' as const;

export class ProviderUsageMetadataMissingException extends HttpException {
  readonly code = PROVIDER_USAGE_METADATA_MISSING;

  constructor() {
    super(
      'AI provider did not return usage metadata',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export function isProviderUsageMetadataMissing(
  error: unknown,
): error is ProviderUsageMetadataMissingException {
  return (
    error instanceof ProviderUsageMetadataMissingException ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === PROVIDER_USAGE_METADATA_MISSING)
  );
}
