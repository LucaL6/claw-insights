export interface SessionData {
  key: string;
  displayName: string;
  kind: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  contextTokens: number;
  usagePercent: number;
  status: string;
  updatedAt: number;
  subAgents: SessionData[];
}
