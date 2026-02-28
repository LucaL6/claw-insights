/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query Events($from: Int, $to: Int, $types: [String!], $limit: Int) {\n    events(from: $from, to: $to, types: $types, limit: $limit) {\n      events {\n        timestamp\n        type\n        module\n        message\n      }\n      total\n      counts {\n        error\n        warning\n        restart\n      }\n    }\n  }\n": typeof types.EventsDocument,
    "\n  query EventDensity {\n    eventDensity {\n      hour\n      count\n      hasError\n      hasWarning\n      hasRestart\n      errorCount\n      warningCount\n      restartCount\n      epochStart\n    }\n  }\n": typeof types.EventDensityDocument,
    "\n  query EventCounts($from: Int, $to: Int) {\n    eventCounts(from: $from, to: $to) {\n      error\n      warning\n      restart\n    }\n  }\n": typeof types.EventCountsDocument,
    "\n  query Gateway {\n    gateway {\n      running\n      pid\n      version\n      appVersion\n      updateAvailable\n      uptime\n      startedAt\n      connectLatencyMs\n      latestVersion\n      securityCritical\n      securityWarn\n    }\n  }\n": typeof types.GatewayDocument,
    "\n  query Resources {\n    resources {\n      cpu\n      memoryMB\n      diskMB\n      sampledAt\n    }\n  }\n": typeof types.ResourcesDocument,
    "\n  query Channels {\n    channels {\n      provider\n      name\n      connected\n      latencyMs\n    }\n  }\n": typeof types.ChannelsDocument,
    "\n  query Sessions($filter: SessionFilter) {\n    sessions(filter: $filter) {\n      key\n      displayName\n      kind\n      model\n      channel\n      totalTokens\n      contextTokens\n      usagePercent\n      status\n      updatedAt\n      subAgents {\n        key\n        displayName\n        kind\n        model\n        channel\n        totalTokens\n        contextTokens\n        usagePercent\n        status\n        updatedAt\n      }\n    }\n  }\n": typeof types.SessionsDocument,
    "\n  query Metrics($date: String, $range: MetricsRange) {\n    metrics(date: $date, range: $range) {\n      date\n      range\n      bucketMinutes\n      timezone\n      buckets {\n        bucket\n        label\n        epochStart\n        sessions\n        tokensK\n        tokensByModel {\n          model\n          tokensK\n        }\n        apiCalls\n        toolCalls\n        turns\n        userTurns\n        assistantTurns\n        errors\n        warnings\n        gatewayUp\n        restartEvent\n      }\n      totalTokensK\n      rangeTokensK\n      totalTurns\n      totalErrors\n      totalWarnings\n      uptimePercent\n      warnings\n    }\n  }\n": typeof types.MetricsDocument,
    "\n  query UsageCost {\n    usageCost {\n      totalCost\n      totalTokensM\n      todayCost\n      todayTokensM\n      fetchedAt\n    }\n  }\n": typeof types.UsageCostDocument,
    "\n  query CronJobs {\n    cronJobs {\n      id\n      name\n      enabled\n      schedule\n      lastRunAt\n      lastRunSuccess\n      nextRunAt\n    }\n  }\n": typeof types.CronJobsDocument,
    "\n  query RecentLogs($count: Int) {\n    recentLogs(count: $count) {\n      time\n      level\n      module\n      message\n    }\n  }\n": typeof types.RecentLogsDocument,
    "\n  query LifetimeStats {\n    lifetimeStats {\n      isReady\n      createdAt\n      daysSinceCreation\n      totalSessions\n      totalInputTokens\n      totalOutputTokens\n      totalCacheReadTokens\n      totalCacheWriteTokens\n      totalTokens\n      totalUserMessages\n      totalAssistantMessages\n    }\n  }\n": typeof types.LifetimeStatsDocument,
    "\n  subscription DataChanged {\n    dataChanged {\n      source\n      ts\n    }\n  }\n": typeof types.DataChangedDocument,
    "\n  subscription Logs($filter: LogFilter) {\n    logs(filter: $filter) {\n      entries {\n        time\n        level\n        module\n        message\n      }\n      counts {\n        debug\n        info\n        warn\n        error\n      }\n    }\n  }\n": typeof types.LogsDocument,
};
const documents: Documents = {
    "\n  query Events($from: Int, $to: Int, $types: [String!], $limit: Int) {\n    events(from: $from, to: $to, types: $types, limit: $limit) {\n      events {\n        timestamp\n        type\n        module\n        message\n      }\n      total\n      counts {\n        error\n        warning\n        restart\n      }\n    }\n  }\n": types.EventsDocument,
    "\n  query EventDensity {\n    eventDensity {\n      hour\n      count\n      hasError\n      hasWarning\n      hasRestart\n      errorCount\n      warningCount\n      restartCount\n      epochStart\n    }\n  }\n": types.EventDensityDocument,
    "\n  query EventCounts($from: Int, $to: Int) {\n    eventCounts(from: $from, to: $to) {\n      error\n      warning\n      restart\n    }\n  }\n": types.EventCountsDocument,
    "\n  query Gateway {\n    gateway {\n      running\n      pid\n      version\n      appVersion\n      updateAvailable\n      uptime\n      startedAt\n      connectLatencyMs\n      latestVersion\n      securityCritical\n      securityWarn\n    }\n  }\n": types.GatewayDocument,
    "\n  query Resources {\n    resources {\n      cpu\n      memoryMB\n      diskMB\n      sampledAt\n    }\n  }\n": types.ResourcesDocument,
    "\n  query Channels {\n    channels {\n      provider\n      name\n      connected\n      latencyMs\n    }\n  }\n": types.ChannelsDocument,
    "\n  query Sessions($filter: SessionFilter) {\n    sessions(filter: $filter) {\n      key\n      displayName\n      kind\n      model\n      channel\n      totalTokens\n      contextTokens\n      usagePercent\n      status\n      updatedAt\n      subAgents {\n        key\n        displayName\n        kind\n        model\n        channel\n        totalTokens\n        contextTokens\n        usagePercent\n        status\n        updatedAt\n      }\n    }\n  }\n": types.SessionsDocument,
    "\n  query Metrics($date: String, $range: MetricsRange) {\n    metrics(date: $date, range: $range) {\n      date\n      range\n      bucketMinutes\n      timezone\n      buckets {\n        bucket\n        label\n        epochStart\n        sessions\n        tokensK\n        tokensByModel {\n          model\n          tokensK\n        }\n        apiCalls\n        toolCalls\n        turns\n        userTurns\n        assistantTurns\n        errors\n        warnings\n        gatewayUp\n        restartEvent\n      }\n      totalTokensK\n      rangeTokensK\n      totalTurns\n      totalErrors\n      totalWarnings\n      uptimePercent\n      warnings\n    }\n  }\n": types.MetricsDocument,
    "\n  query UsageCost {\n    usageCost {\n      totalCost\n      totalTokensM\n      todayCost\n      todayTokensM\n      fetchedAt\n    }\n  }\n": types.UsageCostDocument,
    "\n  query CronJobs {\n    cronJobs {\n      id\n      name\n      enabled\n      schedule\n      lastRunAt\n      lastRunSuccess\n      nextRunAt\n    }\n  }\n": types.CronJobsDocument,
    "\n  query RecentLogs($count: Int) {\n    recentLogs(count: $count) {\n      time\n      level\n      module\n      message\n    }\n  }\n": types.RecentLogsDocument,
    "\n  query LifetimeStats {\n    lifetimeStats {\n      isReady\n      createdAt\n      daysSinceCreation\n      totalSessions\n      totalInputTokens\n      totalOutputTokens\n      totalCacheReadTokens\n      totalCacheWriteTokens\n      totalTokens\n      totalUserMessages\n      totalAssistantMessages\n    }\n  }\n": types.LifetimeStatsDocument,
    "\n  subscription DataChanged {\n    dataChanged {\n      source\n      ts\n    }\n  }\n": types.DataChangedDocument,
    "\n  subscription Logs($filter: LogFilter) {\n    logs(filter: $filter) {\n      entries {\n        time\n        level\n        module\n        message\n      }\n      counts {\n        debug\n        info\n        warn\n        error\n      }\n    }\n  }\n": types.LogsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Events($from: Int, $to: Int, $types: [String!], $limit: Int) {\n    events(from: $from, to: $to, types: $types, limit: $limit) {\n      events {\n        timestamp\n        type\n        module\n        message\n      }\n      total\n      counts {\n        error\n        warning\n        restart\n      }\n    }\n  }\n"): (typeof documents)["\n  query Events($from: Int, $to: Int, $types: [String!], $limit: Int) {\n    events(from: $from, to: $to, types: $types, limit: $limit) {\n      events {\n        timestamp\n        type\n        module\n        message\n      }\n      total\n      counts {\n        error\n        warning\n        restart\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EventDensity {\n    eventDensity {\n      hour\n      count\n      hasError\n      hasWarning\n      hasRestart\n      errorCount\n      warningCount\n      restartCount\n      epochStart\n    }\n  }\n"): (typeof documents)["\n  query EventDensity {\n    eventDensity {\n      hour\n      count\n      hasError\n      hasWarning\n      hasRestart\n      errorCount\n      warningCount\n      restartCount\n      epochStart\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EventCounts($from: Int, $to: Int) {\n    eventCounts(from: $from, to: $to) {\n      error\n      warning\n      restart\n    }\n  }\n"): (typeof documents)["\n  query EventCounts($from: Int, $to: Int) {\n    eventCounts(from: $from, to: $to) {\n      error\n      warning\n      restart\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Gateway {\n    gateway {\n      running\n      pid\n      version\n      appVersion\n      updateAvailable\n      uptime\n      startedAt\n      connectLatencyMs\n      latestVersion\n      securityCritical\n      securityWarn\n    }\n  }\n"): (typeof documents)["\n  query Gateway {\n    gateway {\n      running\n      pid\n      version\n      appVersion\n      updateAvailable\n      uptime\n      startedAt\n      connectLatencyMs\n      latestVersion\n      securityCritical\n      securityWarn\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Resources {\n    resources {\n      cpu\n      memoryMB\n      diskMB\n      sampledAt\n    }\n  }\n"): (typeof documents)["\n  query Resources {\n    resources {\n      cpu\n      memoryMB\n      diskMB\n      sampledAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Channels {\n    channels {\n      provider\n      name\n      connected\n      latencyMs\n    }\n  }\n"): (typeof documents)["\n  query Channels {\n    channels {\n      provider\n      name\n      connected\n      latencyMs\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Sessions($filter: SessionFilter) {\n    sessions(filter: $filter) {\n      key\n      displayName\n      kind\n      model\n      channel\n      totalTokens\n      contextTokens\n      usagePercent\n      status\n      updatedAt\n      subAgents {\n        key\n        displayName\n        kind\n        model\n        channel\n        totalTokens\n        contextTokens\n        usagePercent\n        status\n        updatedAt\n      }\n    }\n  }\n"): (typeof documents)["\n  query Sessions($filter: SessionFilter) {\n    sessions(filter: $filter) {\n      key\n      displayName\n      kind\n      model\n      channel\n      totalTokens\n      contextTokens\n      usagePercent\n      status\n      updatedAt\n      subAgents {\n        key\n        displayName\n        kind\n        model\n        channel\n        totalTokens\n        contextTokens\n        usagePercent\n        status\n        updatedAt\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Metrics($date: String, $range: MetricsRange) {\n    metrics(date: $date, range: $range) {\n      date\n      range\n      bucketMinutes\n      timezone\n      buckets {\n        bucket\n        label\n        epochStart\n        sessions\n        tokensK\n        tokensByModel {\n          model\n          tokensK\n        }\n        apiCalls\n        toolCalls\n        turns\n        userTurns\n        assistantTurns\n        errors\n        warnings\n        gatewayUp\n        restartEvent\n      }\n      totalTokensK\n      rangeTokensK\n      totalTurns\n      totalErrors\n      totalWarnings\n      uptimePercent\n      warnings\n    }\n  }\n"): (typeof documents)["\n  query Metrics($date: String, $range: MetricsRange) {\n    metrics(date: $date, range: $range) {\n      date\n      range\n      bucketMinutes\n      timezone\n      buckets {\n        bucket\n        label\n        epochStart\n        sessions\n        tokensK\n        tokensByModel {\n          model\n          tokensK\n        }\n        apiCalls\n        toolCalls\n        turns\n        userTurns\n        assistantTurns\n        errors\n        warnings\n        gatewayUp\n        restartEvent\n      }\n      totalTokensK\n      rangeTokensK\n      totalTurns\n      totalErrors\n      totalWarnings\n      uptimePercent\n      warnings\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query UsageCost {\n    usageCost {\n      totalCost\n      totalTokensM\n      todayCost\n      todayTokensM\n      fetchedAt\n    }\n  }\n"): (typeof documents)["\n  query UsageCost {\n    usageCost {\n      totalCost\n      totalTokensM\n      todayCost\n      todayTokensM\n      fetchedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CronJobs {\n    cronJobs {\n      id\n      name\n      enabled\n      schedule\n      lastRunAt\n      lastRunSuccess\n      nextRunAt\n    }\n  }\n"): (typeof documents)["\n  query CronJobs {\n    cronJobs {\n      id\n      name\n      enabled\n      schedule\n      lastRunAt\n      lastRunSuccess\n      nextRunAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecentLogs($count: Int) {\n    recentLogs(count: $count) {\n      time\n      level\n      module\n      message\n    }\n  }\n"): (typeof documents)["\n  query RecentLogs($count: Int) {\n    recentLogs(count: $count) {\n      time\n      level\n      module\n      message\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LifetimeStats {\n    lifetimeStats {\n      isReady\n      createdAt\n      daysSinceCreation\n      totalSessions\n      totalInputTokens\n      totalOutputTokens\n      totalCacheReadTokens\n      totalCacheWriteTokens\n      totalTokens\n      totalUserMessages\n      totalAssistantMessages\n    }\n  }\n"): (typeof documents)["\n  query LifetimeStats {\n    lifetimeStats {\n      isReady\n      createdAt\n      daysSinceCreation\n      totalSessions\n      totalInputTokens\n      totalOutputTokens\n      totalCacheReadTokens\n      totalCacheWriteTokens\n      totalTokens\n      totalUserMessages\n      totalAssistantMessages\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription DataChanged {\n    dataChanged {\n      source\n      ts\n    }\n  }\n"): (typeof documents)["\n  subscription DataChanged {\n    dataChanged {\n      source\n      ts\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription Logs($filter: LogFilter) {\n    logs(filter: $filter) {\n      entries {\n        time\n        level\n        module\n        message\n      }\n      counts {\n        debug\n        info\n        warn\n        error\n      }\n    }\n  }\n"): (typeof documents)["\n  subscription Logs($filter: LogFilter) {\n    logs(filter: $filter) {\n      entries {\n        time\n        level\n        module\n        message\n      }\n      counts {\n        debug\n        info\n        warn\n        error\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;