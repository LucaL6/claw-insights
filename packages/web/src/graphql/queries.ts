import { graphql } from '../generated/gql';

export const SystemDashboardQuery = graphql(/* GraphQL */ `
  query SystemDashboard($context: QueryContext) {
    system(context: $context) {
      ... on OpenClawSystem {
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
        resources {
          cpu
          memoryMB
          diskMB
          sampledAt
        }
        channels {
          provider
          name
          connected
          latencyMs
        }
      }
    }
  }
`);

export const SessionsQuery = graphql(/* GraphQL */ `
  query Sessions($selector: SourceSelector!, $filter: SessionFilter, $context: QueryContext) {
    source(selector: $selector, context: $context) {
      ... on AgentNamespace {
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
          turnCount
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
            turnCount
          }
        }
      }
    }
  }
`);

export const MetricsQuery = graphql(/* GraphQL */ `
  query Metrics($selector: SourceSelector!, $date: String, $range: MetricsRange, $context: QueryContext) {
    source(selector: $selector, context: $context) {
      ... on AgentNamespace {
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
            turns
            userTurns
            assistantTurns
            errors
            warnings
            gatewayUp
            restartEvent
          }
          totalTokensK
          rangeTokensK
          totalTurns
          totalErrors
          totalWarnings
          uptimePercent
          warnings
        }
      }
    }
  }
`);

export const EventsQuery = graphql(/* GraphQL */ `
  query Events(
    $selector: SourceSelector!
    $from: Int
    $to: Int
    $types: [String!]
    $limit: Int
    $context: QueryContext
  ) {
    source(selector: $selector, context: $context) {
      ... on AgentNamespace {
        events(from: $from, to: $to, types: $types, limit: $limit) {
          events {
            timestamp
            type
            module
            message
          }
          total
          counts {
            error
            warning
            restart
          }
        }
      }
    }
  }
`);

export const EventDensityQuery = graphql(/* GraphQL */ `
  query EventDensity($selector: SourceSelector!, $context: QueryContext) {
    source(selector: $selector, context: $context) {
      ... on AgentNamespace {
        eventDensity {
          hour
          count
          hasError
          hasWarning
          hasRestart
          errorCount
          warningCount
          restartCount
          epochStart
        }
      }
    }
  }
`);

export const EventCountsQuery = graphql(/* GraphQL */ `
  query EventCounts($selector: SourceSelector!, $from: Int, $to: Int, $context: QueryContext) {
    source(selector: $selector, context: $context) {
      ... on AgentNamespace {
        eventCounts(from: $from, to: $to) {
          error
          warning
          restart
        }
      }
    }
  }
`);

export const SessionTranscriptQuery = graphql(/* GraphQL */ `
  query SessionTranscript(
    $selector: SourceSelector!
    $sessionKey: String!
    $limit: Int
    $before: String
    $after: String
    $context: QueryContext
  ) {
    source(selector: $selector, context: $context) {
      ... on AgentNamespace {
        sessionTranscript(sessionKey: $sessionKey, limit: $limit, before: $before, after: $after) {
          sessionKey
          displayName
          model
          channel
          kind
          thinkingLevel
          startedAt
          fileSize
          totalTokens
          contextTokens
          durationMs
          isSubAgent
          parentDisplayName
          spawnPrompt
          totalMessages
          pageInfo {
            startCursor
            endCursor
            hasPreviousPage
            hasNextPage
          }
          messages {
            timestamp
            role
            content
            contentTruncated
            model
            usage {
              input
              output
              cacheRead
              cacheWrite
            }
            toolName
          }
        }
      }
    }
  }
`);
