import { pino, type TransportTargetOptions } from 'pino';

import { config } from '../config/env';

const targets: TransportTargetOptions[] = [];
if (config.nodeEnv === 'development') {
  targets.push({
    target: 'pino-pretty',
    level: config.logLevel,
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
  });
} else if (config.logFile) {
  targets.push({ target: 'pino/file', level: config.logLevel, options: { destination: 1 } });
}
if (config.logFile) {
  // Structured JSON lines, e.g. for reviewing a manual test session afterwards.
  targets.push({
    target: 'pino/file',
    level: config.logLevel,
    options: { destination: config.logFile, mkdir: true },
  });
}

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  ...(targets.length > 0 && { transport: { targets } }),
});
