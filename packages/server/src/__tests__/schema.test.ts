import { buildSchema } from 'graphql';
import { describe, expect, it } from 'vitest';

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
    expect(fields).toContain('dataChanged');
  });

  it('should not have a Mutation type (read-only architecture)', () => {
    const schema = buildSchema(typeDefs);
    expect(schema.getMutationType()).toBeUndefined();
  });
});
