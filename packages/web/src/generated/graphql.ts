/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

/** Channel connectivity */
export type Channel = {
  connected: Scalars['Boolean']['output'];
  latencyMs?: Maybe<Scalars['Int']['output']>;
  name: Scalars['String']['output'];
  provider: ChannelProvider;
};

export type ChannelProvider =
  | 'discord'
  | 'signal'
  | 'slack'
  | 'telegram'
  | 'webchat'
  | 'whatsapp';

export type CronJob = {
  enabled: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  lastRunAt?: Maybe<Scalars['String']['output']>;
  lastRunSuccess?: Maybe<Scalars['Boolean']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  nextRunAt?: Maybe<Scalars['String']['output']>;
  schedule: Scalars['String']['output'];
};

/** Lightweight signal emitted when a data source updates */
export type DataChangeSignal = {
  source: Scalars['String']['output'];
  ts: Scalars['String']['output'];
};

export type EventCounts = {
  error: Scalars['Int']['output'];
  restart: Scalars['Int']['output'];
  warning: Scalars['Int']['output'];
};

export type EventDensityBucket = {
  count: Scalars['Int']['output'];
  epochStart: Scalars['Int']['output'];
  errorCount: Scalars['Int']['output'];
  hasError: Scalars['Boolean']['output'];
  hasRestart: Scalars['Boolean']['output'];
  hasWarning: Scalars['Boolean']['output'];
  hour: Scalars['Int']['output'];
  restartCount: Scalars['Int']['output'];
  warningCount: Scalars['Int']['output'];
};

export type EventEntry = {
  message: Scalars['String']['output'];
  module: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type EventsResult = {
  counts: EventCounts;
  events: Array<EventEntry>;
  total: Scalars['Int']['output'];
};

/** Gateway process status */
export type GatewayStatus = {
  appVersion: Scalars['String']['output'];
  connectLatencyMs?: Maybe<Scalars['Int']['output']>;
  latestVersion?: Maybe<Scalars['String']['output']>;
  pid?: Maybe<Scalars['Int']['output']>;
  running: Scalars['Boolean']['output'];
  securityCritical: Scalars['Int']['output'];
  securityWarn: Scalars['Int']['output'];
  startedAt?: Maybe<Scalars['String']['output']>;
  updateAvailable?: Maybe<Scalars['String']['output']>;
  uptime: Scalars['String']['output'];
  version: Scalars['String']['output'];
};

/**
 * Lifetime aggregate statistics from transcript history.
 * Token values are cumulative API consumption (not context window size).
 * Uses Float to avoid GraphQL Int32 overflow — values are integer counts.
 */
export type LifetimeStats = {
  /** ISO timestamp — min of device.json createdAtMs and earliest transcript timestamp */
  createdAt: Scalars['String']['output'];
  daysSinceCreation: Scalars['Int']['output'];
  /** Whether the initial scan has completed. If false, numeric fields may be zero/partial. */
  isReady: Scalars['Boolean']['output'];
  totalAssistantMessages: Scalars['Int']['output'];
  totalCacheReadTokens: Scalars['Float']['output'];
  totalCacheWriteTokens: Scalars['Float']['output'];
  totalInputTokens: Scalars['Float']['output'];
  totalOutputTokens: Scalars['Float']['output'];
  /** Count of transcript .jsonl files currently on disk (reflects deletions) */
  totalSessions: Scalars['Int']['output'];
  /** Sum of input + output + cacheRead + cacheWrite */
  totalTokens: Scalars['Float']['output'];
  totalUserMessages: Scalars['Int']['output'];
};

export type LogBatch = {
  counts: LogCounts;
  entries: Array<LogEntry>;
};

export type LogCounts = {
  debug: Scalars['Int']['output'];
  error: Scalars['Int']['output'];
  info: Scalars['Int']['output'];
  warn: Scalars['Int']['output'];
};

export type LogEntry = {
  level: LogLevel;
  message: Scalars['String']['output'];
  module: Scalars['String']['output'];
  time: Scalars['String']['output'];
};

export type LogFilter = {
  level?: InputMaybe<LogLevel>;
  module?: InputMaybe<Scalars['String']['input']>;
};

export type LogLevel =
  | 'DEBUG'
  | 'ERROR'
  | 'INFO'
  | 'WARN';

export type MetricsBucket = {
  apiCalls: Scalars['Int']['output'];
  assistantTurns: Scalars['Int']['output'];
  bucket: Scalars['Int']['output'];
  epochStart: Scalars['Int']['output'];
  errors: Scalars['Int']['output'];
  gatewayUp: Scalars['Boolean']['output'];
  label: Scalars['String']['output'];
  restartEvent: Scalars['Boolean']['output'];
  sessions: Scalars['Int']['output'];
  tokensByModel: Array<ModelTokens>;
  tokensK: Scalars['Float']['output'];
  toolCalls: Scalars['Int']['output'];
  turns: Scalars['Int']['output'];
  userTurns: Scalars['Int']['output'];
  warnings: Scalars['Int']['output'];
};

export type MetricsRange =
  | 'ONE_HOUR'
  | 'SIX_HOUR'
  | 'THIRTY_MIN'
  | 'TWELVE_HOUR'
  | 'TWENTY_FOUR_HOUR';

export type MetricsSummary = {
  bucketMinutes: Scalars['Int']['output'];
  buckets: Array<MetricsBucket>;
  date: Scalars['String']['output'];
  range: MetricsRange;
  rangeTokensK: Scalars['Float']['output'];
  timezone: Scalars['String']['output'];
  totalErrors: Scalars['Int']['output'];
  totalTokensK: Scalars['Float']['output'];
  totalTurns: Scalars['Int']['output'];
  totalWarnings: Scalars['Int']['output'];
  uptimePercent: Scalars['Float']['output'];
  warnings: Array<Scalars['String']['output']>;
};

export type ModelTokens = {
  model: Scalars['String']['output'];
  tokensK: Scalars['Float']['output'];
};

export type Query = {
  channels: Array<Channel>;
  cronJobs: Array<CronJob>;
  eventCounts: EventCounts;
  eventDensity: Array<EventDensityBucket>;
  events: EventsResult;
  gateway: GatewayStatus;
  lifetimeStats: LifetimeStats;
  metrics: MetricsSummary;
  recentLogs: Array<LogEntry>;
  resources: SystemResources;
  sessions: Array<Session>;
  usageCost: UsageCost;
};


export type QueryEventCountsArgs = {
  from?: InputMaybe<Scalars['Int']['input']>;
  to?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryEventsArgs = {
  from?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  to?: InputMaybe<Scalars['Int']['input']>;
  types?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type QueryMetricsArgs = {
  date?: InputMaybe<Scalars['String']['input']>;
  range?: InputMaybe<MetricsRange>;
};


export type QueryRecentLogsArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySessionsArgs = {
  filter?: InputMaybe<SessionFilter>;
};

export type Session = {
  channel?: Maybe<Scalars['String']['output']>;
  contextTokens: Scalars['Int']['output'];
  displayName: Scalars['String']['output'];
  key: Scalars['String']['output'];
  kind: Scalars['String']['output'];
  model: Scalars['String']['output'];
  status: SessionStatus;
  subAgents: Array<Session>;
  totalTokens: Scalars['Int']['output'];
  turnCount: Scalars['Int']['output'];
  updatedAt: Scalars['Float']['output'];
  usagePercent: Scalars['Float']['output'];
};

export type SessionFilter = {
  activeOnly?: InputMaybe<Scalars['Boolean']['input']>;
  grouped?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<SessionSortBy>;
};

export type SessionSortBy =
  | 'NAME'
  | 'TOKENS_DESC'
  | 'UPDATED_AT';

export type SessionStatus =
  | 'ACTIVE'
  | 'DONE'
  | 'FAILED'
  | 'IDLE';

export type Subscription = {
  /** Lightweight signal — client should refetch the relevant query */
  dataChanged: DataChangeSignal;
  logs: LogBatch;
};


export type SubscriptionLogsArgs = {
  filter?: InputMaybe<LogFilter>;
};

/** System resource usage */
export type SystemResources = {
  cpu: Scalars['Float']['output'];
  diskMB: Scalars['Int']['output'];
  memoryMB: Scalars['Int']['output'];
  sampledAt: Scalars['String']['output'];
};

/** Usage cost summary from gateway */
export type UsageCost = {
  fetchedAt: Scalars['String']['output'];
  todayCost: Scalars['Float']['output'];
  todayTokensM: Scalars['Float']['output'];
  totalCost: Scalars['Float']['output'];
  totalTokensM: Scalars['Float']['output'];
};

export type EventsQueryVariables = Exact<{
  from?: InputMaybe<Scalars['Int']['input']>;
  to?: InputMaybe<Scalars['Int']['input']>;
  types?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type EventsQuery = { events: { total: number, events: Array<{ timestamp: string, type: string, module: string, message: string }>, counts: { error: number, warning: number, restart: number } } };

export type EventDensityQueryVariables = Exact<{ [key: string]: never; }>;


export type EventDensityQuery = { eventDensity: Array<{ hour: number, count: number, hasError: boolean, hasWarning: boolean, hasRestart: boolean, errorCount: number, warningCount: number, restartCount: number, epochStart: number }> };

export type EventCountsQueryVariables = Exact<{
  from?: InputMaybe<Scalars['Int']['input']>;
  to?: InputMaybe<Scalars['Int']['input']>;
}>;


export type EventCountsQuery = { eventCounts: { error: number, warning: number, restart: number } };

export type GatewayQueryVariables = Exact<{ [key: string]: never; }>;


export type GatewayQuery = { gateway: { running: boolean, pid?: number | null, version: string, appVersion: string, updateAvailable?: string | null, uptime: string, startedAt?: string | null, connectLatencyMs?: number | null, latestVersion?: string | null, securityCritical: number, securityWarn: number } };

export type ResourcesQueryVariables = Exact<{ [key: string]: never; }>;


export type ResourcesQuery = { resources: { cpu: number, memoryMB: number, diskMB: number, sampledAt: string } };

export type ChannelsQueryVariables = Exact<{ [key: string]: never; }>;


export type ChannelsQuery = { channels: Array<{ provider: ChannelProvider, name: string, connected: boolean, latencyMs?: number | null }> };

export type SessionsQueryVariables = Exact<{
  filter?: InputMaybe<SessionFilter>;
}>;


export type SessionsQuery = { sessions: Array<{ key: string, displayName: string, kind: string, model: string, channel?: string | null, totalTokens: number, contextTokens: number, usagePercent: number, status: SessionStatus, updatedAt: number, subAgents: Array<{ key: string, displayName: string, kind: string, model: string, channel?: string | null, totalTokens: number, contextTokens: number, usagePercent: number, status: SessionStatus, updatedAt: number }> }> };

export type MetricsQueryVariables = Exact<{
  date?: InputMaybe<Scalars['String']['input']>;
  range?: InputMaybe<MetricsRange>;
}>;


export type MetricsQuery = { metrics: { date: string, range: MetricsRange, bucketMinutes: number, timezone: string, totalTokensK: number, rangeTokensK: number, totalTurns: number, totalErrors: number, totalWarnings: number, uptimePercent: number, warnings: Array<string>, buckets: Array<{ bucket: number, label: string, epochStart: number, sessions: number, tokensK: number, apiCalls: number, toolCalls: number, turns: number, userTurns: number, assistantTurns: number, errors: number, warnings: number, gatewayUp: boolean, restartEvent: boolean, tokensByModel: Array<{ model: string, tokensK: number }> }> } };

export type UsageCostQueryVariables = Exact<{ [key: string]: never; }>;


export type UsageCostQuery = { usageCost: { totalCost: number, totalTokensM: number, todayCost: number, todayTokensM: number, fetchedAt: string } };

export type CronJobsQueryVariables = Exact<{ [key: string]: never; }>;


export type CronJobsQuery = { cronJobs: Array<{ id: string, name?: string | null, enabled: boolean, schedule: string, lastRunAt?: string | null, lastRunSuccess?: boolean | null, nextRunAt?: string | null }> };

export type RecentLogsQueryVariables = Exact<{
  count?: InputMaybe<Scalars['Int']['input']>;
}>;


export type RecentLogsQuery = { recentLogs: Array<{ time: string, level: LogLevel, module: string, message: string }> };

export type LifetimeStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type LifetimeStatsQuery = { lifetimeStats: { isReady: boolean, createdAt: string, daysSinceCreation: number, totalSessions: number, totalInputTokens: number, totalOutputTokens: number, totalCacheReadTokens: number, totalCacheWriteTokens: number, totalTokens: number, totalUserMessages: number, totalAssistantMessages: number } };

export type DataChangedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type DataChangedSubscription = { dataChanged: { source: string, ts: string } };

export type LogsSubscriptionVariables = Exact<{
  filter?: InputMaybe<LogFilter>;
}>;


export type LogsSubscription = { logs: { entries: Array<{ time: string, level: LogLevel, module: string, message: string }>, counts: { debug: number, info: number, warn: number, error: number } } };


export const EventsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Events"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"types"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"events"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"types"},"value":{"kind":"Variable","name":{"kind":"Name","value":"types"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"events"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"module"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"counts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"warning"}},{"kind":"Field","name":{"kind":"Name","value":"restart"}}]}}]}}]}}]} as unknown as DocumentNode<EventsQuery, EventsQueryVariables>;
export const EventDensityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EventDensity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventDensity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hour"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"hasError"}},{"kind":"Field","name":{"kind":"Name","value":"hasWarning"}},{"kind":"Field","name":{"kind":"Name","value":"hasRestart"}},{"kind":"Field","name":{"kind":"Name","value":"errorCount"}},{"kind":"Field","name":{"kind":"Name","value":"warningCount"}},{"kind":"Field","name":{"kind":"Name","value":"restartCount"}},{"kind":"Field","name":{"kind":"Name","value":"epochStart"}}]}}]}}]} as unknown as DocumentNode<EventDensityQuery, EventDensityQueryVariables>;
export const EventCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EventCounts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"eventCounts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"error"}},{"kind":"Field","name":{"kind":"Name","value":"warning"}},{"kind":"Field","name":{"kind":"Name","value":"restart"}}]}}]}}]} as unknown as DocumentNode<EventCountsQuery, EventCountsQueryVariables>;
export const GatewayDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Gateway"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gateway"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"running"}},{"kind":"Field","name":{"kind":"Name","value":"pid"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"appVersion"}},{"kind":"Field","name":{"kind":"Name","value":"updateAvailable"}},{"kind":"Field","name":{"kind":"Name","value":"uptime"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"connectLatencyMs"}},{"kind":"Field","name":{"kind":"Name","value":"latestVersion"}},{"kind":"Field","name":{"kind":"Name","value":"securityCritical"}},{"kind":"Field","name":{"kind":"Name","value":"securityWarn"}}]}}]}}]} as unknown as DocumentNode<GatewayQuery, GatewayQueryVariables>;
export const ResourcesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Resources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cpu"}},{"kind":"Field","name":{"kind":"Name","value":"memoryMB"}},{"kind":"Field","name":{"kind":"Name","value":"diskMB"}},{"kind":"Field","name":{"kind":"Name","value":"sampledAt"}}]}}]}}]} as unknown as DocumentNode<ResourcesQuery, ResourcesQueryVariables>;
export const ChannelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Channels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"channels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"provider"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"connected"}},{"kind":"Field","name":{"kind":"Name","value":"latencyMs"}}]}}]}}]} as unknown as DocumentNode<ChannelsQuery, ChannelsQueryVariables>;
export const SessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Sessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"SessionFilter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"contextTokens"}},{"kind":"Field","name":{"kind":"Name","value":"usagePercent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"subAgents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"contextTokens"}},{"kind":"Field","name":{"kind":"Name","value":"usagePercent"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<SessionsQuery, SessionsQueryVariables>;
export const MetricsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Metrics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"date"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"range"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"MetricsRange"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metrics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"date"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}},{"kind":"Argument","name":{"kind":"Name","value":"range"},"value":{"kind":"Variable","name":{"kind":"Name","value":"range"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"range"}},{"kind":"Field","name":{"kind":"Name","value":"bucketMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"buckets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bucket"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"epochStart"}},{"kind":"Field","name":{"kind":"Name","value":"sessions"}},{"kind":"Field","name":{"kind":"Name","value":"tokensK"}},{"kind":"Field","name":{"kind":"Name","value":"tokensByModel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"model"}},{"kind":"Field","name":{"kind":"Name","value":"tokensK"}}]}},{"kind":"Field","name":{"kind":"Name","value":"apiCalls"}},{"kind":"Field","name":{"kind":"Name","value":"toolCalls"}},{"kind":"Field","name":{"kind":"Name","value":"turns"}},{"kind":"Field","name":{"kind":"Name","value":"userTurns"}},{"kind":"Field","name":{"kind":"Name","value":"assistantTurns"}},{"kind":"Field","name":{"kind":"Name","value":"errors"}},{"kind":"Field","name":{"kind":"Name","value":"warnings"}},{"kind":"Field","name":{"kind":"Name","value":"gatewayUp"}},{"kind":"Field","name":{"kind":"Name","value":"restartEvent"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalTokensK"}},{"kind":"Field","name":{"kind":"Name","value":"rangeTokensK"}},{"kind":"Field","name":{"kind":"Name","value":"totalTurns"}},{"kind":"Field","name":{"kind":"Name","value":"totalErrors"}},{"kind":"Field","name":{"kind":"Name","value":"totalWarnings"}},{"kind":"Field","name":{"kind":"Name","value":"uptimePercent"}},{"kind":"Field","name":{"kind":"Name","value":"warnings"}}]}}]}}]} as unknown as DocumentNode<MetricsQuery, MetricsQueryVariables>;
export const UsageCostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UsageCost"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"usageCost"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokensM"}},{"kind":"Field","name":{"kind":"Name","value":"todayCost"}},{"kind":"Field","name":{"kind":"Name","value":"todayTokensM"}},{"kind":"Field","name":{"kind":"Name","value":"fetchedAt"}}]}}]}}]} as unknown as DocumentNode<UsageCostQuery, UsageCostQueryVariables>;
export const CronJobsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CronJobs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cronJobs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}},{"kind":"Field","name":{"kind":"Name","value":"schedule"}},{"kind":"Field","name":{"kind":"Name","value":"lastRunAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastRunSuccess"}},{"kind":"Field","name":{"kind":"Name","value":"nextRunAt"}}]}}]}}]} as unknown as DocumentNode<CronJobsQuery, CronJobsQueryVariables>;
export const RecentLogsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RecentLogs"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"count"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recentLogs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"count"},"value":{"kind":"Variable","name":{"kind":"Name","value":"count"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"module"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<RecentLogsQuery, RecentLogsQueryVariables>;
export const LifetimeStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LifetimeStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lifetimeStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isReady"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"daysSinceCreation"}},{"kind":"Field","name":{"kind":"Name","value":"totalSessions"}},{"kind":"Field","name":{"kind":"Name","value":"totalInputTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalOutputTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalCacheReadTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalCacheWriteTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalUserMessages"}},{"kind":"Field","name":{"kind":"Name","value":"totalAssistantMessages"}}]}}]}}]} as unknown as DocumentNode<LifetimeStatsQuery, LifetimeStatsQueryVariables>;
export const DataChangedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"DataChanged"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dataChanged"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"ts"}}]}}]}}]} as unknown as DocumentNode<DataChangedSubscription, DataChangedSubscriptionVariables>;
export const LogsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"Logs"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"LogFilter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logs"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"entries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"module"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}},{"kind":"Field","name":{"kind":"Name","value":"counts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"debug"}},{"kind":"Field","name":{"kind":"Name","value":"info"}},{"kind":"Field","name":{"kind":"Name","value":"warn"}},{"kind":"Field","name":{"kind":"Name","value":"error"}}]}}]}}]}}]} as unknown as DocumentNode<LogsSubscription, LogsSubscriptionVariables>;