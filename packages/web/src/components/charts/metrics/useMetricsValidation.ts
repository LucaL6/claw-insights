interface BucketData {
  bucket: number;
  sessions: number;
  tokensK: number;
}

export interface ValidationMessage {
  text: string;
  level: 'info' | 'warn';
}

export function useMetricsValidation(data: BucketData[], uptimePct?: number): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  if (data.length > 0 && data.every((d) => d.sessions === 0 && d.tokensK === 0)) {
    if (uptimePct !== undefined && uptimePct === 0) {
      messages.push({ text: 'Gateway was offline — no data collected', level: 'warn' });
    } else {
      messages.push({ text: 'No activity in this time window', level: 'info' });
    }
  }

  return messages;
}
