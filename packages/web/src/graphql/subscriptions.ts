export const LogsSubscription = /* GraphQL */ `
  subscription Logs($filter: LogFilter) {
    logs(filter: $filter) {
      entries { time level module message }
      counts { debug info warn error }
    }
  }
`;

export const SessionChangedSubscription = /* GraphQL */ `
  subscription SessionChanged {
    sessionChanged {
      key displayName kind model channel
      totalTokens contextTokens usagePercent status updatedAt
      subAgents { key label status totalTokens updatedAt }
    }
  }
`;

export const GatewayHealthSubscription = /* GraphQL */ `
  subscription GatewayHealth {
    gatewayHealth { running pid version updateAvailable uptime startedAt }
  }
`;
