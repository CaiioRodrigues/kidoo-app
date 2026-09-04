/**
 * Logger com redação de PII. Nunca use console.* direto em código de produto:
 * logs de RN vazam para logcat/Console.app e podem conter dado de criança.
 */
const IS_DEV = __DEV__;

const SENSITIVE_KEYS = new Set([
  'password',
  'accessToken',
  'token',
  'email',
  'photoUri',
  'birthDate',
  'name',
  'cpf',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEYS.has(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return output;
}

export const logger = {
  debug(message: string, context?: unknown): void {
    if (!IS_DEV) return;
    // eslint-disable-next-line no-console
    console.log(`[kidoo] ${message}`, context === undefined ? '' : redact(context));
  },
  warn(message: string, context?: unknown): void {
    console.warn(`[kidoo] ${message}`, context === undefined ? '' : redact(context));
  },
  error(message: string, context?: unknown): void {
    console.error(`[kidoo] ${message}`, context === undefined ? '' : redact(context));
  },
};
