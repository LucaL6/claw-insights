import { graphql } from '../generated/gql';

export const GatewayQuery = graphql(/* GraphQL */ `
  query Gateway {
    gateway {
      running
      pid
      version
      appVersion
      updateAvailable
      uptime
      startedAt
      connectLatencyMs
      latestVersion
      securityCritical
      securityWarn
    }
  }
`);

export const ResourcesQuery = graphql(/* GraphQL */ `
  query Resources {
    resources {
      cpu
      memoryMB
      diskMB
      sampledAt
    }
  }
`);

export const ChannelsQuery = graphql(/* GraphQL */ `
  query Channels {
    channels {
      provider
      name
      connected
      latencyMs
    }
  }
`);

export const SessionsQuery = graphql(/* GraphQL */ `
  query Sessions($filter: SessionFilter) {
    sessions(filter: $filter) {
      key
      displayName
      kind
      model
      channel
      totalTokens
      contextTokens
      usagePercent
      status
      updatedAt
      subAgents {
        key
        displayName
        kind
        model
        channel
        totalTokens
        contextTokens
        usagePercent
        status
        updatedAt
      }
    }
  }
`);

export const MetricsQuery = graphql(/* GraphQL */ `
  query Metrics($date: String, $range: MetricsRange) {
    metrics(date: $date, range: $range) {
      date
      range
      bucketMinutes
      timezone
      buckets {
        bucket
        label
        epochStart
        sessions
        tokensK
        tokensByModel {
          model
          tokensK
        }
        apiCalls
        toolCalls
        errors
        warnings
        gatewayUp
        restartEvent
      }
      totalTokensK
      rangeTokensK
      totalErrors
      totalWarnings
      uptimePercent
      warnings
    }
  }
`);

export const UsageCostQuery = graphql(/* GraphQL */ `
  query UsageCost {
    usageCost {
      totalCost
      totalTokensM
      todayCost
      todayTokensM
      fetchedAt
    }
  }
`);

export const CronJobsQuery = graphql(/* GraphQL */ `
  query CronJobs {
    cronJobs {
      id
      name
      enabled
      schedule
      lastRunAt
      lastRunSuccess
      nextRunAt
    }
  }
`);

export const RecentLogsQuery = graphql(/* GraphQL */ `
  query RecentLogs($count: Int) {
    recentLogs(count: $count) {
      time
      level
      module
      message
    }
  }
`);

export const LifetimeStatsQuery = graphql(/* GraphQL */ `
  query LifetimeStats {
    lifetimeStats {
      isReady
      createdAt
      daysSinceCreation
      totalSessions
      totalInputTokens
      totalOutputTokens
      totalCacheReadTokens
      totalCacheWriteTokens
      totalTokens
      totalUserMessages
      totalAssistantMessages
    }
  }
`);
