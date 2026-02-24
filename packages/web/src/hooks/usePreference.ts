import { useCallback, useEffect, useRef,useState } from 'react';

const PREFIX = 'ci:';

interface PreferenceOptions<T> {
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  validate?: (value: T) => boolean;
}

function defaultSerialize(value: unknown): string {
  return JSON.stringify(value);
}

function defaultDeserialize(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

function readStored<T>(
  fullKey: string,
  defaultValue: T,
  deserialize: (s: string) => T,
  validate?: (v: T) => boolean,
): T {
  if (typeof window === 'undefined') {return defaultValue;}
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw === null) {return defaultValue;}
    const parsed = deserialize(raw);
    if (validate && !validate(parsed)) {return defaultValue;}
    return parsed;
  } catch {
    return defaultValue;
  }
}

export function usePreference<T>(
  key: string,
  defaultValue: T,
  options?: PreferenceOptions<T>,
): [T, (value: T | ((prev: T) => T)) => void] {
  const fullKey = PREFIX + key;
  const serialize = options?.serialize ?? defaultSerialize;
  const deserialize = options?.deserialize ?? (defaultDeserialize as (raw: string) => T);
  const validate = options?.validate;

  const [value, setValue] = useState<T>(() =>
    readStored(fullKey, defaultValue, deserialize, validate),
  );

  // Keep refs for stable callback
  const serializeRef = useRef(serialize);
  const deserializeRef = useRef(deserialize);
  const validateRef = useRef(validate);
  useEffect(() => {
    serializeRef.current = serialize;
    deserializeRef.current = deserialize;
    validateRef.current = validate;
  });

  const set = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof updater === 'function'
          ? (updater as (prev: T) => T)(prev)
          : updater;
        try {
          localStorage.setItem(fullKey, serializeRef.current(next));
        } catch {
          // localStorage full or unavailable — state still updates
        }
        return next;
      });
    },
    [fullKey],
  );

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== fullKey || e.storageArea !== localStorage) {return;}
      if (e.newValue === null) {
        setValue(defaultValue);
        return;
      }
      try {
        const parsed = deserializeRef.current(e.newValue);
        if (validateRef.current && !validateRef.current(parsed)) {return;}
        setValue(parsed);
      } catch {
        // ignore bad data from other tabs
      }
    };
    window.addEventListener('storage', handler);
    return () => { window.removeEventListener('storage', handler); };
  }, [fullKey, defaultValue]);

  return [value, set];
}
