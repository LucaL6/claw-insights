export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
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
  JSON: { input: unknown; output: unknown; }
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
  | 'signal'
  | 'slack'
  | 'telegram'
  | 'webchat'
  | 'whatsapp';

export type CheckStatus =
  | 'FAIL'
  | 'PASS'
  | 'WARN';

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

export type HealthLevel =
  | 'DEGRADED'
  | 'HEALTHY'
  | 'UNHEALTHY';

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

export type SessionSortBy =
  | 'NAME'
  | 'TOKENS_DESC'
  | 'UPDATED_AT';

export type SessionStatus =
  | 'ACTIVE'
  | 'DONE'
  | 'FAILED'
  | 'IDLE';

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

export type SourceCategory =
  | 'AGENT'
  | 'CALENDAR'
  | 'DASHBOARD'
  | 'INTEGRATION'
  | 'KANBAN';

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

export type SourceStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'INITIALIZING';

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

export type TimePreset =
  | 'ONE_HOUR'
  | 'SIX_HOUR'
  | 'THIRTY_MIN'
  | 'TWELVE_HOUR'
  | 'TWENTY_FOUR_HOUR';

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
