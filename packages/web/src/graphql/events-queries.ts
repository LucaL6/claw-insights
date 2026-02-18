import { graphql } from '../generated/gql';

export const EventsQuery = graphql(/* GraphQL */ `
  query Events($from: Int, $to: Int, $types: [String!], $limit: Int) {
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
`);

export const EventDensityQuery = graphql(/* GraphQL */ `
  query EventDensity {
    eventDensity {
      hour
      count
      hasError
      hasWarning
      hasRestart
      epochStart
    }
  }
`);
