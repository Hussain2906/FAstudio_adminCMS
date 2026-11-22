export function authDiagnosticsEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return document.documentElement.dataset.authDiagnostics === 'true';
  }
  return process.env.AUTH_DIAGNOSTICS_ENABLED === 'true';
}

export function safeRequestId(value?: string | null): string {
  return value && /^[a-f0-9-]{36}$/i.test(value) ? value : crypto.randomUUID();
}

export function logAuthDiagnostic(event: string, data: Record<string, string | number | boolean | null>): void {
  if (authDiagnosticsEnabled()) console.info(JSON.stringify({ diagnostic: 'auth', stage: event, ...data }));
}
