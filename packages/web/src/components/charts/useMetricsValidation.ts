interface HourlyData { hour: number; sessions: number; tokensK: number }

export function useMetricsValidation(data: HourlyData[]): string[] {
  const warnings: string[] = [];
  const currentHour = new Date().getHours();

  // All zeros = possible collection outage
  if (data.length > 0 && data.every(d => d.sessions === 0 && d.tokensK === 0)) {
    warnings.push('All data is zero — collection may be interrupted');
  }

  // Future hours with data = timezone issue
  const futureWithData = data.filter(d => d.hour > currentHour && d.sessions > 0);
  if (futureWithData.length > 0) {
    warnings.push('Data found in future hours — possible timezone mismatch');
  }

  return warnings;
}
