interface SerializedError {
  message: string;
  stack?: string;
  type: string;
  code?: string;
}

export function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      type: err.constructor.name,
      ...('code' in err && typeof err.code === 'string' ? { code: err.code } : {}),
    };
  }
  if (err === null || err === undefined) {
    return { message: String(err), type: String(err) };
  }
  if (typeof err === 'string') {
    return { message: err, type: 'string' };
  }
  try {
    return { message: JSON.stringify(err), type: typeof err };
  } catch {
    return { message: String(err), type: typeof err };
  }
}
