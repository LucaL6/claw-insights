/** Narrow snapshot passed from sessions query into the drawer header. */
export type LiveSessionSnapshot = Pick<
  SessionData,
  'key' | 'displayName' | 'totalTokens' | 'contextTokens' | 'usagePercent' | 'status'
>;

export interface SessionData {
  key: string;
  displayName: string;
  kind: string;
  model: string;
  channel?: string | null;
  totalTokens: number;
  contextTokens: number;
  usagePercent: number;
  status: string;
  updatedAt: number;
  turnCount?: number;
  subAgents: SessionData[];
  [key: string]: unknown;
}
