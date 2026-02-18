import { graphql } from '../generated/gql';

export const DataChangedSubscription = graphql(/* GraphQL */ `
  subscription DataChanged {
    dataChanged {
      source
      ts
    }
  }
`);

export const LogsSubscription = graphql(/* GraphQL */ `
  subscription Logs($filter: LogFilter) {
    logs(filter: $filter) {
      entries {
        time
        level
        module
        message
      }
      counts {
        debug
        info
        warn
        error
      }
    }
  }
`);
