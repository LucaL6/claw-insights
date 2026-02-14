import { describe, it, expect } from 'bun:test';
import { buildSchema } from 'graphql';
import { typeDefs } from '../schema/typeDefs';

describe('GraphQL Schema', () => {
  it('should build without errors', () => {
    expect(() => buildSchema(typeDefs)).not.toThrow();
  });

  it('should contain all root query fields', () => {
    const schema = buildSchema(typeDefs);
    const queryType = schema.getQueryType();
    expect(queryType).toBeDefined();
    const fields = Object.keys(queryType!.getFields());
    expect(fields).toContain('gateway');
    expect(fields).toContain('resources');
    expect(fields).toContain('channels');
    expect(fields).toContain('sessions');
    expect(fields).toContain('metrics');
    expect(fields).toContain('cronJobs');
  });

  it('should contain subscriptions', () => {
    const schema = buildSchema(typeDefs);
    const subType = schema.getSubscriptionType();
    expect(subType).toBeDefined();
    const fields = Object.keys(subType!.getFields());
    expect(fields).toContain('logs');
    expect(fields).toContain('sessionChanged');
    expect(fields).toContain('gatewayHealth');
  });

  it('should contain mutations', () => {
    const schema = buildSchema(typeDefs);
    const mutationType = schema.getMutationType();
    expect(mutationType).toBeDefined();
    const fields = Object.keys(mutationType!.getFields());
    expect(fields).toContain('restartGateway');
    expect(fields).toContain('runDoctor');
    expect(fields).toContain('updateGateway');
  });
});
