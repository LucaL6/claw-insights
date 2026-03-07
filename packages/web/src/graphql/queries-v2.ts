import { graphql } from '../generated/gql';

export const SystemDashboardV2Query = graphql(/* GraphQL */ `
  query SystemDashboardV2($context: QueryContext) {
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

export const SessionsV2Query = graphql(/* GraphQL */ `
  query SessionsV2($selector: SourceSelector!, $filter: SessionFilter, $context: QueryContext) {
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

export const MetricsV2Query = graphql(/* GraphQL */ `
  query MetricsV2($selector: SourceSelector!, $date: String, $range: MetricsRange, $context: QueryContext) {
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
