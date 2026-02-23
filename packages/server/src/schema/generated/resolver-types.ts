import { GraphQLResolveInfo } from 'graphql';
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

/** Source of cost calculation data */
export type CostSource =
  | 'CLI_FALLBACK'
  | 'TOKENTALLY';

/** Detailed cost summary with per-model breakdown */
export type CostSummary = {
  byModel: Array<ModelCost>;
  fetchedAt: Scalars['String']['output'];
  inputUsd: Scalars['Float']['output'];
  outputUsd: Scalars['Float']['output'];
  source: CostSource;
  totalUsd: Scalars['Float']['output'];
};

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

export type DiagnosticFinding = {
  detail: Scalars['String']['output'];
  id: Scalars['String']['output'];
  matchedAt: Scalars['String']['output'];
  severity: DiagnosticSeverity;
  title: Scalars['String']['output'];
};

export type DiagnosticSeverity =
  | 'CRITICAL'
  | 'INFO'
  | 'WARNING';

export type DiagnosticsResult = {
  evaluatedAt: Scalars['String']['output'];
  findings: Array<DiagnosticFinding>;
  snapshotSummary: Scalars['String']['output'];
};

/** Options for the gateway doctor diagnostic */
export type DoctorOptions = {
  /** Run deep scan for extra gateway installs */
  deep?: InputMaybe<Scalars['Boolean']['input']>;
  /** Apply recommended repairs automatically */
  fix?: InputMaybe<Scalars['Boolean']['input']>;
};

export type EventCounts = {
  error: Scalars['Int']['output'];
  restart: Scalars['Int']['output'];
  warning: Scalars['Int']['output'];
};

export type EventDensityBucket = {
  count: Scalars['Int']['output'];
  epochStart: Scalars['Int']['output'];
  hasError: Scalars['Boolean']['output'];
  hasRestart: Scalars['Boolean']['output'];
  hasWarning: Scalars['Boolean']['output'];
  hour: Scalars['Int']['output'];
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
  warnings: Scalars['Int']['output'];
};

export type MetricsRange =
  | 'ONE_HOUR'
  | 'SIX_HOUR'
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
  totalWarnings: Scalars['Int']['output'];
  uptimePercent: Scalars['Float']['output'];
  warnings: Array<Scalars['String']['output']>;
};

/** Per-model cost breakdown from tokentally */
export type ModelCost = {
  calls: Scalars['Int']['output'];
  inputTokens: Scalars['Int']['output'];
  inputUsd: Scalars['Float']['output'];
  model: Scalars['String']['output'];
  outputTokens: Scalars['Int']['output'];
  outputUsd: Scalars['Float']['output'];
  totalTokens: Scalars['Int']['output'];
  totalUsd: Scalars['Float']['output'];
};

export type ModelTokens = {
  model: Scalars['String']['output'];
  tokensK: Scalars['Float']['output'];
};

export type Mutation = {
  restartGateway: OperationResult;
  runDoctor: OperationResult;
  updateGateway: OperationResult;
};


export type MutationRunDoctorArgs = {
  options: DoctorOptions;
};

/** Result of a gateway operation (restart, update, doctor) */
export type OperationResult = {
  duration?: Maybe<Scalars['Int']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  output?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type Query = {
  channels: Array<Channel>;
  costSummary: CostSummary;
  cronJobs: Array<CronJob>;
  diagnostics: DiagnosticsResult;
  eventDensity: Array<EventDensityBucket>;
  events: EventsResult;
  gateway: GatewayStatus;
  metrics: MetricsSummary;
  recentLogs: Array<LogEntry>;
  resources: SystemResources;
  sessions: Array<Session>;
  usageCost: UsageCost;
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

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
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

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Channel: ResolverTypeWrapper<Channel>;
  ChannelProvider: ChannelProvider;
  CostSource: CostSource;
  CostSummary: ResolverTypeWrapper<CostSummary>;
  CronJob: ResolverTypeWrapper<CronJob>;
  DataChangeSignal: ResolverTypeWrapper<DataChangeSignal>;
  DiagnosticFinding: ResolverTypeWrapper<DiagnosticFinding>;
  DiagnosticSeverity: DiagnosticSeverity;
  DiagnosticsResult: ResolverTypeWrapper<DiagnosticsResult>;
  DoctorOptions: DoctorOptions;
  EventCounts: ResolverTypeWrapper<EventCounts>;
  EventDensityBucket: ResolverTypeWrapper<EventDensityBucket>;
  EventEntry: ResolverTypeWrapper<EventEntry>;
  EventsResult: ResolverTypeWrapper<EventsResult>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  GatewayStatus: ResolverTypeWrapper<GatewayStatus>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  LogBatch: ResolverTypeWrapper<LogBatch>;
  LogCounts: ResolverTypeWrapper<LogCounts>;
  LogEntry: ResolverTypeWrapper<LogEntry>;
  LogFilter: LogFilter;
  LogLevel: LogLevel;
  MetricsBucket: ResolverTypeWrapper<MetricsBucket>;
  MetricsRange: MetricsRange;
  MetricsSummary: ResolverTypeWrapper<MetricsSummary>;
  ModelCost: ResolverTypeWrapper<ModelCost>;
  ModelTokens: ResolverTypeWrapper<ModelTokens>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  OperationResult: ResolverTypeWrapper<OperationResult>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Session: ResolverTypeWrapper<Session>;
  SessionFilter: SessionFilter;
  SessionSortBy: SessionSortBy;
  SessionStatus: SessionStatus;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  SystemResources: ResolverTypeWrapper<SystemResources>;
  UsageCost: ResolverTypeWrapper<UsageCost>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Boolean: Scalars['Boolean']['output'];
  Channel: Channel;
  CostSummary: CostSummary;
  CronJob: CronJob;
  DataChangeSignal: DataChangeSignal;
  DiagnosticFinding: DiagnosticFinding;
  DiagnosticsResult: DiagnosticsResult;
  DoctorOptions: DoctorOptions;
  EventCounts: EventCounts;
  EventDensityBucket: EventDensityBucket;
  EventEntry: EventEntry;
  EventsResult: EventsResult;
  Float: Scalars['Float']['output'];
  GatewayStatus: GatewayStatus;
  Int: Scalars['Int']['output'];
  LogBatch: LogBatch;
  LogCounts: LogCounts;
  LogEntry: LogEntry;
  LogFilter: LogFilter;
  MetricsBucket: MetricsBucket;
  MetricsSummary: MetricsSummary;
  ModelCost: ModelCost;
  ModelTokens: ModelTokens;
  Mutation: Record<PropertyKey, never>;
  OperationResult: OperationResult;
  Query: Record<PropertyKey, never>;
  Session: Session;
  SessionFilter: SessionFilter;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  SystemResources: SystemResources;
  UsageCost: UsageCost;
}>;

export type ChannelResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Channel'] = ResolversParentTypes['Channel']> = ResolversObject<{
  connected?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  latencyMs?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  provider?: Resolver<ResolversTypes['ChannelProvider'], ParentType, ContextType>;
}>;

export type CostSummaryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['CostSummary'] = ResolversParentTypes['CostSummary']> = ResolversObject<{
  byModel?: Resolver<Array<ResolversTypes['ModelCost']>, ParentType, ContextType>;
  fetchedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  inputUsd?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  outputUsd?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  source?: Resolver<ResolversTypes['CostSource'], ParentType, ContextType>;
  totalUsd?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type CronJobResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['CronJob'] = ResolversParentTypes['CronJob']> = ResolversObject<{
  enabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  lastRunAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  lastRunSuccess?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nextRunAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  schedule?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type DataChangeSignalResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['DataChangeSignal'] = ResolversParentTypes['DataChangeSignal']> = ResolversObject<{
  source?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ts?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type DiagnosticFindingResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['DiagnosticFinding'] = ResolversParentTypes['DiagnosticFinding']> = ResolversObject<{
  detail?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  matchedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  severity?: Resolver<ResolversTypes['DiagnosticSeverity'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type DiagnosticsResultResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['DiagnosticsResult'] = ResolversParentTypes['DiagnosticsResult']> = ResolversObject<{
  evaluatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  findings?: Resolver<Array<ResolversTypes['DiagnosticFinding']>, ParentType, ContextType>;
  snapshotSummary?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type EventCountsResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['EventCounts'] = ResolversParentTypes['EventCounts']> = ResolversObject<{
  error?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  restart?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  warning?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type EventDensityBucketResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['EventDensityBucket'] = ResolversParentTypes['EventDensityBucket']> = ResolversObject<{
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  epochStart?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hasError?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasRestart?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasWarning?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hour?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type EventEntryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['EventEntry'] = ResolversParentTypes['EventEntry']> = ResolversObject<{
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  module?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type EventsResultResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['EventsResult'] = ResolversParentTypes['EventsResult']> = ResolversObject<{
  counts?: Resolver<ResolversTypes['EventCounts'], ParentType, ContextType>;
  events?: Resolver<Array<ResolversTypes['EventEntry']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type GatewayStatusResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['GatewayStatus'] = ResolversParentTypes['GatewayStatus']> = ResolversObject<{
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

export type LogBatchResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['LogBatch'] = ResolversParentTypes['LogBatch']> = ResolversObject<{
  counts?: Resolver<ResolversTypes['LogCounts'], ParentType, ContextType>;
  entries?: Resolver<Array<ResolversTypes['LogEntry']>, ParentType, ContextType>;
}>;

export type LogCountsResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['LogCounts'] = ResolversParentTypes['LogCounts']> = ResolversObject<{
  debug?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  error?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  info?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  warn?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type LogEntryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['LogEntry'] = ResolversParentTypes['LogEntry']> = ResolversObject<{
  level?: Resolver<ResolversTypes['LogLevel'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  module?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  time?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type MetricsBucketResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MetricsBucket'] = ResolversParentTypes['MetricsBucket']> = ResolversObject<{
  apiCalls?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  warnings?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type MetricsSummaryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['MetricsSummary'] = ResolversParentTypes['MetricsSummary']> = ResolversObject<{
  bucketMinutes?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  buckets?: Resolver<Array<ResolversTypes['MetricsBucket']>, ParentType, ContextType>;
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  range?: Resolver<ResolversTypes['MetricsRange'], ParentType, ContextType>;
  rangeTokensK?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  timezone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalErrors?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokensK?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalWarnings?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  uptimePercent?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  warnings?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type ModelCostResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ModelCost'] = ResolversParentTypes['ModelCost']> = ResolversObject<{
  calls?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  inputTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  inputUsd?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  model?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  outputTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  outputUsd?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalUsd?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type ModelTokensResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['ModelTokens'] = ResolversParentTypes['ModelTokens']> = ResolversObject<{
  model?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tokensK?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  restartGateway?: Resolver<ResolversTypes['OperationResult'], ParentType, ContextType>;
  runDoctor?: Resolver<ResolversTypes['OperationResult'], ParentType, ContextType, RequireFields<MutationRunDoctorArgs, 'options'>>;
  updateGateway?: Resolver<ResolversTypes['OperationResult'], ParentType, ContextType>;
}>;

export type OperationResultResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['OperationResult'] = ResolversParentTypes['OperationResult']> = ResolversObject<{
  duration?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  output?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  channels?: Resolver<Array<ResolversTypes['Channel']>, ParentType, ContextType>;
  costSummary?: Resolver<ResolversTypes['CostSummary'], ParentType, ContextType>;
  cronJobs?: Resolver<Array<ResolversTypes['CronJob']>, ParentType, ContextType>;
  diagnostics?: Resolver<ResolversTypes['DiagnosticsResult'], ParentType, ContextType>;
  eventDensity?: Resolver<Array<ResolversTypes['EventDensityBucket']>, ParentType, ContextType>;
  events?: Resolver<ResolversTypes['EventsResult'], ParentType, ContextType, Partial<QueryEventsArgs>>;
  gateway?: Resolver<ResolversTypes['GatewayStatus'], ParentType, ContextType>;
  metrics?: Resolver<ResolversTypes['MetricsSummary'], ParentType, ContextType, Partial<QueryMetricsArgs>>;
  recentLogs?: Resolver<Array<ResolversTypes['LogEntry']>, ParentType, ContextType, Partial<QueryRecentLogsArgs>>;
  resources?: Resolver<ResolversTypes['SystemResources'], ParentType, ContextType>;
  sessions?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType, Partial<QuerySessionsArgs>>;
  usageCost?: Resolver<ResolversTypes['UsageCost'], ParentType, ContextType>;
}>;

export type SessionResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session']> = ResolversObject<{
  channel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  contextTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  key?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  model?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  subAgents?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType>;
  totalTokens?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  usagePercent?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type SubscriptionResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = ResolversObject<{
  dataChanged?: SubscriptionResolver<ResolversTypes['DataChangeSignal'], "dataChanged", ParentType, ContextType>;
  logs?: SubscriptionResolver<ResolversTypes['LogBatch'], "logs", ParentType, ContextType, Partial<SubscriptionLogsArgs>>;
}>;

export type SystemResourcesResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['SystemResources'] = ResolversParentTypes['SystemResources']> = ResolversObject<{
  cpu?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  diskMB?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  memoryMB?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  sampledAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type UsageCostResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['UsageCost'] = ResolversParentTypes['UsageCost']> = ResolversObject<{
  fetchedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  todayCost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  todayTokensM?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalCost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalTokensM?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = AppContext> = ResolversObject<{
  Channel?: ChannelResolvers<ContextType>;
  CostSummary?: CostSummaryResolvers<ContextType>;
  CronJob?: CronJobResolvers<ContextType>;
  DataChangeSignal?: DataChangeSignalResolvers<ContextType>;
  DiagnosticFinding?: DiagnosticFindingResolvers<ContextType>;
  DiagnosticsResult?: DiagnosticsResultResolvers<ContextType>;
  EventCounts?: EventCountsResolvers<ContextType>;
  EventDensityBucket?: EventDensityBucketResolvers<ContextType>;
  EventEntry?: EventEntryResolvers<ContextType>;
  EventsResult?: EventsResultResolvers<ContextType>;
  GatewayStatus?: GatewayStatusResolvers<ContextType>;
  LogBatch?: LogBatchResolvers<ContextType>;
  LogCounts?: LogCountsResolvers<ContextType>;
  LogEntry?: LogEntryResolvers<ContextType>;
  MetricsBucket?: MetricsBucketResolvers<ContextType>;
  MetricsSummary?: MetricsSummaryResolvers<ContextType>;
  ModelCost?: ModelCostResolvers<ContextType>;
  ModelTokens?: ModelTokensResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  OperationResult?: OperationResultResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  SystemResources?: SystemResourcesResolvers<ContextType>;
  UsageCost?: UsageCostResolvers<ContextType>;
}>;

