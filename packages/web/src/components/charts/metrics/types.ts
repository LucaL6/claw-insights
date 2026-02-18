export interface PreviewState {
  source: 'errors' | 'uptime';
  bucketIndex: number;
  fromTs: number;
  toTs: number;
  types: string[];
}

export interface PreviewEvents {
  events: Array<{ timestamp: string; type: string; module: string; message: string }>;
  total: number;
}
