export const EventsQuery = `
  query Events($from: Int, $to: Int, $types: [String!], $limit: Int) {
    events(from: $from, to: $to, types: $types, limit: $limit) {
      events { timestamp type module message }
      total
      counts { error warning restart }
    }
  }
`;

export const EventDensityQuery = `
  query EventDensity {
    eventDensity { hour count hasError hasWarning hasRestart epochStart }
  }
`;
