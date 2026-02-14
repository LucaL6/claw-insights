export const GatewayQuery = /* GraphQL */ `
  query Gateway {
    gateway { running pid version updateAvailable uptime startedAt }
  }
`;

export const ResourcesQuery = /* GraphQL */ `
  query Resources {
    resources { cpu memoryMB diskMB sampledAt }
  }
`;

export const ChannelsQuery = /* GraphQL */ `
  query Channels {
    channels { provider name connected latencyMs }
  }
`;

export const SessionsQuery = /* GraphQL */ `
  query Sessions($filter: SessionFilter) {
    sessions(filter: $filter) {
      key displayName kind model channel
      totalTokens contextTokens usagePercent status updatedAt
      subAgents { key label status totalTokens updatedAt }
    }
  }
`;

export const MetricsQuery = /* GraphQL */ `
  query Metrics($date: String) {
    metrics(date: $date) {
      date
      hours {
        hour sessions tokensK apiCalls toolCalls
        errors warnings gatewayUp restartEvent
      }
      totalTokensK totalErrors totalWarnings uptimePercent
    }
  }
`;

export const CronJobsQuery = /* GraphQL */ `
  query CronJobs {
    cronJobs { id name enabled schedule lastRunAt lastRunSuccess nextRunAt }
  }
`;
