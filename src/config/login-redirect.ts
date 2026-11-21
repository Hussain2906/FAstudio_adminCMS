export function getSafeLoginRedirect(
  requestedPath: string | null,
  origin: string,
  fallback: string,
): string {
  if (!requestedPath) return fallback;

  try {
    const target = new URL(requestedPath, origin);
    if (target.origin !== origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
