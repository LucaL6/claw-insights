import pino, { type Logger, type TransportTargetOptions } from 'pino';

/** Resolve log level: LOG_LEVEL env > default 'info' */
function resolveLevel(): string {
  return process.env.LOG_LEVEL || 'info';
}

/** Resolve optional log file path: LOG_FILE env > default undefined */
function resolveLogFile(): string | undefined {
  return process.env.LOG_FILE || undefined;
}

/** Check if pino-pretty is available (devDependency, may be absent in production installs) */
function hasPinoPretty(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

function createLogger(): Logger {
  const level = resolveLevel();
  const usePretty = process.env.LOG_PRETTY === 'true' ||
    (process.env.NODE_ENV !== 'production' && hasPinoPretty());
  const logFile = resolveLogFile();

  const targets: TransportTargetOptions[] = [];

  // stdout: always on — pretty if available in dev, JSON otherwise
  if (usePretty) {
    targets.push({ target: 'pino-pretty', options: { colorize: true }, level });
  } else {
    targets.push({ target: 'pino/file', options: { destination: 1 }, level }); // stdout JSON
  }

  // file: optional
  if (logFile) {
    targets.push({ target: 'pino/file', options: { destination: logFile, mkdir: true }, level });
  }

  return pino({ level, transport: { targets } });
}

export const logger = createLogger();

/** Create a child logger with a module name field */
export function createChildLogger(module: string): Logger {
  return logger.child({ module });
}
