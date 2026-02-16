interface BucketData { bucket: number; sessions: number; tokensK: number }

export function useMetricsValidation(data: BucketData[]): string[] {
  const warnings: string[] = [];

  // All zeros = possible collection outage
  if (data.length > 0 && data.every(d => d.sessions === 0 && d.tokensK === 0)) {
    warnings.push('All data is zero — collection may be interrupted');
  }

  return warnings;
}
