export const DataChangedSubscription = /* GraphQL */ `
  subscription DataChanged {
    dataChanged { source ts }
  }
`;

export const LogsSubscription = /* GraphQL */ `
  subscription Logs($filter: LogFilter) {
    logs(filter: $filter) {
      entries { time level module message }
      counts { debug info warn error }
    }
  }
`;
