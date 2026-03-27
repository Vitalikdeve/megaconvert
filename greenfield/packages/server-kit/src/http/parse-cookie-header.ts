export function parseCookieHeader(cookieHeader: string | undefined): ReadonlyMap<string, string> {
  if (!cookieHeader) {
    return new Map();
  }

  const cookieEntries = cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const separatorIndex = segment.indexOf('=');

      if (separatorIndex < 0) {
        return null;
      }

      const key = segment.slice(0, separatorIndex).trim();
      const rawValue = segment.slice(separatorIndex + 1).trim();

      if (key.length === 0) {
        return null;
      }

      try {
        return [key, decodeURIComponent(rawValue)] as const;
      } catch {
        return [key, rawValue] as const;
      }
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  return new Map(cookieEntries);
}
