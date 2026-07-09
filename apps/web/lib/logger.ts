import pino from 'pino';

// Structured logger. No console.log in committed code (see docs/02-BUILD-SPEC.md).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
});
