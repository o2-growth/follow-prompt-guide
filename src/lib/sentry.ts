import * as Sentry from "@sentry/react";

/**
 * Inicializa Sentry se VITE_SENTRY_DSN estiver definido.
 * Sem DSN: no-op silencioso (dev / preview).
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}

/**
 * Captura erro com contexto extra. Sempre loga no console também
 * para não silenciar bugs em dev.
 */
export const captureError = (e: unknown, ctx?: Record<string, unknown>) => {
  // eslint-disable-next-line no-console
  console.error(e, ctx);
  Sentry.captureException(e, { extra: ctx });
};
