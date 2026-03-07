import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { AppContext } from '../../context.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  JSON: { input: unknown; output: unknown };
};

/** Agent data namespace */
export type AgentNamespace = HasSourceInfo & {
  cronJobs: Array<CronJob>;
  eventCounts: EventCounts;
  eventDensity: Array<EventDensityBucket>;
  events: EventsResult;
  /**
   * Temporary compatibility alias. Prefer system(context) { ... on OpenClawSystem { gateway } }.
   * @deprecated Use system(context) { ... on OpenClawSystem { gateway } }
   */
  gateway: GatewayStatus;
  info: DataSource;
  lifetimeStats: LifetimeStats;
  metrics: MetricsSummary;
  recentLogs: Array<LogEntry>;
  session?: Maybe<Session>;
  /** Fetch session transcript. Returns null if session/file not found. */
  sessionTranscript?: Maybe<SessionTranscript>;
  sessions: Array<Session>;
  usageCost: UsageCost;
};

/** Agent data namespace */
export type AgentNamespaceEventCountsArgs = {
  from?: InputMaybe<Scalars['Int']['input']>;
  to?: InputMaybe<Scalars['Int']['input']>;
};

/** Agent data namespace */
export type AgentNamespaceEventsArgs = {
  from?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  to?: InputMaybe<Scalars['Int']['input']>;
  types?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** Agent data namespace */
export type AgentNamespaceMetricsArgs = {
  date?: InputMaybe<Scalars['String']['input']>;
  range?: InputMaybe<MetricsRange>;
};

/** Agent data namespace */
export type AgentNamespaceRecentLogsArgs = {
  count?: InputMaybe<Scalars['Int']['input']>;
};

/** Agent data namespace */
export type AgentNamespaceSessionArgs = {
  key: Scalars['String']['input'];
};

/** Agent data namespace */
export type AgentNamespaceSessionTranscriptArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  sessionKey: Scalars['String']['input'];
};

/** Agent data namespace */
export type AgentNamespaceSessionsArgs = {
  filter?: InputMaybe<SessionFilter>;
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
  | 'googlechat'
  | 'imessage'
  | 'irc'
  | 'signal'
  | 'slack'
  | 'telegram'
  | 'webchat'
  | 'whatsapp';

export type CheckStatus = 'FAIL' | 'PASS' | 'WARN';

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

export type DataSource = {
  attributes: SourceAttributes;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  status: SourceStatus;
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

export type FilterDefaults = {
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timeRange?: InputMaybe<TimeRangeInput>;
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

export type HasSourceInfo = {
  info: DataSource;
};

export type HasSystemInfo = {
  health: HealthStatus;
};

export type HealthCheck = {
  message?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  status: CheckStatus;
};

export type HealthLevel = 'DEGRADED' | 'HEALTHY' | 'UNHEALTHY';

export type HealthStatus = {
  checks: Array<HealthCheck>;
  status: HealthLevel;
};

/** Legacy context wrapper – kept for backward compatibility with Query.context */
export type LegacyContextNamespace = {
  source: AgentNamespace;
  system: OpenClawSystem;
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

export type LogLevel = 'DEBUG' | 'ERROR' | 'INFO' | 'WARN';

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

export type MetricsRange = 'ONE_HOUR' | 'SIX_HOUR' | 'THIRTY_MIN' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

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

/** System-level namespace */
export type OpenClawSystem = HasSystemInfo & {
  channels: Array<Channel>;
  gateway: GatewayStatus;
  health: HealthStatus;
  resources: SystemResources;
};

export type PageInfo = {
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type PreferencesInput = {
  locale?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
  /** @deprecated Use system(context) { ... on OpenClawSystem { channels } } */
  channels: Array<Channel>;
  /**
   * Legacy context wrapper – backward compat, temporary
   * @deprecated Use system(context) / source(selector, context)
   */
  context: LegacyContextNamespace;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { cronJobs } } */
  cronJobs: Array<CronJob>;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { eventCounts } } */
  eventCounts: EventCounts;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { eventDensity } } */
  eventDensity: Array<EventDensityBucket>;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { events } } */
  events: EventsResult;
  /** @deprecated Use system(context) { ... on OpenClawSystem { gateway } } */
  gateway: GatewayStatus;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { lifetimeStats } } */
  lifetimeStats: LifetimeStats;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { metrics } } */
  metrics: MetricsSummary;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { recentLogs } } */
  recentLogs: Array<LogEntry>;
  /** @deprecated Use system(context) { ... on OpenClawSystem { resources } } */
  resources: SystemResources;
  /**
   * Fetch session transcript. Returns null if session/file not found.
   * @deprecated Use source(selector, context) { ... on AgentNamespace { sessionTranscript } }
   */
  sessionTranscript?: Maybe<SessionTranscript>;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { sessions } } */
  sessions: Array<Session>;
  /** Resolve one source by selector */
  source?: Maybe<SourceNamespace>;
  /** Registered data sources */
  sources: Array<DataSource>;
  /** claw-insights system state */
  system: SystemNamespace;
  /** @deprecated Use source(selector, context) { ... on AgentNamespace { usageCost } } */
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

export type QuerySessionTranscriptArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  sessionKey: Scalars['String']['input'];
};

export type QuerySessionsArgs = {
  filter?: InputMaybe<SessionFilter>;
};

export type QuerySourceArgs = {
  context?: InputMaybe<QueryContext>;
  selector: SourceSelector;
};

export type QuerySourcesArgs = {
  context?: InputMaybe<QueryContext>;
  filter?: InputMaybe<SourceFilter>;
};

export type QuerySystemArgs = {
  context?: InputMaybe<QueryContext>;
};

export type QueryContext = {
  /** Global default filters (field args override) */
  defaults?: InputMaybe<FilterDefaults>;
  /** App-specific escape hatch */
  extensions?: InputMaybe<Scalars['JSON']['input']>;
  /** Display preferences */
  preferences?: InputMaybe<PreferencesInput>;
  /** Request tracing metadata */
  trace?: InputMaybe<TraceInput>;
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

export type SessionSortBy = 'NAME' | 'TOKENS_DESC' | 'UPDATED_AT';

export type SessionStatus = 'ACTIVE' | 'DONE' | 'FAILED' | 'IDLE';

export type SessionTranscript = {
  /** Channel provider */
  channel?: Maybe<Scalars['String']['output']>;
  /** Input tokens of the last assistant message (approx context window usage) */
  contextTokens: Scalars['Int']['output'];
  /** Session display name */
  displayName: Scalars['String']['output'];
  /** Session duration in milliseconds */
  durationMs: Scalars['Int']['output'];
  /** File size in bytes */
  fileSize: Scalars['Int']['output'];
  /** Whether this is a sub-agent session */
  isSubAgent: Scalars['Boolean']['output'];
  /** Session kind: direct / group / cron */
  kind: Scalars['String']['output'];
  /** Structured messages */
  messages: Array<TranscriptMessage>;
  /** Model at session start */
  model: Scalars['String']['output'];
  pageInfo: PageInfo;
  /** Parent session display name (sub-agent only) */
  parentDisplayName?: Maybe<Scalars['String']['output']>;
  /** Session key */
  sessionKey: Scalars['String']['output'];
  /** First user message content (sub-agent spawn prompt) */
  spawnPrompt?: Maybe<Scalars['String']['output']>;
  /** Session start ISO timestamp */
  startedAt: Scalars['String']['output'];
  /** Thinking level at session start */
  thinkingLevel?: Maybe<Scalars['String']['output']>;
  /** Total message count in transcript file */
  totalMessages: Scalars['Int']['output'];
  /** Total tokens consumed (input + output + cache read) */
  totalTokens: Scalars['Int']['output'];
};

export type SourceAttributes = {
  category: SourceCategory;
  provider?: Maybe<Scalars['String']['output']>;
  tags: Array<Scalars['String']['output']>;
};

export type SourceCategory = 'AGENT' | 'CALENDAR' | 'DASHBOARD' | 'INTEGRATION' | 'KANBAN';

export type SourceFilter = {
  category?: InputMaybe<SourceCategory>;
  provider?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<SourceStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type SourceNamespace = AgentNamespace;

export type SourceSelector = {
  category?: InputMaybe<SourceCategory>;
  id?: InputMaybe<Scalars['String']['input']>;
  provider?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type SourceStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'INITIALIZING';

export type Subscription = {
  /** Lightweight signal — client should refetch the relevant query */
  dataChanged: DataChangeSignal;
  logs: LogBatch;
};

export type SubscriptionLogsArgs = {
  filter?: InputMaybe<LogFilter>;
};

export type SystemNamespace = OpenClawSystem;

/** System resource usage */
export type SystemResources = {
  cpu: Scalars['Float']['output'];
  diskMB: Scalars['Int']['output'];
  memoryMB: Scalars['Int']['output'];
  sampledAt: Scalars['String']['output'];
};

export type TimePreset = 'ONE_HOUR' | 'SIX_HOUR' | 'THIRTY_MIN' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

export type TimeRangeInput = {
  from?: InputMaybe<Scalars['Int']['input']>;
  preset?: InputMaybe<TimePreset>;
  to?: InputMaybe<Scalars['Int']['input']>;
};

export type TraceInput = {
  requestId?: InputMaybe<Scalars['String']['input']>;
  traceId?: InputMaybe<Scalars['String']['input']>;
};

export type TranscriptMessage = {
  /** Message text content (truncated if over limit) */
  content: Scalars['String']['output'];
  /** Content was truncated from original */
  contentTruncated: Scalars['Boolean']['output'];
  /** Assistant message model id */
  model?: Maybe<Scalars['String']['output']>;
  /** user | assistant | tool */
  role: Scalars['String']['output'];
  /** ISO timestamp */
  timestamp: Scalars['String']['output'];
  /** Tool name, e.g. Read, exec, Edit (tool only) */
  toolName?: Maybe<Scalars['String']['output']>;
  /** Token usage breakdown (assistant only) */
  usage?: Maybe<TranscriptTokenUsage>;
};

export type TranscriptTokenUsage = {
  cacheRead: Scalars['Int']['output'];
  cacheWrite: Scalars['Int']['output'];
  input: Scalars['Int']['output'];
  output: Scalars['Int']['output'];
};

/** Usage cost summary from gateway */
export type UsageCost = {
  fetchedAt: Scalars['String']['output'];
  todayCost: Scalars['Float']['output'];
  todayTokensM: Scalars['Float']['output'];
  totalCost: Scalars['Float']['output'];
  totalTokensM: Scalars['Float']['output'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<
  TResult,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo,
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = Record<PropertyKey, never>,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/** Mapping of union types */
export type ResolversUnionTypes<_RefType extends Record<string, unknown>> = ResolversObject<{
  SourceNamespace: AgentNamespace;
  SystemNamespace: OpenClawSystem;
}>;

/** Mapping of interface types */
export type ResolversInterfaceTypes<_RefType extends Record<string, unknown>> = ResolversObject<{
  HasSourceInfo: AgentNamespace;
  HasSystemInfo: OpenClawSystem;
}>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AgentNamespace: ResolverTypeWrapper<AgentNamespace>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Channel: ResolverTypeWrapper<Channel>;
  ChannelProvider: ChannelProvider;
  CheckStatus: CheckStatus;
  CronJob: ResolverTypeWrapper<CronJob>;
  DataChangeSignal: ResolverTypeWrapper<DataChangeSignal>;
  DataSource: ResolverTypeWrapper<DataSource>;
  EventCounts: ResolverTypeWrapper<EventCounts>;
  EventDensityBucket: ResolverTypeWrapper<EventDensityBucket>;
  EventEntry: ResolverTypeWrapper<EventEntry>;
  EventsResult: ResolverTypeWrapper<EventsResult>;
  FilterDefaults: FilterDefaults;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GatewayStatus: ResolverTypeWrapper<GatewayStatus>;
  HasSourceInfo: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['HasSourceInfo']>;
  HasSystemInfo: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['HasSystemInfo']>;
  HealthCheck: ResolverTypeWrapper<HealthCheck>;
  HealthLevel: HealthLevel;
  HealthStatus: ResolverTypeWrapper<HealthStatus>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  LegacyContextNamespace: ResolverTypeWrapper<LegacyContextNamespace>;
  LifetimeStats: ResolverTypeWrapper<LifetimeStats>;
  LogBatch: ResolverTypeWrapper<LogBatch>;
  LogCounts: ResolverTypeWrapper<LogCounts>;
  LogEntry: ResolverTypeWrapper<LogEntry>;
  LogFilter: LogFilter;
  LogLevel: LogLevel;
  MetricsBucket: ResolverTypeWrapper<MetricsBucket>;
  MetricsRange: MetricsRange;
  MetricsSummary: ResolverTypeWrapper<MetricsSummary>;
  ModelTokens: ResolverTypeWrapper<ModelTokens>;
  OpenClawSystem: ResolverTypeWrapper<OpenClawSystem>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  PreferencesInput: PreferencesInput;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  QueryContext: QueryContext;
  Session: ResolverTypeWrapper<Session>;
  SessionFilter: SessionFilter;
  SessionSortBy: SessionSortBy;
  SessionStatus: SessionStatus;
  SessionTranscript: ResolverTypeWrapper<SessionTranscript>;
  SourceAttributes: ResolverTypeWrapper<SourceAttributes>;
  SourceCategory: SourceCategory;
  SourceFilter: SourceFilter;
  SourceNamespace: ResolverTypeWrapper<ResolversUnionTypes<ResolversTypes>['SourceNamespace']>;
  SourceSelector: SourceSelector;
  SourceStatus: SourceStatus;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SystemNamespace: ResolverTypeWrapper<ResolversUnionTypes<ResolversTypes>['SystemNamespace']>;
  SystemResources: ResolverTypeWrapper<SystemResources>;
  TimePreset: TimePreset;
  TimeRangeInput: TimeRangeInput;
  TraceInput: TraceInput;
  TranscriptMessage: ResolverTypeWrapper<TranscriptMessage>;
  TranscriptTokenUsage: ResolverTypeWrapper<TranscriptTokenUsage>;
  UsageCost: ResolverTypeWrapper<UsageCost>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AgentNamespace: AgentNamespace;
  Boolean: Scalars['Boolean']['output'];
  Channel: Channel;
  CronJob: CronJob;
  DataChangeSignal: DataChangeSignal;
  DataSource: DataSource;
  EventCounts: EventCounts;
  EventDensityBucket: EventDensityBucket;
  EventEntry: EventEntry;
  EventsResult: EventsResult;
  FilterDefaults: FilterDefaults;
  Float: Scalars['Float']['output'];
  GatewayStatus: GatewayStatus;
  HasSourceInfo: ResolversInterfaceTypes<ResolversParentTypes>['HasSourceInfo'];
  HasSystemInfo: ResolversInterfaceTypes<ResolversParentTypes>['HasSystemInfo'];
  HealthCheck: HealthCheck;
  HealthStatus: HealthStatus;
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  LegacyContextNamespace: LegacyContextNamespace;
  LifetimeStats: LifetimeStats;
  LogBatch: LogBatch;
  LogCounts: LogCounts;
  LogEntry: LogEntry;
  LogFilter: LogFilter;
  MetricsBucket: MetricsBucket;
  MetricsSummary: MetricsSummary;
  ModelTokens: ModelTokens;
  OpenClawSystem: OpenClawSystem;
  PageInfo: PageInfo;
  PreferencesInput: PreferencesInput;
  Query: Record<PropertyKey, never>;
  QueryContext: QueryContext;
  Session: Session;
  SessionFilter: SessionFilter;
  SessionTranscript: SessionTranscript;
  SourceAttributes: SourceAttributes;
  SourceFilter: SourceFilter;
  SourceNamespace: ResolversUnionTypes<ResolversParentTypes>['SourceNamespace'];
  SourceSelector: SourceSelector;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  SystemNamespace: ResolversUnionTypes<ResolversParentTypes>['SystemNamespace'];
  SystemResources: SystemResources;
  TimeRangeInput: TimeRangeInput;
  TraceInput: TraceInput;
  TranscriptMessage: TranscriptMessage;
  TranscriptTokenUsage: TranscriptTokenUsage;
  UsageCost: UsageCost;
}>;

export type AgentNamespaceResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['AgentNamespace'] = ResolversParentTypes['AgentNamespace'],
> = ResolversObject<{
  cronJobs?: Resolver<Array<ResolversTypes['CronJob']>, ParentType, ContextType>;
  eventCounts?: Resolver<
    ResolversTypes['EventCounts'],
    ParentType,
    ContextType,
    Partial<AgentNamespaceEventCountsArgs>
  >;
  eventDensity?: Resolver<Array<ResolversTypes['EventDensityBucket']>, ParentType, ContextType>;
  events?: Resolver<ResolversTypes['EventsResult'], ParentType, ContextType, Partial<AgentNamespaceEventsArgs>>;
  gateway?: Resolver<ResolversTypes['GatewayStatus'], ParentType, ContextType>;
  info?: Resolver<ResolversTypes['DataSource'], ParentType, ContextType>;
  lifetimeStats?: Resolver<ResolversTypes['LifetimeStats'], ParentType, ContextType>;
  metrics?: Resolver<ResolversTypes['MetricsSummary'], ParentType, ContextType, Partial<AgentNamespaceMetricsArgs>>;
  recentLogs?: Resolver<
    Array<ResolversTypes['LogEntry']>,
    ParentType,
    ContextType,
    Partial<AgentNamespaceRecentLogsArgs>
  >;
  session?: Resolver<
    Maybe<ResolversTypes['Session']>,
    ParentType,
    ContextType,
    RequireFields<AgentNamespaceSessionArgs, 'key'>
  >;
  sessionTranscript?: Resolver<
    Maybe<ResolversTypes['SessionTranscript']>,
    ParentType,
    ContextType,
    RequireFields<AgentNamespaceSessionTranscriptArgs, 'sessionKey'>
  >;
  sessions?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType, Partial<AgentNamespaceSessionsArgs>>;
  usageCost?: Resolver<ResolversTypes['UsageCost'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ChannelResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['Channel'] = ResolversParentTypes['Channel'],
> = ResolversObject<{
  connected?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  latencyMs?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  provider?: Resolver<ResolversTypes['ChannelProvider'], ParentType, ContextType>;
}>;

export type CronJobResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['CronJob'] = ResolversParentTypes['CronJob'],
> = ResolversObject<{
  enabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  lastRunAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lastRunSuccess?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nextRunAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  schedule?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type DataChangeSignalResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['DataChangeSignal'] = ResolversParentTypes['DataChangeSignal'],
> = ResolversObject<{
  source?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ts?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type DataSourceResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['DataSource'] = ResolversParentTypes['DataSource'],
> = ResolversObject<{
  attributes?: Resolver<ResolversTypes['SourceAttributes'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SourceStatus'], ParentType, ContextType>;
}>;

export type EventCountsResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['EventCounts'] = ResolversParentTypes['EventCounts'],
> = ResolversObject<{
  error?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  restart?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  warning?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type EventDensityBucketResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['EventDensityBucket'] = ResolversParentTypes['EventDensityBucket'],
> = ResolversObject<{
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  epochStart?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  errorCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hasError?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasRestart?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasWarning?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hour?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  restartCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  warningCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type EventEntryResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['EventEntry'] = ResolversParentTypes['EventEntry'],
> = ResolversObject<{
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  module?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type EventsResultResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['EventsResult'] = ResolversParentTypes['EventsResult'],
> = ResolversObject<{
  counts?: Resolver<ResolversTypes['EventCounts'], ParentType, ContextType>;
  events?: Resolver<Array<ResolversTypes['EventEntry']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type GatewayStatusResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['GatewayStatus'] = ResolversParentTypes['GatewayStatus'],
> = ResolversObject<{
  appVersion?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  connectLatencyMs?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  latestVersion?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  pid?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  running?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  securityCritical?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  securityWarn?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  startedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updateAvailable?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  uptime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  version?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type HasSourceInfoResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['HasSourceInfo'] = ResolversParentTypes['HasSourceInfo'],
> = ResolversObject<{
  __resolveType: TypeResolveFn<'AgentNamespace', ParentType, ContextType>;
}>;

export type HasSystemInfoResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['HasSystemInfo'] = ResolversParentTypes['HasSystemInfo'],
> = ResolversObject<{
  __resolveType: TypeResolveFn<'OpenClawSystem', ParentType, ContextType>;
}>;

export type HealthCheckResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['HealthCheck'] = ResolversParentTypes['HealthCheck'],
> = ResolversObject<{
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['CheckStatus'], ParentType, ContextType>;
}>;

export type HealthStatusResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['HealthStatus'] = ResolversParentTypes['HealthStatus'],
> = ResolversObject<{
  checks?: Resolver<Array<ResolversTypes['HealthCheck']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['HealthLevel'], ParentType, ContextType>;
}>;

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export type LegacyContextNamespaceResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['LegacyContextNamespace'] = ResolversParentTypes['LegacyContextNamespace'],
> = ResolversObject<{
  source?: Resolver<ResolversTypes['AgentNamespace'], ParentType, ContextType>;
  system?: Resolver<ResolversTypes['OpenClawSystem'], ParentType, ContextType>;
}>;

export type LifetimeStatsResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['LifetimeStats'] = ResolversParentTypes['LifetimeStats'],
> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  daysSinceCreation?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isReady?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  totalAssistantMessages?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalCacheReadTokens?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalCacheWriteTokens?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalInputTokens?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalOutputTokens?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalSessions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokens?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalUserMessages?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type LogBatchResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['LogBatch'] = ResolversParentTypes['LogBatch'],
> = ResolversObject<{
  counts?: Resolver<ResolversTypes['LogCounts'], ParentType, ContextType>;
  entries?: Resolver<Array<ResolversTypes['LogEntry']>, ParentType, ContextType>;
}>;

export type LogCountsResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['LogCounts'] = ResolversParentTypes['LogCounts'],
> = ResolversObject<{
  debug?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  error?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  info?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  warn?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type LogEntryResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['LogEntry'] = ResolversParentTypes['LogEntry'],
> = ResolversObject<{
  level?: Resolver<ResolversTypes['LogLevel'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  module?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  time?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type MetricsBucketResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['MetricsBucket'] = ResolversParentTypes['MetricsBucket'],
> = ResolversObject<{
  apiCalls?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  assistantTurns?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  bucket?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  epochStart?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  errors?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  gatewayUp?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  restartEvent?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  sessions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  tokensByModel?: Resolver<Array<ResolversTypes['ModelTokens']>, ParentType, ContextType>;
  tokensK?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  toolCalls?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  turns?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  userTurns?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  warnings?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type MetricsSummaryResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['MetricsSummary'] = ResolversParentTypes['MetricsSummary'],
> = ResolversObject<{
  bucketMinutes?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  buckets?: Resolver<Array<ResolversTypes['MetricsBucket']>, ParentType, ContextType>;
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  range?: Resolver<ResolversTypes['MetricsRange'], ParentType, ContextType>;
  rangeTokensK?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  timezone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalErrors?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokensK?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalTurns?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalWarnings?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  uptimePercent?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  warnings?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type ModelTokensResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['ModelTokens'] = ResolversParentTypes['ModelTokens'],
> = ResolversObject<{
  model?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tokensK?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type OpenClawSystemResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['OpenClawSystem'] = ResolversParentTypes['OpenClawSystem'],
> = ResolversObject<{
  channels?: Resolver<Array<ResolversTypes['Channel']>, ParentType, ContextType>;
  gateway?: Resolver<ResolversTypes['GatewayStatus'], ParentType, ContextType>;
  health?: Resolver<ResolversTypes['HealthStatus'], ParentType, ContextType>;
  resources?: Resolver<ResolversTypes['SystemResources'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PageInfoResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo'],
> = ResolversObject<{
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasPreviousPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  startCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query'],
> = ResolversObject<{
  channels?: Resolver<Array<ResolversTypes['Channel']>, ParentType, ContextType>;
  context?: Resolver<ResolversTypes['LegacyContextNamespace'], ParentType, ContextType>;
  cronJobs?: Resolver<Array<ResolversTypes['CronJob']>, ParentType, ContextType>;
  eventCounts?: Resolver<ResolversTypes['EventCounts'], ParentType, ContextType, Partial<QueryEventCountsArgs>>;
  eventDensity?: Resolver<Array<ResolversTypes['EventDensityBucket']>, ParentType, ContextType>;
  events?: Resolver<ResolversTypes['EventsResult'], ParentType, ContextType, Partial<QueryEventsArgs>>;
  gateway?: Resolver<ResolversTypes['GatewayStatus'], ParentType, ContextType>;
  lifetimeStats?: Resolver<ResolversTypes['LifetimeStats'], ParentType, ContextType>;
  metrics?: Resolver<ResolversTypes['MetricsSummary'], ParentType, ContextType, Partial<QueryMetricsArgs>>;
  recentLogs?: Resolver<Array<ResolversTypes['LogEntry']>, ParentType, ContextType, Partial<QueryRecentLogsArgs>>;
  resources?: Resolver<ResolversTypes['SystemResources'], ParentType, ContextType>;
  sessionTranscript?: Resolver<
    Maybe<ResolversTypes['SessionTranscript']>,
    ParentType,
    ContextType,
    RequireFields<QuerySessionTranscriptArgs, 'sessionKey'>
  >;
  sessions?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType, Partial<QuerySessionsArgs>>;
  source?: Resolver<
    Maybe<ResolversTypes['SourceNamespace']>,
    ParentType,
    ContextType,
    RequireFields<QuerySourceArgs, 'selector'>
  >;
  sources?: Resolver<Array<ResolversTypes['DataSource']>, ParentType, ContextType, Partial<QuerySourcesArgs>>;
  system?: Resolver<ResolversTypes['SystemNamespace'], ParentType, ContextType, Partial<QuerySystemArgs>>;
  usageCost?: Resolver<ResolversTypes['UsageCost'], ParentType, ContextType>;
}>;

export type SessionResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session'],
> = ResolversObject<{
  channel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  contextTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  key?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  model?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  subAgents?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType>;
  totalTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  turnCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  usagePercent?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type SessionTranscriptResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['SessionTranscript'] = ResolversParentTypes['SessionTranscript'],
> = ResolversObject<{
  channel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  contextTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  durationMs?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  fileSize?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isSubAgent?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  messages?: Resolver<Array<ResolversTypes['TranscriptMessage']>, ParentType, ContextType>;
  model?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  parentDisplayName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sessionKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  spawnPrompt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  thinkingLevel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  totalMessages?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type SourceAttributesResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['SourceAttributes'] = ResolversParentTypes['SourceAttributes'],
> = ResolversObject<{
  category?: Resolver<ResolversTypes['SourceCategory'], ParentType, ContextType>;
  provider?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type SourceNamespaceResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['SourceNamespace'] = ResolversParentTypes['SourceNamespace'],
> = ResolversObject<{
  __resolveType: TypeResolveFn<'AgentNamespace', ParentType, ContextType>;
}>;

export type SubscriptionResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription'],
> = ResolversObject<{
  dataChanged?: SubscriptionResolver<ResolversTypes['DataChangeSignal'], 'dataChanged', ParentType, ContextType>;
  logs?: SubscriptionResolver<
    ResolversTypes['LogBatch'],
    'logs',
    ParentType,
    ContextType,
    Partial<SubscriptionLogsArgs>
  >;
}>;

export type SystemNamespaceResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['SystemNamespace'] = ResolversParentTypes['SystemNamespace'],
> = ResolversObject<{
  __resolveType: TypeResolveFn<'OpenClawSystem', ParentType, ContextType>;
}>;

export type SystemResourcesResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['SystemResources'] = ResolversParentTypes['SystemResources'],
> = ResolversObject<{
  cpu?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  diskMB?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  memoryMB?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  sampledAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type TranscriptMessageResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['TranscriptMessage'] = ResolversParentTypes['TranscriptMessage'],
> = ResolversObject<{
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentTruncated?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  model?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  toolName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  usage?: Resolver<Maybe<ResolversTypes['TranscriptTokenUsage']>, ParentType, ContextType>;
}>;

export type TranscriptTokenUsageResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['TranscriptTokenUsage'] = ResolversParentTypes['TranscriptTokenUsage'],
> = ResolversObject<{
  cacheRead?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  cacheWrite?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  input?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  output?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type UsageCostResolvers<
  ContextType = AppContext,
  ParentType extends ResolversParentTypes['UsageCost'] = ResolversParentTypes['UsageCost'],
> = ResolversObject<{
  fetchedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  todayCost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  todayTokensM?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalCost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalTokensM?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = AppContext> = ResolversObject<{
  AgentNamespace?: AgentNamespaceResolvers<ContextType>;
  Channel?: ChannelResolvers<ContextType>;
  CronJob?: CronJobResolvers<ContextType>;
  DataChangeSignal?: DataChangeSignalResolvers<ContextType>;
  DataSource?: DataSourceResolvers<ContextType>;
  EventCounts?: EventCountsResolvers<ContextType>;
  EventDensityBucket?: EventDensityBucketResolvers<ContextType>;
  EventEntry?: EventEntryResolvers<ContextType>;
  EventsResult?: EventsResultResolvers<ContextType>;
  GatewayStatus?: GatewayStatusResolvers<ContextType>;
  HasSourceInfo?: HasSourceInfoResolvers<ContextType>;
  HasSystemInfo?: HasSystemInfoResolvers<ContextType>;
  HealthCheck?: HealthCheckResolvers<ContextType>;
  HealthStatus?: HealthStatusResolvers<ContextType>;
  JSON?: GraphQLScalarType;
  LegacyContextNamespace?: LegacyContextNamespaceResolvers<ContextType>;
  LifetimeStats?: LifetimeStatsResolvers<ContextType>;
  LogBatch?: LogBatchResolvers<ContextType>;
  LogCounts?: LogCountsResolvers<ContextType>;
  LogEntry?: LogEntryResolvers<ContextType>;
  MetricsBucket?: MetricsBucketResolvers<ContextType>;
  MetricsSummary?: MetricsSummaryResolvers<ContextType>;
  ModelTokens?: ModelTokensResolvers<ContextType>;
  OpenClawSystem?: OpenClawSystemResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  SessionTranscript?: SessionTranscriptResolvers<ContextType>;
  SourceAttributes?: SourceAttributesResolvers<ContextType>;
  SourceNamespace?: SourceNamespaceResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  SystemNamespace?: SystemNamespaceResolvers<ContextType>;
  SystemResources?: SystemResourcesResolvers<ContextType>;
  TranscriptMessage?: TranscriptMessageResolvers<ContextType>;
  TranscriptTokenUsage?: TranscriptTokenUsageResolvers<ContextType>;
  UsageCost?: UsageCostResolvers<ContextType>;
}>;
