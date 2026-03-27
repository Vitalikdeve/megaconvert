export function resolveCorrelationId(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length < 8 || normalizedValue.length > 128) {
    return undefined;
  }

  return /^[A-Za-z0-9._-]+$/.test(normalizedValue) ? normalizedValue : undefined;
}
