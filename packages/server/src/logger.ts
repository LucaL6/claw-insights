import pino, { type Logger, type TransportTargetOptions } from 'pino';

import { loggingRuntimeState } from './logging/index.js';
import { LayeredRuntime, type MethodLevel } from './logging/runtime.js';

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
  const usePretty = process.env.LOG_PRETTY === 'true' || (process.env.NODE_ENV !== 'production' && hasPinoPretty());
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

// Layered runtime is the only mode (legacy removed in v0.10).
const layeredRuntime = new LayeredRuntime({ runtimeState: loggingRuntimeState });

function wrapChildLogger(base: Logger, module: string): Logger {
  const proxy = new Proxy(base as unknown as Record<PropertyKey, unknown>, {
    get(target, prop, receiver) {
      if (prop === 'child') {
        return (bindings: Record<string, unknown>) => {
          const child = (target.child as (b: Record<string, unknown>) => Logger).call(target, bindings);
          const childModule = typeof bindings.module === 'string' ? bindings.module : module;
          return wrapChildLogger(child, childModule);
        };
      }

      if (
        prop === 'trace' ||
        prop === 'debug' ||
        prop === 'info' ||
        prop === 'warn' ||
        prop === 'error' ||
        prop === 'fatal'
      ) {
        return (...args: unknown[]) => {
          const level = prop as MethodLevel;
          const fn = target[level] as (...a: unknown[]) => void;
          const isEnabled =
            typeof target.isLevelEnabled === 'function'
              ? (target.isLevelEnabled as (lvl: string) => boolean).call(target, level)
              : true;

          // pino stdout/file write
          fn.apply(target, args);

          if (isEnabled) {
            // Layered structured log write
            layeredRuntime.write(level, module, args);
          }
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });

  return proxy as unknown as Logger;
}

export const logger = createLogger();

/** Create a child logger with a module name field */
export function createChildLogger(module: string): Logger {
  return wrapChildLogger(logger.child({ module }), module);
}
