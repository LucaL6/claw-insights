const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HUNDRED = 100;
const MINUTE_MS = 60_000;

function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

export function minuteBucket(timestampMs: number): number {
  return Math.floor(timestampMs / MINUTE_MS);
}

export function deterministicSampleDecision(input: {
  module: string;
  msgTemplate: string;
  sampleRate: number;
  timestampMs?: number;
}): boolean {
  const rate = Math.max(0, Math.min(1, input.sampleRate));
  if (rate <= 0) {
    return false;
  }
  if (rate >= 1) {
    return true;
  }

  const bucket = minuteBucket(input.timestampMs ?? Date.now());
  const key = `${input.module}|${input.msgTemplate}|${bucket}`;
  const score = fnv1a32(key) % HUNDRED;

  return score < rate * HUNDRED;
}
