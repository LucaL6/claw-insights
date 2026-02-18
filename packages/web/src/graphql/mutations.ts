import { graphql } from '../generated/gql';

export const RestartGatewayMutation = graphql(/* GraphQL */ `
  mutation RestartGateway {
    restartGateway { success message output duration }
  }
`);

export const UpdateGatewayMutation = graphql(/* GraphQL */ `
  mutation UpdateGateway {
    updateGateway { success message output duration }
  }
`);

export const RunDoctorMutation = graphql(/* GraphQL */ `
  mutation RunDoctor($options: DoctorOptions!) {
    runDoctor(options: $options) { success message output duration }
  }
`);
